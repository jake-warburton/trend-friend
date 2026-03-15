# Twitter Breaking Feed Integration

**Date:** 2026-03-15
**Status:** Approved

## Overview

A 60-second Render loop scrapes ~50 curated Twitter accounts via `twscrape`, surfaces breaking topics immediately via a fast path, and feeds tweets into the existing 45-min scoring pipeline as a high-reliability source.

## Motivation

Twitter is where breaking news and market-moving statements appear first. Accounts like @BBCBreaking, @elonmusk, and @Polymarket post content that is inherently newsworthy — the act of tweeting *is* the event. By scraping curated accounts without the paid API, we get near-real-time signal for the cost of a free-tier background worker.

---

## Section 1: Data Model & Storage

### `twitter_tweets` table

| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK, autoincrement | Internal primary key (matches codebase pattern) |
| `account_handle` | text, not null | The @handle |
| `tweet_id` | text, unique, not null | External ID, used for dedup and upsert |
| `text` | text, not null | Tweet content |
| `timestamp` | datetime, not null | When tweeted |
| `engagement` | float, not null | likes + 2x retweets + replies |
| `fetched_at` | datetime, not null | When we grabbed it |
| `metadata` | json | Author name, media links, quote tweet info |

Index on `(account_handle, timestamp DESC)` for efficient per-account queries and pruning.

**Pruning:** Keep latest 100 tweets per account. On each fetch, delete older rows beyond that cap.

### Breaking feed delivery

The Render worker and Vercel frontend run on separate infrastructure, so the breaking feed is delivered via the existing `published_payloads` table in Supabase. The mini-pipeline serializes the breaking feed as JSON and upserts it into `published_payloads` with key `"breaking-feed.json"` — the same pattern used by all other frontend data (e.g., `"latest-trends.json"`, `"dashboard-overview.v2.json"`).

The frontend reads it using the existing `readSupabasePayload<BreakingFeed>("breaking-feed.json")` function in `web/lib/trends.ts`. No new table or API route needed for delivery.

The mini-pipeline **replaces** the payload on each run. If a topic ages out of the 2-hour window, it simply disappears on the next write.

### Contract definitions

**Python** (`app/exports/contracts.py`):

```python
@dataclass(frozen=True)
class BreakingTweetPayload:
    account: str
    text: str
    tweet_id: str
    timestamp: str  # ISO 8601
    engagement: float

@dataclass(frozen=True)
class BreakingItemPayload:
    topic: str
    breaking_score: float
    corroborated: bool
    account_count: int
    tweets: list[BreakingTweetPayload]

@dataclass(frozen=True)
class BreakingFeedPayload:
    updated_at: str  # ISO 8601
    items: list[BreakingItemPayload]
```

**TypeScript** (`web/lib/types.ts`):

```typescript
interface BreakingTweet {
  account: string;
  text: string;
  tweetId: string;
  timestamp: string;
  engagement: number;
}

interface BreakingItem {
  topic: string;
  breakingScore: number;
  corroborated: boolean;
  accountCount: number;
  tweets: BreakingTweet[];
}

interface BreakingFeed {
  updatedAt: string;
  items: BreakingItem[];
}
```

**Serializer** (`app/exports/serializers.py`): `serialize_breaking_feed(items: list[BreakingItemPayload], updated_at: datetime) -> BreakingFeedPayload` with snake_case-to-camelCase mapping matching the existing serializer pattern.

### Account list

Hardcoded in `app/sources/twitter_accounts.py`:

```python
@dataclass(frozen=True)
class TwitterAccount:
    handle: str
    tier: str       # "high" or "medium"
    verticals: tuple[str, ...]

TWITTER_ACCOUNTS: tuple[TwitterAccount, ...] = (
    TwitterAccount("elonmusk", "high", ("tech", "politics", "business")),
    TwitterAccount("BBCBreaking", "high", ("news", "politics", "world")),
    TwitterAccount("Polymarket", "medium", ("politics", "markets")),
    # ... ~40-50 accounts total
)
```

Tier affects relevance weighting in the fast path. Verticals help with topic categorization.

---

## Section 2: Tweet Fetcher & Scraping Layer

**Library:** `twscrape` — accesses Twitter's internal GraphQL API using throwaway account credentials.

### Architectural note

The fetcher (`twitter_scraper.py`) is a **standalone module** rather than a `SourceAdapter` subclass. This is intentional — it runs independently on a 60-second loop, writing to the database, whereas `SourceAdapter.fetch()` is designed for the synchronous pipeline. The existing `TwitterSourceAdapter` is refactored to read from the database, bridging the two patterns.

### Fetcher logic (`app/sources/twitter_scraper.py`)

- Iterate through accounts **sequentially** (gentle on rate limits)
- For each account, fetch latest 10 tweets
- **Early exit:** Compare most recent tweet ID against last stored tweet ID. If no new content, skip immediately
- Normalize into `RawSourceItem` format for pipeline compatibility
- Upsert new tweets into `twitter_tweets` table (INSERT ... ON CONFLICT(tweet_id) DO UPDATE for engagement/metadata)
- Run pruning (delete beyond 100 per account)

### Credentials

`TWITTER_SCRAPE_ACCOUNTS` env var — JSON string containing one or more account cookie sets. `twscrape` manages session rotation internally.

**Credential health:** If all credentials fail on 3 consecutive full runs, log at ERROR level. The system degrades gracefully (returns empty), but operators should monitor for sustained `twscrape` errors via Render logs. No automated rotation — when credentials expire, replace the env var manually.

### Resilience

- If `twscrape` fails for an individual account, log and continue to next
- If `twscrape` is fully broken (e.g., Twitter changes their API), the whole fetcher returns empty gracefully — same degradation pattern as other sources
- No retries per account — if it fails, the next 60-second cycle picks it up

### Expected runtime

With early-exit on unchanged accounts, a typical run where only a few accounts have new tweets should complete in **5-15 seconds**. Worst case (all 50 accounts have new content) maybe 30-45 seconds.

---

## Section 3: Render Background Worker & GitHub Actions Backup

### Render Worker (`scripts/run_twitter_loop.py`)

- `while True` loop with 60-second sleep
- Each iteration:
  1. Run tweet fetcher (5-15s typical)
  2. Run mini-pipeline: extract topics from new tweets, upsert breaking feed into `published_payloads`
  3. Log stats (accounts checked, new tweets found, duration)
- Deployed as a Render **Background Worker** (free tier)
- Connects to the same Postgres database via `SIGNAL_EYE_DATABASE_URL`

### Mini-pipeline (fast path)

**Input window:** Tweets from the last 2 hours (constant: `BREAKING_WINDOW_HOURS = 2`). This same constant controls both which tweets are considered and when items age out of the breaking feed.

- Runs topic extraction using the existing `extract_candidate_topics_for_item()` logic
- Groups by topic, counts how many accounts are talking about the same thing
- Computes breaking score (see formula below)
- Serializes results as `BreakingFeedPayload` and upserts into `published_payloads` with key `"breaking-feed.json"`

### Breaking score formula

```
breaking_score = tier_weight × log10(engagement + 1) × recency_factor × corroboration_boost
```

| Component | Value |
|---|---|
| `tier_weight` | high = 2.0, medium = 1.0 |
| `engagement` | likes + 2×retweets + replies (summed across all tweets for this topic) |
| `recency_factor` | `1.0 - (age_minutes / 120)` — linear decay over 2 hours, clamped to [0.1, 1.0] |
| `corroboration_boost` | `1.0 + (0.5 × (account_count - 1))` — +50% per additional account, capped at 3.0 |

Score range is roughly 0-20. Items are sorted by `breaking_score` descending.

### GitHub Actions Backup (`.github/workflows/refresh-twitter.yml`)

- Runs every 15 minutes (`*/15 * * * *`)
- Executes the same fetcher + mini-pipeline as a single run (not a loop)
- Acts as a safety net if the Render worker goes down
- Idempotent — if Render already fetched everything, the early-exit logic means this finishes in seconds

### Deduplication & concurrency

Both the worker and GH Actions write to the same `twitter_tweets` table with `tweet_id` as unique key, so concurrent runs are safe for tweet storage. The `published_payloads` upsert is atomic (single row update), so concurrent writes produce a consistent result — the last writer wins, which is fine since both compute the same output from the same data.

---

## Section 4: Main Pipeline Integration

### Twitter as a source in the 45-min cycle

- The existing `TwitterSourceAdapter` gets refactored — instead of calling the v2 API, it reads from the `twitter_tweets` table directly
- Returns the stored tweets as `RawSourceItem` objects, same as any other source
- No network calls needed — the data is already there from the fetcher loop

### Scoring weight

- Bump Twitter reliability in `catalog.py` from `0.45` to `0.85` (reflecting curated high-signal accounts, between Google Trends at 0.94 and current social sources)
- Change `experimental` from `True` to `False` — Twitter is now a first-class source
- Signal type stays `"social"` — it still contributes to the social component score
- The existing scoring adjustments (freshness, corroboration, diversity) naturally benefit Twitter since tweets are the freshest data in the system

### Topic extraction

- Uses existing per-source config (2 topics, 1 bigram per tweet)
- Tweets from news accounts tend to be headline-like, so entity span extraction should work well
- Tweets from commentary accounts (Musk, etc.) are more conversational — bigram/canonical extraction handles these

---

## Section 5: Frontend Breaking Feed

### Data delivery

- The Render worker upserts the breaking feed as a JSON payload into the existing `published_payloads` table with key `"breaking-feed.json"`
- The frontend reads it using the existing `readSupabasePayload<BreakingFeed>("breaking-feed.json")` in `web/lib/trends.ts` — the same mechanism used for all other data (latest trends, dashboard overview, etc.)
- No new API route or database table needed for delivery — this reuses the established Supabase PostgREST pattern
- A new `loadBreakingFeed()` function in `web/lib/trends.ts` wraps the call

### Dashboard display

- A "Breaking" section at the top of the dashboard (or a dedicated tab/panel)
- Shows topics with their source tweets, grouped when multiple accounts cover the same topic
- Corroborated items (2+ accounts) get visual emphasis
- Items age out naturally as the mini-pipeline replaces the payload each cycle (the 2-hour input window handles this)

### Refresh

The frontend re-fetches on page load and on tab focus. For more frequent updates, the dashboard can poll every 30-60 seconds. The payload is small (typically <10 items with a few tweets each).

---

## File Changes

### New files

| File | Purpose |
|---|---|
| `app/sources/twitter_accounts.py` | Curated account list (`TwitterAccount` dataclass + `TWITTER_ACCOUNTS` tuple) |
| `app/sources/twitter_scraper.py` | Standalone twscrape-based fetcher with early-exit, pruning |
| `scripts/run_twitter_loop.py` | Render background worker (60s loop + mini-pipeline) |
| `.github/workflows/refresh-twitter.yml` | 15-min backup cron |

### Modified files

| File | Change |
|---|---|
| `app/sources/twitter.py` | Refactor to read from `twitter_tweets` table instead of v2 API |
| `app/sources/catalog.py` | Bump Twitter reliability to 0.85, set `experimental=False` |
| `app/data/sqlite_migrations/` | Add `twitter_tweets` table migration |
| `app/data/postgres_migrations/` | Add `twitter_tweets` table migration |
| `app/data/repositories.py` | Add `TwitterTweetRepository` CRUD |
| `web/lib/trends.ts` | Add `loadBreakingFeed()` function using existing `readSupabasePayload` |
| `web/components/dashboard-shell.tsx` | Add breaking feed section |
| `web/lib/types.ts` | Add `BreakingFeed`, `BreakingItem`, `BreakingTweet` types |
| `app/exports/contracts.py` | Add `BreakingFeedPayload`, `BreakingItemPayload`, `BreakingTweetPayload` |
| `app/exports/serializers.py` | Add `serialize_breaking_feed()` |

### Infrastructure

- Render Background Worker (free tier)
- `TWITTER_SCRAPE_ACCOUNTS` env secret (Twitter account credentials for twscrape)
- GitHub Actions workflow (15-min cron)

### No changes to

Scoring formula, topic extraction logic, existing pipeline orchestration, or other source adapters.
