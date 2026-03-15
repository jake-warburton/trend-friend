# Twitter Breaking Feed Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add near-real-time Twitter integration that scrapes ~50 curated accounts every 60 seconds and surfaces breaking news immediately, while also feeding into the existing 45-min scoring pipeline.

**Architecture:** A standalone `twscrape`-based fetcher writes tweets to a `twitter_tweets` table. A Render background worker runs this every 60s, extracts topics, computes a breaking score, and upserts the result into the existing `published_payloads` table. The existing `TwitterSourceAdapter` is refactored to read from the database instead of calling the v2 API. GitHub Actions runs the same fetch every 15 min as a backup.

**Tech Stack:** Python 3.11, twscrape, PostgreSQL/SQLite, Next.js (App Router), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-15-twitter-breaking-feed-design.md`

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `app/sources/twitter_accounts.py` | `TwitterAccount` dataclass + `TWITTER_ACCOUNTS` tuple (~50 curated handles) |
| `app/sources/twitter_scraper.py` | Standalone fetcher: iterate accounts via twscrape, upsert tweets, prune |
| `app/jobs/breaking_feed.py` | Mini-pipeline: query recent tweets, extract topics, compute breaking scores, build payload, upsert into published_payloads |
| `scripts/run_twitter_loop.py` | Render background worker entry point: 60s loop calling fetcher + mini-pipeline |
| `scripts/run_twitter_once.py` | Single-shot entry point for GitHub Actions backup |
| `.github/workflows/refresh-twitter.yml` | 15-min cron workflow |
| `tests/test_twitter_scraper.py` | Tests for the fetcher (upsert, pruning, early exit, error handling) |
| `tests/test_breaking_feed.py` | Tests for the mini-pipeline (score formula, topic grouping, payload shape) |

### Modified files

| File | Change |
|---|---|
| `app/sources/twitter.py` | Refactor `TwitterSourceAdapter.fetch()` to read from `twitter_tweets` table |
| `app/sources/catalog.py:55` | Change Twitter: reliability `0.45` → `0.85`, `experimental=True` → `experimental=False` |
| `app/data/sqlite_migrations/0015_twitter_tweets.sql` | New migration: `twitter_tweets` table |
| `app/data/postgres_migrations/0015_twitter_tweets.sql` | New migration: `twitter_tweets` table |
| `app/data/repositories.py` | Add `TwitterTweetRepository` class |
| `app/exports/contracts.py` | Add `BreakingTweetPayload`, `BreakingItemPayload`, `BreakingFeedPayload` |
| `app/exports/serializers.py` | Add `build_breaking_feed_payload()` |
| `web/lib/types.ts` | Add `BreakingTweet`, `BreakingItem`, `BreakingFeed` types |
| `web/lib/trends.ts` | Add `loadBreakingFeed()` function |
| `web/components/dashboard-shell.tsx` | Add breaking feed section to dashboard |
| `app/config.py` | Add `twitter_scrape_accounts` setting |
| `app/jobs/ingest.py:69-70` | Remove experimental gate — Twitter is now always included |
| `tests/test_twitter.py` | Update tests for DB-backed adapter |
| `requirements.txt` | Add `twscrape` dependency |

---

## Chunk 1: Data Layer (migrations, repository, contracts, types)

### Task 1: Database migrations

**Files:**
- Create: `app/data/sqlite_migrations/0015_twitter_tweets.sql`
- Create: `app/data/postgres_migrations/0015_twitter_tweets.sql`

- [ ] **Step 1: Create SQLite migration**

```sql
-- app/data/sqlite_migrations/0015_twitter_tweets.sql
CREATE TABLE IF NOT EXISTS twitter_tweets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_handle TEXT NOT NULL,
    tweet_id TEXT UNIQUE NOT NULL,
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    engagement REAL NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_account_ts
    ON twitter_tweets (account_handle, timestamp DESC);
```

- [ ] **Step 2: Create Postgres migration**

```sql
-- app/data/postgres_migrations/0015_twitter_tweets.sql
CREATE TABLE IF NOT EXISTS twitter_tweets (
    id SERIAL PRIMARY KEY,
    account_handle TEXT NOT NULL,
    tweet_id TEXT UNIQUE NOT NULL,
    text TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    engagement DOUBLE PRECISION NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_account_ts
    ON twitter_tweets (account_handle, timestamp DESC);
```

- [ ] **Step 3: Commit**

```bash
git add app/data/sqlite_migrations/0015_twitter_tweets.sql app/data/postgres_migrations/0015_twitter_tweets.sql
git commit -m "feat: add twitter_tweets table migrations"
```

---

### Task 2: TwitterTweetRepository

**Files:**
- Modify: `app/data/repositories.py` (add new class after `PublishedPayloadRepository` ~line 184)
- Create: `tests/test_twitter_scraper.py` (repository tests)

- [ ] **Step 1: Write failing tests for the repository**

```python
# tests/test_twitter_scraper.py
"""Tests for Twitter scraper and repository."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.config import load_settings
from app.data.database import connect_database, initialize_database
from app.data.connection import DatabaseConnection


def _make_connection() -> DatabaseConnection:
    settings = load_settings()
    connection = connect_database(settings)
    initialize_database(connection)
    # Run migration manually for test DB
    import pathlib
    migration = pathlib.Path("app/data/sqlite_migrations/0015_twitter_tweets.sql").read_text()
    connection.executescript(migration)
    return connection


class TwitterTweetRepositoryTests(unittest.TestCase):

    def setUp(self) -> None:
        self.connection = _make_connection()
        from app.data.repositories import TwitterTweetRepository
        self.repo = TwitterTweetRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_upsert_and_fetch(self) -> None:
        self.repo.upsert_tweets([
            ("testuser", "t1", "Hello world", "2026-03-15T10:00:00Z", 100.0, "2026-03-15T10:01:00Z", "{}"),
        ])
        tweets = self.repo.fetch_recent_tweets(hours=2)
        self.assertEqual(len(tweets), 1)
        self.assertEqual(tweets[0]["tweet_id"], "t1")

    def test_upsert_updates_engagement(self) -> None:
        self.repo.upsert_tweets([
            ("testuser", "t1", "Hello world", "2026-03-15T10:00:00Z", 100.0, "2026-03-15T10:01:00Z", "{}"),
        ])
        self.repo.upsert_tweets([
            ("testuser", "t1", "Hello world", "2026-03-15T10:00:00Z", 500.0, "2026-03-15T10:05:00Z", "{}"),
        ])
        tweets = self.repo.fetch_recent_tweets(hours=2)
        self.assertEqual(len(tweets), 1)
        self.assertAlmostEqual(tweets[0]["engagement"], 500.0)

    def test_latest_tweet_id_for_account(self) -> None:
        self.repo.upsert_tweets([
            ("testuser", "t1", "First", "2026-03-15T10:00:00Z", 50.0, "2026-03-15T10:01:00Z", "{}"),
            ("testuser", "t2", "Second", "2026-03-15T11:00:00Z", 80.0, "2026-03-15T11:01:00Z", "{}"),
        ])
        latest = self.repo.latest_tweet_id("testuser")
        self.assertEqual(latest, "t2")

    def test_latest_tweet_id_unknown_account(self) -> None:
        result = self.repo.latest_tweet_id("nobody")
        self.assertIsNone(result)

    def test_prune_keeps_limit(self) -> None:
        tweets = [
            ("testuser", f"t{i}", f"Tweet {i}", f"2026-03-15T{10+i//60:02d}:{i%60:02d}:00Z", float(i), "2026-03-15T12:00:00Z", "{}")
            for i in range(105)
        ]
        self.repo.upsert_tweets(tweets)
        self.repo.prune_account("testuser", keep=100)
        count = self.connection.execute("SELECT COUNT(*) FROM twitter_tweets WHERE account_handle = ?", ("testuser",)).fetchone()[0]
        self.assertEqual(count, 100)

    def test_fetch_all_for_pipeline(self) -> None:
        self.repo.upsert_tweets([
            ("user1", "t1", "Tweet A", "2026-03-15T10:00:00Z", 100.0, "2026-03-15T10:01:00Z", "{}"),
            ("user2", "t2", "Tweet B", "2026-03-15T11:00:00Z", 200.0, "2026-03-15T11:01:00Z", "{}"),
        ])
        tweets = self.repo.fetch_all_tweets()
        self.assertEqual(len(tweets), 2)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_twitter_scraper.py -v`
Expected: FAIL — `TwitterTweetRepository` not found

- [ ] **Step 3: Implement TwitterTweetRepository**

Add to `app/data/repositories.py` after `PublishedPayloadRepository` (after line 184):

```python
class TwitterTweetRepository:
    """Persist and query scraped Twitter tweets."""

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def upsert_tweets(self, tweets: list[tuple[str, str, str, str, float, str, str]]) -> None:
        """Upsert tweets. Each tuple: (account_handle, tweet_id, text, timestamp, engagement, fetched_at, metadata)."""
        self.connection.executemany(
            """
            INSERT INTO twitter_tweets (account_handle, tweet_id, text, timestamp, engagement, fetched_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tweet_id)
            DO UPDATE SET
                engagement = excluded.engagement,
                metadata = excluded.metadata,
                fetched_at = excluded.fetched_at
            """,
            tweets,
        )
        self.connection.commit()

    def latest_tweet_id(self, account_handle: str) -> str | None:
        """Return the most recent tweet_id for an account, or None."""
        row = self.connection.execute(
            "SELECT tweet_id FROM twitter_tweets WHERE account_handle = ? ORDER BY timestamp DESC LIMIT 1",
            (account_handle,),
        ).fetchone()
        return row[0] if row else None

    def prune_account(self, account_handle: str, keep: int = 100) -> None:
        """Delete tweets beyond the keep limit for an account."""
        self.connection.execute(
            """
            DELETE FROM twitter_tweets
            WHERE account_handle = ? AND id NOT IN (
                SELECT id FROM twitter_tweets
                WHERE account_handle = ?
                ORDER BY timestamp DESC
                LIMIT ?
            )
            """,
            (account_handle, account_handle, keep),
        )
        self.connection.commit()

    def fetch_recent_tweets(self, hours: int = 2) -> list[dict]:
        """Fetch tweets from the last N hours."""
        from datetime import datetime, timedelta, timezone
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        rows = self.connection.execute(
            """
            SELECT account_handle, tweet_id, text, timestamp, engagement, metadata
            FROM twitter_tweets
            WHERE timestamp >= ?
            ORDER BY timestamp DESC
            """,
            (cutoff,),
        ).fetchall()
        return [
            {"account_handle": r[0], "tweet_id": r[1], "text": r[2], "timestamp": r[3], "engagement": r[4], "metadata": r[5]}
            for r in rows
        ]

    def fetch_all_tweets(self) -> list[dict]:
        """Fetch all stored tweets for pipeline ingestion."""
        rows = self.connection.execute(
            "SELECT account_handle, tweet_id, text, timestamp, engagement, metadata FROM twitter_tweets ORDER BY timestamp DESC"
        ).fetchall()
        return [
            {"account_handle": r[0], "tweet_id": r[1], "text": r[2], "timestamp": r[3], "engagement": r[4], "metadata": r[5]}
            for r in rows
        ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_twitter_scraper.py -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/data/repositories.py tests/test_twitter_scraper.py
git commit -m "feat: add TwitterTweetRepository with upsert, prune, fetch"
```

---

### Task 3: Contract dataclasses and TypeScript types

**Files:**
- Modify: `app/exports/contracts.py` (add after line 857)
- Modify: `app/exports/serializers.py` (add new builder function)
- Modify: `web/lib/types.ts` (add new types at end)
- Modify: `web/lib/trends.ts` (add `loadBreakingFeed()`)

- [ ] **Step 1: Add Python contract dataclasses**

Append to `app/exports/contracts.py` after the last function:

```python
@dataclass(frozen=True)
class BreakingTweetPayload:
    """Single tweet in the breaking feed."""

    account: str
    text: str
    tweet_id: str
    timestamp: str
    engagement: float


@dataclass(frozen=True)
class BreakingItemPayload:
    """Grouped breaking topic with source tweets."""

    topic: str
    breaking_score: float
    corroborated: bool
    account_count: int
    tweets: list[BreakingTweetPayload]


@dataclass(frozen=True)
class BreakingFeedPayload:
    """Breaking news feed payload."""

    updated_at: str
    items: list[BreakingItemPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""
        return {
            "updatedAt": self.updated_at,
            "items": [
                {
                    "topic": item.topic,
                    "breakingScore": item.breaking_score,
                    "corroborated": item.corroborated,
                    "accountCount": item.account_count,
                    "tweets": [
                        {
                            "account": tweet.account,
                            "text": tweet.text,
                            "tweetId": tweet.tweet_id,
                            "timestamp": tweet.timestamp,
                            "engagement": tweet.engagement,
                        }
                        for tweet in item.tweets
                    ],
                }
                for item in self.items
            ],
        }
```

- [ ] **Step 2: Add serializer function**

Add import at top of `app/exports/serializers.py`:
```python
from app.exports.contracts import (
    # ... existing imports ...
    BreakingFeedPayload,
    BreakingItemPayload,
    BreakingTweetPayload,
)
```

Add builder function at end of file:
```python
def build_breaking_feed_payload(
    updated_at: datetime,
    items: list[BreakingItemPayload],
) -> BreakingFeedPayload:
    """Create the breaking feed payload."""
    return BreakingFeedPayload(
        updated_at=to_timestamp(updated_at),
        items=items,
    )
```

- [ ] **Step 3: Add TypeScript types**

Append to `web/lib/types.ts`:
```typescript
export type BreakingTweet = {
  account: string;
  text: string;
  tweetId: string;
  timestamp: string;
  engagement: number;
};

export type BreakingItem = {
  topic: string;
  breakingScore: number;
  corroborated: boolean;
  accountCount: number;
  tweets: BreakingTweet[];
};

export type BreakingFeed = {
  updatedAt: string;
  items: BreakingItem[];
};
```

- [ ] **Step 4: Add loadBreakingFeed() to trends.ts**

Add to `web/lib/trends.ts` (near the other `load*` functions):
```typescript
export async function loadBreakingFeed(): Promise<BreakingFeed | null> {
  if (SUPABASE_PAYLOADS_ENABLED) {
    try {
      return await readSupabasePayload<BreakingFeed>("breaking-feed.json");
    } catch { /* fall through */ }
  }
  return null;
}
```

Also add `BreakingFeed` to the import from `./types` at the top of the file.

- [ ] **Step 5: Commit**

```bash
git add app/exports/contracts.py app/exports/serializers.py web/lib/types.ts web/lib/trends.ts
git commit -m "feat: add breaking feed contracts, serializer, and TS types"
```

---

## Chunk 2: Twitter Account List and Scraper

### Task 4: Twitter accounts list

**Files:**
- Create: `app/sources/twitter_accounts.py`

- [ ] **Step 1: Create the accounts module**

```python
# app/sources/twitter_accounts.py
"""Curated list of high-signal Twitter accounts for breaking news."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TwitterAccount:
    """A curated Twitter account to scrape."""

    handle: str
    tier: str  # "high" or "medium"
    verticals: tuple[str, ...]


TWITTER_ACCOUNTS: tuple[TwitterAccount, ...] = (
    # --- World leaders & political figures ---
    TwitterAccount("POTUS", "high", ("politics", "world")),
    TwitterAccount("VP", "high", ("politics", "world")),
    TwitterAccount("10DowningStreet", "high", ("politics", "world")),
    TwitterAccount("ZelenskyyUa", "high", ("politics", "world")),
    TwitterAccount("EmmanuelMacron", "medium", ("politics", "world")),
    TwitterAccount("naaboris", "medium", ("politics", "world")),
    # --- Tech & business leaders ---
    TwitterAccount("elonmusk", "high", ("tech", "politics", "business")),
    TwitterAccount("JeffBezos", "medium", ("tech", "business")),
    TwitterAccount("sataborya", "medium", ("tech", "business")),
    TwitterAccount("sama", "high", ("tech", "ai")),
    TwitterAccount("BillGates", "medium", ("tech", "business", "health")),
    TwitterAccount("tim_cook", "medium", ("tech", "business")),
    # --- Major news outlets ---
    TwitterAccount("BBCBreaking", "high", ("news", "politics", "world")),
    TwitterAccount("BBCWorld", "high", ("news", "world")),
    TwitterAccount("SkyNews", "high", ("news", "politics", "world")),
    TwitterAccount("CNN", "high", ("news", "politics", "world")),
    TwitterAccount("Reuters", "high", ("news", "world", "business")),
    TwitterAccount("AP", "high", ("news", "world")),
    TwitterAccount("naboris", "medium", ("news", "world")),
    TwitterAccount("FoxNews", "medium", ("news", "politics")),
    TwitterAccount("ABC", "medium", ("news", "world")),
    TwitterAccount("guardiannews", "medium", ("news", "politics", "world")),
    TwitterAccount("WSJ", "high", ("news", "business", "markets")),
    TwitterAccount("FT", "high", ("news", "business", "markets")),
    TwitterAccount("business", "medium", ("news", "business", "markets")),
    TwitterAccount("CNBC", "medium", ("news", "business", "markets")),
    # --- Tech news ---
    TwitterAccount("veraboris", "medium", ("tech", "consumer-tech")),
    TwitterAccount("TechCrunch", "medium", ("tech", "startup")),
    TwitterAccount("waboris", "medium", ("tech",)),
    # --- Markets & prediction ---
    TwitterAccount("Polymarket", "medium", ("politics", "markets")),
    TwitterAccount("zaboris", "medium", ("markets", "crypto")),
    # --- Science & health ---
    TwitterAccount("WHO", "medium", ("health", "world")),
    TwitterAccount("NASA", "medium", ("science", "tech")),
    # --- Sports ---
    TwitterAccount("ESPNaboris", "medium", ("sports",)),
    TwitterAccount("SkySportsNews", "medium", ("sports",)),
    # --- AI-specific voices ---
    TwitterAccount("AndrewYNg", "medium", ("ai", "tech")),
    TwitterAccount("ylecun", "medium", ("ai", "tech", "research")),
    TwitterAccount("karpathy", "medium", ("ai", "tech")),
    TwitterAccount("demaboris", "medium", ("ai", "tech")),
    TwitterAccount("GoogleDeepMind", "medium", ("ai", "research")),
    TwitterAccount("OpenAI", "high", ("ai", "tech")),
    TwitterAccount("AnthropicAI", "medium", ("ai", "tech")),
    TwitterAccount("xai", "medium", ("ai", "tech")),
)

# NOTE: This is a starter list. Handles should be verified against actual
# Twitter accounts and expanded to ~50. Some placeholder handles above
# (ending in "boris") need to be replaced with real handles.
```

- [ ] **Step 2: Commit**

```bash
git add app/sources/twitter_accounts.py
git commit -m "feat: add curated Twitter accounts list"
```

**NOTE for implementer:** The account list above contains placeholder handles. Before deploying, verify each handle is correct and replace any placeholders. The user should curate the final list of ~50 accounts.

---

### Task 5: Config setting for scrape credentials

**Files:**
- Modify: `app/config.py`

- [ ] **Step 1: Add twitter_scrape_accounts to Settings**

In `app/config.py`, add field to `Settings` dataclass (after `twitter_bearer_token`):
```python
twitter_scrape_accounts: Optional[str]
```

In `load_settings()`, add:
```python
twitter_scrape_accounts=os.getenv("TWITTER_SCRAPE_ACCOUNTS"),
```

- [ ] **Step 2: Commit**

```bash
git add app/config.py
git commit -m "feat: add twitter_scrape_accounts config setting"
```

---

### Task 6: Twitter scraper module

**Files:**
- Create: `app/sources/twitter_scraper.py`
- Modify: `tests/test_twitter_scraper.py` (add scraper tests)
- Modify: `requirements.txt`

- [ ] **Step 1: Add twscrape to requirements.txt**

Append `twscrape` to `requirements.txt`.

- [ ] **Step 2: Write failing tests for the scraper**

Append to `tests/test_twitter_scraper.py`:

```python
from unittest.mock import AsyncMock, patch, MagicMock
from app.sources.twitter_accounts import TwitterAccount, TWITTER_ACCOUNTS


class TwitterAccountsTests(unittest.TestCase):

    def test_accounts_list_is_not_empty(self) -> None:
        self.assertGreater(len(TWITTER_ACCOUNTS), 0)

    def test_accounts_have_valid_tiers(self) -> None:
        for account in TWITTER_ACCOUNTS:
            self.assertIn(account.tier, ("high", "medium"), f"{account.handle} has invalid tier")

    def test_accounts_have_verticals(self) -> None:
        for account in TWITTER_ACCOUNTS:
            self.assertGreater(len(account.verticals), 0, f"{account.handle} has no verticals")


class TwitterScraperTests(unittest.TestCase):

    def test_compute_engagement(self) -> None:
        from app.sources.twitter_scraper import compute_engagement
        result = compute_engagement(likes=100, retweets=50, replies=10)
        # likes + 2*retweets + replies = 100 + 100 + 10 = 210
        self.assertAlmostEqual(result, 210.0)

    def test_compute_engagement_zeros(self) -> None:
        from app.sources.twitter_scraper import compute_engagement
        self.assertAlmostEqual(compute_engagement(0, 0, 0), 0.0)
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest tests/test_twitter_scraper.py::TwitterScraperTests -v`
Expected: FAIL — `compute_engagement` not found

- [ ] **Step 4: Implement the scraper module**

```python
# app/sources/twitter_scraper.py
"""Standalone Twitter scraper using twscrape for curated account timelines."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.config import Settings
from app.data.connection import DatabaseConnection
from app.data.repositories import TwitterTweetRepository
from app.sources.twitter_accounts import TWITTER_ACCOUNTS

LOGGER = logging.getLogger(__name__)

TWEETS_PER_ACCOUNT = 10
PRUNE_KEEP = 100


def compute_engagement(likes: int, retweets: int, replies: int) -> float:
    """Compute engagement score: likes + 2*retweets + replies."""
    return float(likes) + float(retweets) * 2.0 + float(replies)


async def _fetch_account_tweets(api, handle: str, limit: int = TWEETS_PER_ACCOUNT):
    """Fetch recent tweets for a single account via twscrape."""
    tweets = []
    try:
        async for tweet in api.user_tweets(await _resolve_user_id(api, handle), limit=limit):
            tweets.append(tweet)
    except Exception as exc:
        LOGGER.warning("Failed to fetch tweets for @%s: %s", handle, exc)
    return tweets


async def _resolve_user_id(api, handle: str) -> int:
    """Resolve a handle to a Twitter user ID."""
    user = await api.user_by_login(handle)
    return user.id


async def scrape_twitter_accounts(
    settings: Settings,
    connection: DatabaseConnection,
) -> dict[str, int]:
    """Scrape curated accounts and upsert tweets. Returns stats dict."""
    import twscrape

    repo = TwitterTweetRepository(connection)
    stats = {"accounts_checked": 0, "new_tweets": 0, "skipped": 0, "errors": 0}

    accounts_json = settings.twitter_scrape_accounts
    if not accounts_json:
        LOGGER.error("TWITTER_SCRAPE_ACCOUNTS not set — skipping scrape")
        return stats

    api = twscrape.API()
    await api.pool.add_account(
        **json.loads(accounts_json) if accounts_json.startswith("{") else json.loads(accounts_json)[0]
    )
    await api.pool.login_all()

    for account in TWITTER_ACCOUNTS:
        stats["accounts_checked"] += 1
        try:
            latest_stored = repo.latest_tweet_id(account.handle)
            tweets = await _fetch_account_tweets(api, account.handle)

            if not tweets:
                stats["skipped"] += 1
                continue

            # Early exit: if newest tweet matches what we have, skip
            if latest_stored and str(tweets[0].id) == latest_stored:
                stats["skipped"] += 1
                continue

            rows = []
            for tweet in tweets:
                # Stop if we reach already-stored tweets
                if latest_stored and str(tweet.id) == latest_stored:
                    break
                engagement = compute_engagement(
                    getattr(tweet, "likeCount", 0) or 0,
                    getattr(tweet, "retweetCount", 0) or 0,
                    getattr(tweet, "replyCount", 0) or 0,
                )
                metadata = json.dumps({
                    "author_name": getattr(tweet.user, "username", account.handle) if hasattr(tweet, "user") else account.handle,
                    "tier": account.tier,
                    "verticals": list(account.verticals),
                })
                ts = tweet.date.isoformat() if hasattr(tweet, "date") and tweet.date else datetime.now(tz=timezone.utc).isoformat()
                rows.append((
                    account.handle,
                    str(tweet.id),
                    tweet.rawContent if hasattr(tweet, "rawContent") else str(tweet),
                    ts,
                    engagement,
                    datetime.now(tz=timezone.utc).isoformat(),
                    metadata,
                ))

            if rows:
                repo.upsert_tweets(rows)
                stats["new_tweets"] += len(rows)

            repo.prune_account(account.handle, keep=PRUNE_KEEP)

        except Exception as exc:
            LOGGER.warning("Error processing @%s: %s", account.handle, exc)
            stats["errors"] += 1

    return stats
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_twitter_scraper.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add app/sources/twitter_scraper.py tests/test_twitter_scraper.py requirements.txt
git commit -m "feat: add twscrape-based Twitter scraper with account iteration"
```

---

## Chunk 3: Breaking Feed Mini-Pipeline

### Task 7: Breaking score computation and mini-pipeline

**Files:**
- Create: `app/jobs/breaking_feed.py`
- Create: `tests/test_breaking_feed.py`

- [ ] **Step 1: Write failing tests for breaking score**

```python
# tests/test_breaking_feed.py
"""Tests for the breaking feed mini-pipeline."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone, timedelta


class BreakingScoreTests(unittest.TestCase):

    def test_basic_score_calculation(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        score = compute_breaking_score(
            tier="high",
            total_engagement=1000.0,
            age_minutes=30.0,
            account_count=1,
        )
        # tier_weight=2.0, log10(1001)≈3.0, recency=1-30/120=0.75, corroboration=1.0
        # 2.0 * 3.0 * 0.75 * 1.0 = 4.5
        self.assertGreater(score, 4.0)
        self.assertLess(score, 5.0)

    def test_corroboration_boost(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        single = compute_breaking_score("high", 1000.0, 30.0, 1)
        multi = compute_breaking_score("high", 1000.0, 30.0, 3)
        # corroboration_boost for 3 accounts = 1.0 + 0.5*2 = 2.0
        self.assertAlmostEqual(multi / single, 2.0, places=1)

    def test_corroboration_capped_at_3(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        five = compute_breaking_score("high", 1000.0, 30.0, 5)
        ten = compute_breaking_score("high", 1000.0, 30.0, 10)
        # Both should be capped at 3.0 corroboration boost
        self.assertAlmostEqual(five, ten)

    def test_medium_tier_lower_than_high(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        high = compute_breaking_score("high", 1000.0, 30.0, 1)
        medium = compute_breaking_score("medium", 1000.0, 30.0, 1)
        self.assertAlmostEqual(high / medium, 2.0, places=1)

    def test_recency_clamped_at_minimum(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        # age > 120 min should still have recency_factor >= 0.1
        old = compute_breaking_score("high", 1000.0, 200.0, 1)
        self.assertGreater(old, 0.0)


class BreakingFeedGroupingTests(unittest.TestCase):

    def test_group_tweets_by_topic(self) -> None:
        from app.jobs.breaking_feed import group_tweets_by_topic
        tweets_with_topics = [
            ({"account_handle": "BBCBreaking", "tweet_id": "1", "text": "Breaking: tariffs", "timestamp": "2026-03-15T10:00:00Z", "engagement": 5000.0, "metadata": '{"tier": "high"}'}, ["tariffs"]),
            ({"account_handle": "CNN", "tweet_id": "2", "text": "New tariffs announced", "timestamp": "2026-03-15T10:05:00Z", "engagement": 3000.0, "metadata": '{"tier": "high"}'}, ["tariffs"]),
            ({"account_handle": "elonmusk", "tweet_id": "3", "text": "SpaceX launch tomorrow", "timestamp": "2026-03-15T10:10:00Z", "engagement": 8000.0, "metadata": '{"tier": "high"}'}, ["spacex"]),
        ]
        groups = group_tweets_by_topic(tweets_with_topics)
        self.assertEqual(len(groups), 2)
        self.assertIn("tariffs", groups)
        self.assertEqual(len(groups["tariffs"]), 2)
        self.assertIn("spacex", groups)
        self.assertEqual(len(groups["spacex"]), 1)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_breaking_feed.py -v`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement breaking_feed.py**

```python
# app/jobs/breaking_feed.py
"""Breaking feed mini-pipeline: extract topics, score, and publish."""

from __future__ import annotations

import json
import logging
import math
from collections import defaultdict
from datetime import datetime, timezone

from app.config import Settings
from app.data.connection import DatabaseConnection
from app.data.repositories import PublishedPayloadRepository, TwitterTweetRepository
from app.exports.contracts import BreakingFeedPayload, BreakingItemPayload, BreakingTweetPayload
from app.exports.serializers import build_breaking_feed_payload
from app.models import RawSourceItem
from app.topics.extract import extract_candidate_topics_for_item

LOGGER = logging.getLogger(__name__)

BREAKING_WINDOW_HOURS = 2
BREAKING_FEED_KEY = "breaking-feed.json"

TIER_WEIGHTS = {"high": 2.0, "medium": 1.0}


def compute_breaking_score(
    tier: str,
    total_engagement: float,
    age_minutes: float,
    account_count: int,
) -> float:
    """Compute breaking score per the spec formula."""
    tier_weight = TIER_WEIGHTS.get(tier, 1.0)
    log_engagement = math.log10(total_engagement + 1)
    recency_factor = max(0.1, 1.0 - (age_minutes / 120.0))
    corroboration_boost = min(3.0, 1.0 + 0.5 * (account_count - 1))
    return tier_weight * log_engagement * recency_factor * corroboration_boost


def group_tweets_by_topic(
    tweets_with_topics: list[tuple[dict, list[str]]],
) -> dict[str, list[dict]]:
    """Group tweets by their extracted topics."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for tweet, topics in tweets_with_topics:
        for topic in topics:
            groups[topic].append(tweet)
    return dict(groups)


def build_breaking_items(
    grouped: dict[str, list[dict]],
    now: datetime,
) -> list[BreakingItemPayload]:
    """Build scored BreakingItemPayload list from grouped tweets."""
    items: list[BreakingItemPayload] = []
    for topic, tweets in grouped.items():
        accounts = set()
        total_engagement = 0.0
        min_age = float("inf")
        max_tier = "medium"
        tweet_payloads = []

        for tweet in tweets:
            handle = tweet["account_handle"]
            accounts.add(handle)
            total_engagement += tweet["engagement"]

            metadata = json.loads(tweet["metadata"]) if isinstance(tweet["metadata"], str) else (tweet["metadata"] or {})
            tier = metadata.get("tier", "medium")
            if tier == "high":
                max_tier = "high"

            ts = datetime.fromisoformat(tweet["timestamp"].replace("Z", "+00:00")) if isinstance(tweet["timestamp"], str) else tweet["timestamp"]
            age = (now - ts).total_seconds() / 60.0
            min_age = min(min_age, age)

            tweet_payloads.append(BreakingTweetPayload(
                account=handle,
                text=tweet["text"],
                tweet_id=tweet["tweet_id"],
                timestamp=tweet["timestamp"],
                engagement=tweet["engagement"],
            ))

        account_count = len(accounts)
        score = compute_breaking_score(max_tier, total_engagement, min_age, account_count)

        items.append(BreakingItemPayload(
            topic=topic,
            breaking_score=round(score, 2),
            corroborated=account_count >= 2,
            account_count=account_count,
            tweets=tweet_payloads,
        ))

    items.sort(key=lambda x: x.breaking_score, reverse=True)
    return items


def run_breaking_feed_pipeline(
    settings: Settings,
    connection: DatabaseConnection,
) -> int:
    """Run the breaking feed mini-pipeline. Returns number of breaking items published."""
    now = datetime.now(tz=timezone.utc)
    tweet_repo = TwitterTweetRepository(connection)
    payload_repo = PublishedPayloadRepository(connection)

    recent_tweets = tweet_repo.fetch_recent_tweets(hours=BREAKING_WINDOW_HOURS)
    if not recent_tweets:
        # Publish empty feed
        feed = build_breaking_feed_payload(now, [])
        feed_dict = feed.to_dict()
        payload_repo.replace_payloads([
            (BREAKING_FEED_KEY, feed_dict["updatedAt"], json.dumps(feed_dict)),
        ])
        return 0

    # Extract topics for each tweet
    tweets_with_topics: list[tuple[dict, list[str]]] = []
    for tweet in recent_tweets:
        item = RawSourceItem(
            source="twitter",
            external_id=tweet["tweet_id"],
            title=tweet["text"],
            url=f"https://x.com/i/status/{tweet['tweet_id']}",
            timestamp=datetime.fromisoformat(tweet["timestamp"].replace("Z", "+00:00")) if isinstance(tweet["timestamp"], str) else tweet["timestamp"],
            engagement_score=tweet["engagement"],
            metadata=json.loads(tweet["metadata"]) if isinstance(tweet["metadata"], str) else (tweet["metadata"] or {}),
        )
        topics = extract_candidate_topics_for_item(item)
        if topics:
            tweets_with_topics.append((tweet, topics))

    grouped = group_tweets_by_topic(tweets_with_topics)
    items = build_breaking_items(grouped, now)
    feed = build_breaking_feed_payload(now, items)
    feed_dict = feed.to_dict()

    payload_repo.replace_payloads([
        (BREAKING_FEED_KEY, feed_dict["updatedAt"], json.dumps(feed_dict)),
    ])

    LOGGER.info("Breaking feed: %d items published", len(items))
    return len(items)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_breaking_feed.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/jobs/breaking_feed.py tests/test_breaking_feed.py
git commit -m "feat: add breaking feed mini-pipeline with score computation"
```

---

## Chunk 4: Pipeline Integration and Catalog Update

### Task 8: Update catalog and refactor TwitterSourceAdapter

**Files:**
- Modify: `app/sources/catalog.py:55`
- Modify: `app/sources/twitter.py`
- Modify: `app/jobs/ingest.py:69-70`
- Modify: `tests/test_twitter.py`

- [ ] **Step 1: Update catalog entry**

In `app/sources/catalog.py`, change line 55 from:
```python
"twitter": SourceDefinition("twitter", "social", "social", 0.45, ("social", "general-interest"), experimental=True),
```
to:
```python
"twitter": SourceDefinition("twitter", "social", "social", 0.85, ("social", "general-interest")),
```

- [ ] **Step 2: Update ingest.py to always include Twitter**

In `app/jobs/ingest.py`, change lines 69-70 from:
```python
    if settings.enable_experimental_sources and settings.enable_twitter_source:
        adapters.append(TwitterSourceAdapter(settings))
```
to:
```python
    adapters.append(TwitterSourceAdapter(settings))
```

- [ ] **Step 3: Refactor TwitterSourceAdapter to read from DB**

Replace `app/sources/twitter.py` contents:

```python
"""Twitter/X source adapter — reads pre-scraped tweets from the database."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)


class TwitterSourceAdapter(SourceAdapter):
    """Read tweets from the twitter_tweets table populated by the scraper loop."""

    source_name = "twitter"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_from_database()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample(self.sample_payload())

    def _fetch_from_database(self) -> list[RawSourceItem]:
        """Read stored tweets from the database."""
        from app.data.primary import connect_primary_database
        from app.data.repositories import TwitterTweetRepository

        connection = connect_primary_database(self.settings)
        repo = TwitterTweetRepository(connection)
        tweets = repo.fetch_all_tweets()
        connection.close()

        items: list[RawSourceItem] = []
        for tweet in tweets[: self.settings.max_items_per_source]:
            metadata = json.loads(tweet["metadata"]) if isinstance(tweet["metadata"], str) else (tweet["metadata"] or {})
            ts_str = tweet["timestamp"]
            try:
                timestamp = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if isinstance(ts_str, str) else ts_str
            except (ValueError, TypeError):
                timestamp = datetime.now(tz=timezone.utc)

            items.append(RawSourceItem(
                source=self.source_name,
                external_id=tweet["tweet_id"],
                title=tweet["text"],
                url=f"https://x.com/i/status/{tweet['tweet_id']}",
                timestamp=timestamp,
                engagement_score=tweet["engagement"],
                metadata=metadata,
            ))
            self.raw_item_count += 1
            self.kept_item_count += 1

        return items

    @staticmethod
    def _normalize_sample(payload: dict[str, object]) -> list[RawSourceItem]:
        """Normalize sample data for fallback."""
        items: list[RawSourceItem] = []
        for tweet in payload.get("data", []):
            tweet_id = str(tweet.get("id", ""))
            text = str(tweet.get("text", "")).strip()
            if not text or not tweet_id:
                continue
            metrics = tweet.get("public_metrics", {})
            engagement = (
                float(metrics.get("like_count", 0))
                + float(metrics.get("retweet_count", 0)) * 2
                + float(metrics.get("reply_count", 0))
            )
            items.append(RawSourceItem(
                source="twitter",
                external_id=tweet_id,
                title=text,
                url=f"https://x.com/i/status/{tweet_id}",
                timestamp=datetime.now(tz=timezone.utc),
                engagement_score=engagement,
                metadata={"author_id": str(tweet.get("author_id", ""))},
            ))
        return items

    @staticmethod
    def sample_payload() -> dict[str, object]:
        """Return deterministic sample data for local fallback runs."""
        return {
            "data": [
                {
                    "id": "tw-1",
                    "text": "AI agents are transforming enterprise automation workflows at scale",
                    "created_at": "2026-03-09T12:00:00Z",
                    "author_id": "100001",
                    "public_metrics": {"like_count": 1200, "retweet_count": 450, "reply_count": 85},
                },
                {
                    "id": "tw-2",
                    "text": "Open source robotics framework reaches 10k stars on GitHub",
                    "created_at": "2026-03-09T14:30:00Z",
                    "author_id": "100002",
                    "public_metrics": {"like_count": 800, "retweet_count": 220, "reply_count": 42},
                },
                {
                    "id": "tw-3",
                    "text": "New machine learning technique reduces training costs by 60%",
                    "created_at": "2026-03-09T16:00:00Z",
                    "author_id": "100003",
                    "public_metrics": {"like_count": 650, "retweet_count": 180, "reply_count": 38},
                },
            ]
        }
```

- [ ] **Step 4: Update tests**

Replace `tests/test_twitter.py`:

```python
"""Tests for the Twitter/X source adapter."""

from __future__ import annotations

import unittest

from app.config import load_settings
from app.sources.twitter import TwitterSourceAdapter
from app.topics.extract import signal_type_for_source


class TwitterAdapterTests(unittest.TestCase):

    def setUp(self) -> None:
        self.settings = load_settings()
        self.adapter = TwitterSourceAdapter(self.settings)

    def test_sample_payload_has_required_fields(self) -> None:
        payload = self.adapter.sample_payload()
        self.assertIn("data", payload)
        tweets = payload["data"]
        self.assertGreater(len(tweets), 0)
        for tweet in tweets:
            self.assertIn("id", tweet)
            self.assertIn("text", tweet)
            self.assertIn("public_metrics", tweet)

    def test_normalize_sample_payload(self) -> None:
        payload = self.adapter.sample_payload()
        items = self.adapter._normalize_sample(payload)
        self.assertEqual(len(items), 3)
        for item in items:
            self.assertEqual(item.source, "twitter")
            self.assertTrue(item.title)
            self.assertTrue(item.url.startswith("https://x.com/"))
            self.assertGreater(item.engagement_score, 0)

    def test_fallback_produces_items(self) -> None:
        """Adapter without DB data falls back to sample data."""
        items = self.adapter.fetch()
        self.assertGreater(len(items), 0)

    def test_signal_type_maps_to_social(self) -> None:
        self.assertEqual(signal_type_for_source("twitter"), "social")

    def test_catalog_reliability_is_0_85(self) -> None:
        from app.sources.catalog import source_reliability_for_source, source_is_experimental
        self.assertAlmostEqual(source_reliability_for_source("twitter"), 0.85)
        self.assertFalse(source_is_experimental("twitter"))
```

- [ ] **Step 5: Run all tests to verify**

Run: `python -m pytest tests/test_twitter.py tests/test_twitter_scraper.py tests/test_breaking_feed.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add app/sources/catalog.py app/sources/twitter.py app/jobs/ingest.py tests/test_twitter.py
git commit -m "feat: refactor Twitter adapter to read from DB, bump reliability to 0.85"
```

---

## Chunk 5: Worker Scripts, GitHub Actions, and Frontend

### Task 9: Render worker and single-shot scripts

**Files:**
- Create: `scripts/run_twitter_loop.py`
- Create: `scripts/run_twitter_once.py`

- [ ] **Step 1: Create the loop script**

```python
# scripts/run_twitter_loop.py
"""Render Background Worker: scrape Twitter accounts every 60 seconds."""

from __future__ import annotations

import asyncio
import logging
import time

from app.config import load_settings
from app.data.primary import connect_primary_database
from app.jobs.breaking_feed import run_breaking_feed_pipeline
from app.sources.twitter_scraper import scrape_twitter_accounts

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
LOGGER = logging.getLogger(__name__)

LOOP_INTERVAL_SECONDS = 60


def main() -> None:
    settings = load_settings()
    LOGGER.info("Twitter loop starting — interval=%ds", LOOP_INTERVAL_SECONDS)

    while True:
        start = time.perf_counter()
        try:
            connection = connect_primary_database(settings)
            stats = asyncio.run(scrape_twitter_accounts(settings, connection))
            breaking_count = run_breaking_feed_pipeline(settings, connection)
            connection.close()
            elapsed = time.perf_counter() - start
            LOGGER.info(
                "Twitter loop: checked=%d new=%d skipped=%d errors=%d breaking=%d elapsed=%.1fs",
                stats["accounts_checked"],
                stats["new_tweets"],
                stats["skipped"],
                stats["errors"],
                breaking_count,
                elapsed,
            )
        except Exception:
            LOGGER.exception("Twitter loop iteration failed")

        time.sleep(LOOP_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create the single-shot script**

```python
# scripts/run_twitter_once.py
"""Single-shot Twitter scrape + breaking feed update (for GitHub Actions)."""

from __future__ import annotations

import asyncio
import logging

from app.config import load_settings
from app.data.primary import connect_primary_database
from app.jobs.breaking_feed import run_breaking_feed_pipeline
from app.sources.twitter_scraper import scrape_twitter_accounts

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
LOGGER = logging.getLogger(__name__)


def main() -> None:
    settings = load_settings()
    connection = connect_primary_database(settings)
    stats = asyncio.run(scrape_twitter_accounts(settings, connection))
    breaking_count = run_breaking_feed_pipeline(settings, connection)
    connection.close()
    LOGGER.info(
        "Twitter once: checked=%d new=%d skipped=%d errors=%d breaking=%d",
        stats["accounts_checked"],
        stats["new_tweets"],
        stats["skipped"],
        stats["errors"],
        breaking_count,
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Commit**

```bash
git add scripts/run_twitter_loop.py scripts/run_twitter_once.py
git commit -m "feat: add Render loop and single-shot Twitter scraper scripts"
```

---

### Task 10: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/refresh-twitter.yml`

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/refresh-twitter.yml
name: Refresh Twitter

on:
  workflow_dispatch:
  schedule:
    - cron: "*/15 * * * *"

concurrency:
  group: refresh-twitter
  cancel-in-progress: true

jobs:
  refresh:
    runs-on: ubuntu-latest
    env:
      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"
      SIGNAL_EYE_DATABASE_URL: ${{ secrets.SIGNAL_EYE_DATABASE_URL }}
      SIGNAL_EYE_ENABLE_POSTGRES_RUNTIME: "true"
      TWITTER_SCRAPE_ACCOUNTS: ${{ secrets.TWITTER_SCRAPE_ACCOUNTS }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Validate required secrets
        run: |
          if [ -z "${SIGNAL_EYE_DATABASE_URL}" ]; then
            echo "Missing required secret: SIGNAL_EYE_DATABASE_URL"
            exit 1
          fi
          if [ -z "${TWITTER_SCRAPE_ACCOUNTS}" ]; then
            echo "Missing required secret: TWITTER_SCRAPE_ACCOUNTS"
            exit 1
          fi

      - name: Scrape Twitter and update breaking feed
        run: python3 scripts/run_twitter_once.py
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/refresh-twitter.yml
git commit -m "feat: add 15-min GitHub Actions cron for Twitter backup"
```

---

### Task 11: Frontend breaking feed section

**Files:**
- Modify: `web/components/dashboard-shell.tsx`

This task is intentionally high-level because `dashboard-shell.tsx` is a 158KB monolith. The implementer should:

- [ ] **Step 1: Read the dashboard shell to understand the layout**

Read `web/components/dashboard-shell.tsx` to find where the main dashboard content begins (look for the overview/landing section). The breaking feed section should appear at the top, before existing content.

- [ ] **Step 2: Add breaking feed data loading**

In the dashboard's data loading logic, add a call to `loadBreakingFeed()` and pass the result as state/props to a new `BreakingFeedSection` component (defined inline in the same file, following the existing pattern).

- [ ] **Step 3: Implement the breaking feed UI**

Create a `BreakingFeedSection` component within `dashboard-shell.tsx` that:
- Shows nothing if the feed is empty or null
- Displays a "Breaking" heading with a pulsing red dot indicator
- Lists items sorted by `breakingScore` descending
- For each item: shows the topic, the source tweets (account + text), and a "corroborated" badge if `corroborated === true`
- Each tweet links to `https://x.com/i/status/{tweetId}`
- Items are styled to look urgent but not overwhelming

- [ ] **Step 4: Add polling for freshness**

Add a `useEffect` with a 60-second interval that re-fetches `loadBreakingFeed()` and a `visibilitychange` listener for tab focus refresh.

- [ ] **Step 5: Commit**

```bash
git add web/components/dashboard-shell.tsx
git commit -m "feat: add breaking feed section to dashboard"
```

---

### Task 12: Final integration test

- [ ] **Step 1: Run full Python test suite**

Run: `python -m unittest discover -s tests`
Expected: All tests PASS

- [ ] **Step 2: Run TypeScript tests**

Run: `cd web && node --import tsx --test tests/**/*.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Verify frontend builds**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve integration issues from Twitter breaking feed"
```
