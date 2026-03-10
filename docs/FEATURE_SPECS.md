# Feature Specs — Competitor-Informed Additions

Five features identified from competitor analysis (Exploding Topics, Glimpse, Google
Trends, Treendly, SparkToro, TrendHunter, Semrush Trends, Similarweb). Each spec
is scoped to build on existing infrastructure with minimal new dependencies.

---

## 1. Webhook & Digest Alerts

### Problem

Trend-friend evaluates alert rules after every pipeline run and stores events in
`alert_events`, but delivery stops at the database. Users must open the dashboard
to see triggered alerts. Every major competitor ships some form of push notification
— Exploding Topics sends weekly emails, Glimpse fires real-time spike alerts,
Semrush EyeOn pushes competitor activity updates, Similarweb offers webhooks.

### Goal

After each pipeline run, deliver a summary of triggered alert events and notable
trend movements to one or more configured webhook URLs. Users wire the webhook to
Slack, Discord, email (via Zapier/n8n/Make), or their own services.

### Design

#### Data model

New table `notification_channels`:

```sql
CREATE TABLE notification_channels (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NULL,
    channel_type  TEXT NOT NULL,          -- "webhook"
    destination   TEXT NOT NULL,          -- URL
    label         TEXT NOT NULL DEFAULT '',
    enabled       INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

New table `notification_log` (audit trail):

```sql
CREATE TABLE notification_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id  INTEGER NOT NULL,
    sent_at     TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status_code INTEGER NULL,
    error       TEXT NULL,
    FOREIGN KEY (channel_id) REFERENCES notification_channels (id) ON DELETE CASCADE
);
```

#### Webhook payload shape

```json
{
  "event": "pipeline_run_complete",
  "runAt": "2026-03-10T14:30:00Z",
  "alerts": [
    {
      "ruleType": "score_above",
      "trendName": "AI agents",
      "threshold": 40,
      "currentValue": 52.3,
      "message": "AI agents score exceeded 40 (now 52.3)"
    }
  ],
  "digest": {
    "totalTrends": 100,
    "newEntries": ["quantum sensors", "solid-state batteries"],
    "biggestMovers": [
      { "name": "rust wasm", "rankChange": 12, "score": 38.7 }
    ],
    "breakouts": ["edge computing"]
  }
}
```

#### Backend changes

| File | Change |
|------|--------|
| `app/data/database.py` | Add `notification_channels` and `notification_log` tables |
| `app/data/repositories.py` | New `NotificationRepository` — CRUD for channels, append log |
| `app/notifications/deliver.py` | New module. `deliver_post_run_notifications(alert_events, digest_data, db)`. Iterates enabled channels, POSTs JSON, logs result. Timeout 10 s per hook. |
| `app/jobs/compute_scores.py` | Call `deliver_post_run_notifications()` after `_run_alert_evaluation()` |
| `app/api/routers/notifications.py` | New router. `GET /notifications/channels`, `POST /notifications/channels`, `DELETE /notifications/channels/{id}`, `POST /notifications/channels/{id}/test` |

#### Digest builder

New function `build_run_digest(current_scores, previous_scores, current_ranks, previous_ranks, statuses)` in `app/notifications/digest.py`:

- `newEntries`: topics in current that were not in previous
- `biggestMovers`: top 5 by absolute `rank_change`, minimum 3 positions
- `breakouts`: topics where `status == "breakout"`

This reuses the same previous-state capture already done in `_build_previous_state()`.

#### Frontend changes

| File | Change |
|------|--------|
| `web/components/dashboard-shell.tsx` | New "Notifications" section in settings area. Add/remove webhook URLs, test button, log of last 5 deliveries. |
| `web/lib/types.ts` | `NotificationChannel`, `NotificationLogEntry` types |

#### CLI fallback

`python3 main.py notify-test --url <webhook>` — sends a sample payload for
verification without running the full pipeline.

### Acceptance

- After a pipeline run that triggers at least one alert, the configured webhook
  receives a POST within 15 seconds.
- A failed webhook does not block or crash the pipeline. Errors are logged to
  `notification_log`.
- The test endpoint sends a sample payload and returns the HTTP status code.

### Test plan

- Unit: `deliver_post_run_notifications` with a mock HTTP server — verify payload
  shape, timeout handling, error logging.
- Unit: `build_run_digest` — verify new entries, movers, breakouts against known
  snapshot pairs.
- Integration: full pipeline run with a test webhook URL → assert log entry created.

---

## 2. Trend Forecasting

### Problem

Trend-friend detects what is hot *now* (breakout/rising/cooling labels from recent
momentum) but cannot project where a trend is heading. Exploding Topics shows
growth trajectories, Glimpse claims 87–95 % backtested accuracy on 12-month
forecasts, and Treendly offers forecast filtering. Users want to act on trends
*before* they peak, not just at peak.

### Goal

For each trend with sufficient history, produce a short-range forecast (next 5
pipeline runs) and display it as a dashed continuation on the existing detail
chart. Surface high-confidence upward forecasts in the explorer as a
"predicted breakout" badge.

### Design

#### Algorithm

Simple exponential smoothing (SES) — one tunable parameter (α), no external
dependencies, works well on short noisy series. For trends with ≥ 4 history
points:

```python
def ses_forecast(history: list[float], alpha: float = 0.4, horizon: int = 5) -> list[float]:
    """Exponential smoothing forecast. history is oldest-first scores."""
    level = history[0]
    for y in history[1:]:
        level = alpha * y + (1 - alpha) * level
    return [round(level, 2)] * horizon
```

For trends with ≥ 6 points, use Holt's linear trend method (double exponential
smoothing) to capture directional momentum:

```python
def holt_forecast(
    history: list[float],
    alpha: float = 0.4,
    beta: float = 0.3,
    horizon: int = 5,
) -> list[float]:
    level = history[0]
    trend = history[1] - history[0]
    for y in history[2:]:
        prev_level = level
        level = alpha * y + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
    return [round(level + (i + 1) * trend, 2) for i in range(horizon)]
```

#### Forecast confidence

Backtest on the available history using leave-one-out on the last 3 points.
Compute mean absolute percentage error (MAPE). Map to a confidence tier:

| MAPE | Confidence |
|------|-----------|
| < 10 % | high |
| 10–25 % | medium |
| > 25 % | low |

#### Data model

No new tables. Forecasts are computed on the fly from `trend_score_snapshots`
history. The detail payload gains a new field:

```python
@dataclass(frozen=True)
class TrendForecast:
    predicted_scores: list[float]     # next N runs
    confidence: str                   # "high" | "medium" | "low"
    mape: float                       # backtested error %
    method: str                       # "ses" | "holt"
```

#### Backend changes

| File | Change |
|------|--------|
| `app/scoring/forecast.py` | New module. `ses_forecast()`, `holt_forecast()`, `backtest_mape()`, `forecast_trend(history) -> TrendForecast \| None`. Returns None if < 4 data points. |
| `app/models.py` | Add `TrendForecast` dataclass. Add `forecast: TrendForecast \| None` to `TrendDetailRecord`. |
| `app/data/repositories.py` | In `list_trend_detail_records()`, call `forecast_trend()` per topic using existing history query. |
| `app/exports/serializers.py` | Serialize `forecast` field in detail payload. |
| `app/scoring/predictor.py` | Optionally incorporate forecast slope into breakout confidence as an additional weighted signal. |

#### Explorer integration

In `list_trend_explorer_records()`, compute forecast for trends with ≥ 4 history
points. Add a `forecastDirection` field to the explorer record:

- `"accelerating"` — forecast slope > 0 and confidence ≥ medium
- `"decelerating"` — forecast slope < 0 and confidence ≥ medium
- `null` — insufficient data or low confidence

#### Frontend changes

| File | Change |
|------|--------|
| `web/lib/types.ts` | Add `TrendForecast` type, add `forecast` to `TrendDetailRecord`, add `forecastDirection` to `TrendExplorerRecord`. |
| `web/components/trend-detail-chart.tsx` | Render forecast points as dashed line continuation after the last real data point. Color by confidence (green = high, amber = medium, grey = low). |
| `web/components/explorer-card.tsx` | Show small "↗ predicted" badge when `forecastDirection === "accelerating"`. |
| `web/app/globals.css` | `.forecast-line`, `.forecast-badge`, `.forecast-confidence-{high,medium,low}` |

### Acceptance

- Detail page chart shows dashed forecast line for trends with ≥ 4 history points.
- Explorer cards show "predicted" badge for accelerating trends with medium+ confidence.
- Forecast computation adds < 200 ms to detail payload generation (computed in-memory
  from already-loaded history).

### Test plan

- Unit: `ses_forecast` and `holt_forecast` against hand-computed expected values.
- Unit: `backtest_mape` returns 0 for a perfectly linear series.
- Unit: `forecast_trend` returns None for < 4 data points.
- Unit: confidence tier mapping (MAPE → high/medium/low).
- Integration: detail payload includes `forecast` field with correct shape.

---

## 3. Seasonality Detection

### Problem

The scoring engine treats every score spike as a potential breakout. Recurring
seasonal topics ("pumpkin spice" in September, "tax software" in April) generate
false-positive breakout signals. Google Trends implicitly handles this through
multi-year views, Glimpse explicitly tags seasonality patterns, and Similarweb
offers seasonal traffic analysis. Without seasonality awareness, trend-friend
over-ranks predictable cyclical interest.

### Goal

Tag trends that show recurring seasonal patterns and discount their breakout
signals accordingly. Surface seasonality as a visible label so users can
distinguish genuine emerging trends from calendar-driven spikes.

### Design

#### Detection approach

Compare the current run's score against the same calendar period in historical
data. Since trend-friend stores snapshots every 30 minutes (via scheduler), and
most deployments are days-to-weeks old, full annual seasonality detection requires
accumulated data. The system should start tagging as soon as it has ≥ 2 weeks of
history for a given topic, improving over time.

Phase 1 (implementable now): **Recurrence detection.** If a topic appeared in
the top 100, dropped out for ≥ 3 consecutive runs, then reappeared, flag it
as `"recurring"`. This catches topics that spike, vanish, and spike again.

Phase 2 (requires months of data): **Calendar correlation.** Compute a
periodicity score by checking whether topic appearances cluster around the
same day-of-week or week-of-month. Requires ≥ 60 days of snapshot history.

#### Data model

New columns on `trend_score_snapshots` (added via migration):

```sql
ALTER TABLE trend_score_snapshots ADD COLUMN seasonality_tag TEXT NULL;
-- values: NULL, "recurring", "seasonal", "evergreen"
```

New lightweight query in `TrendScoreRepository`:

```python
def get_topic_appearance_gaps(self, topic: str) -> list[int]:
    """Return gap lengths (in runs) between consecutive appearances."""
```

#### Seasonality classifier

New module `app/scoring/seasonality.py`:

```python
@dataclass(frozen=True)
class SeasonalityResult:
    tag: str | None          # "recurring" | "seasonal" | "evergreen" | None
    recurrence_count: int    # times topic has reappeared after gap
    avg_gap_runs: float      # average gap between appearances
    confidence: float        # 0.0–1.0

def classify_seasonality(
    appearances: list[datetime],
    gaps: list[int],
) -> SeasonalityResult:
    """
    Phase 1 rules:
    - recurring: reappeared after ≥ 3-run gap at least once
    - evergreen: appeared in > 80% of runs with no gaps > 2
    - None: insufficient data (< 5 appearances)
    """
```

#### Scoring integration

In `app/scoring/predictor.py`, adjust breakout confidence:

```python
if seasonality.tag == "recurring":
    confidence *= 0.6   # dampen breakout signal for recurring topics
elif seasonality.tag == "evergreen":
    confidence *= 0.85  # slight dampen for always-present topics
```

#### Backend changes

| File | Change |
|------|--------|
| `app/scoring/seasonality.py` | New module. `classify_seasonality()`, `SeasonalityResult`. |
| `app/models.py` | Add `SeasonalityResult` dataclass. Add `seasonality` field to `TrendDetailRecord` and `TrendExplorerRecord`. |
| `app/data/repositories.py` | Add `get_topic_appearance_gaps()`. Call `classify_seasonality()` when building detail/explorer records. |
| `app/scoring/predictor.py` | Apply seasonality dampening to breakout confidence. |
| `app/exports/serializers.py` | Serialize `seasonality` in detail and explorer payloads. |

#### Frontend changes

| File | Change |
|------|--------|
| `web/lib/types.ts` | `SeasonalityResult` type, add to detail and explorer types. |
| `web/components/explorer-card.tsx` | Show "↻ recurring" or "∞ evergreen" badge next to status pill when tagged. |
| `web/components/dashboard-shell.tsx` | Filter option: "Hide recurring" toggle to suppress seasonal noise. |
| `web/app/globals.css` | `.seasonality-badge`, `.seasonality-recurring`, `.seasonality-evergreen` |

### Acceptance

- Topics that drop out of the top 100 and reappear are tagged `"recurring"`.
- Recurring topics have their breakout confidence reduced by 40 %.
- Explorer supports filtering out recurring topics.
- Tagging adds no new tables (column addition only) and no external dependencies.

### Test plan

- Unit: `classify_seasonality` with known appearance/gap sequences → correct tags.
- Unit: breakout confidence dampening for recurring vs evergreen vs untagged.
- Unit: `get_topic_appearance_gaps` returns correct gap lengths.
- Integration: full pipeline run → recurring topic gets tagged in explorer payload.

---

## 4. CSV / Data Export

### Problem

Trend-friend generates JSON exports for its own frontend but offers no
user-facing data export. Exploding Topics offers CSV on paid tiers, Google Trends
has CSV/Excel download, Glimpse exports to Google Sheets, SparkToro supports
XLS/CSV, and Similarweb has a bulk data exporter plus REST API. Power users
(analysts, content creators, researchers) need to pull data into spreadsheets,
notebooks, or downstream pipelines.

### Goal

Add CSV download endpoints for the explorer (top 100 trends) and for individual
watchlists. Add a frontend "Download CSV" button on both surfaces.

### Design

#### CSV format — Explorer

Filename: `trend-friend-export-{date}.csv`

```csv
rank,name,category,status,score,social_score,developer_score,knowledge_score,search_score,diversity_score,rank_change,sources,first_seen,latest_signal
1,ai agents,AI/ML,rising,52.30,18.20,12.50,6.80,8.30,6.50,3,"reddit,hacker_news,github",2026-03-01T00:00:00Z,2026-03-10T14:00:00Z
```

Columns: rank, name, category, status, score, social_score, developer_score,
knowledge_score, search_score, diversity_score, rank_change, sources (comma-joined
within quotes), first_seen, latest_signal, geo_countries (if available),
volatility, forecast_direction (if forecast feature is implemented).

#### CSV format — Watchlist

Filename: `watchlist-{name}-{date}.csv`

Same columns as explorer, filtered to watchlist items only, with an additional
`added_at` column.

#### Backend changes

| File | Change |
|------|--------|
| `app/exports/csv_export.py` | New module. `trends_to_csv(trends: list[TrendExplorerRecord]) -> str` — returns CSV string using `csv.StringIO` + `csv.writer`. `watchlist_to_csv(items, trends) -> str` — joins watchlist items with current trend data. |
| `app/api/routers/exports.py` | New router. `GET /export/trends.csv` — returns `text/csv` with Content-Disposition header. `GET /export/watchlists/{id}.csv` — same for a specific watchlist. |
| `web/lib/trends.ts` | Add `downloadTrendsCsv()` and `downloadWatchlistCsv(id)` helpers that fetch the CSV endpoints and trigger browser download. |

#### Frontend changes

| File | Change |
|------|--------|
| `web/components/dashboard-shell.tsx` | "Export CSV" button in the explorer toolbar (next to filters). Calls `downloadTrendsCsv()`. |
| `web/components/dashboard-shell.tsx` | "Export" button on each watchlist card. Calls `downloadWatchlistCsv(id)`. |
| `web/app/globals.css` | `.export-button` styling (secondary/outline style, download icon via CSS). |

#### CLI fallback

`python3 main.py export-csv` — writes `trend-friend-export-{date}.csv` to
the current directory. Uses the same `trends_to_csv()` function.

#### Security

- No authentication required for explorer CSV (same data as the public dashboard).
- Watchlist CSV requires ownership check (same auth as watchlist API).
- Rate limit: 10 CSV downloads per minute per IP to prevent abuse.

### Acceptance

- Clicking "Export CSV" on the explorer downloads a well-formed CSV with all 100
  trends and correct headers.
- The CSV opens cleanly in Excel, Google Sheets, and Numbers without manual
  delimiter configuration.
- Watchlist export includes only tracked items with the `added_at` column.

### Test plan

- Unit: `trends_to_csv` — verify header row, correct column count, proper quoting
  of comma-containing fields (sources list).
- Unit: `watchlist_to_csv` — verify filtering to watchlist items only.
- Integration: `GET /export/trends.csv` returns 200 with `text/csv` content type
  and `Content-Disposition: attachment` header.
- Edge case: empty watchlist → CSV with header row only, no data rows.

---

## 5. Social Channel Breakdown

### Problem

Trend-friend shows which of its own sources (Reddit, HN, GitHub, Wikipedia)
contributed to a trend's score, but it doesn't indicate where the *broader public
conversation* is happening. Glimpse breaks down mentions across 8 social platforms
(TikTok, LinkedIn, Reddit, Instagram, Twitter/X, YouTube, Facebook, Pinterest).
SparkToro reveals audience media consumption patterns. A trend scoring high on
HN might simultaneously be exploding on YouTube or TikTok — and trend-friend
has no signal for that.

### Goal

Add lightweight social mention indicators that show users where else a trend is
being discussed beyond trend-friend's core sources. Start with free, no-auth-required
signals: YouTube search results and broader Reddit coverage (beyond the 5 hardcoded
subreddits).

### Design

#### New data sources

**YouTube Search Pulse** — For each top-N trend topic, query the YouTube
Data API v3 `search.list` endpoint (free tier: 10,000 units/day, search costs
100 units = 100 searches/day). Returns recent video count, total view estimates,
and channel diversity.

Alternatively, use YouTube RSS feeds (`https://www.youtube.com/feeds/videos.xml?search_query=...`)
which are free and unlimited but return less structured data. Start with RSS
for zero-cost operation, upgrade to API if the user configures a YouTube API key.

**Broad Reddit Search** — Use Reddit's search JSON endpoint
(`https://www.reddit.com/search.json?q=...&sort=new&limit=10`) to find mentions
across *all* subreddits, not just the 5 ingestion subs. Returns subreddit names,
post counts, and recency.

#### Data model

New table `social_mentions`:

```sql
CREATE TABLE social_mentions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    topic       TEXT NOT NULL,
    platform    TEXT NOT NULL,    -- "youtube", "reddit_broad", "tiktok", etc.
    mention_count INTEGER NOT NULL,
    top_subreddits_json TEXT NULL, -- for reddit_broad
    recent_video_count  INTEGER NULL, -- for youtube
    checked_at  TEXT NOT NULL,
    run_id      INTEGER NULL,
    FOREIGN KEY (run_id) REFERENCES trend_runs (id)
);
```

#### Social mention checker

New module `app/sources/social_pulse.py`:

```python
@dataclass(frozen=True)
class SocialMention:
    platform: str
    mention_count: int
    detail: dict[str, Any]  # platform-specific (subreddits, video count, etc.)
    checked_at: datetime

def check_youtube_pulse(topic: str, timeout: int = 5) -> SocialMention | None:
    """Query YouTube RSS for recent videos matching the topic."""

def check_reddit_broad(topic: str, timeout: int = 5) -> SocialMention | None:
    """Query Reddit search for cross-subreddit mentions."""

def check_social_pulse(
    topics: list[str],
    max_topics: int = 20,
) -> dict[str, list[SocialMention]]:
    """Check social mentions for top N topics. Rate-limited."""
```

#### Rate limiting and budgeting

- YouTube RSS: No limit, but add 1-second delay between requests.
- Reddit search: Respect Reddit rate limits (60 req/min for unauthenticated).
- Only check top 20 trends per run to stay within free-tier budgets.
- Cache results for 2 hours — skip re-check if `checked_at` is recent.

#### Pipeline integration

| File | Change |
|------|--------|
| `app/sources/social_pulse.py` | New module with YouTube RSS and Reddit search checkers. |
| `app/data/repositories.py` | New `SocialMentionRepository` — `save_mentions()`, `get_mentions(topic)`, `get_mentions_batch(topics)`. |
| `app/data/database.py` | Add `social_mentions` table. |
| `app/jobs/compute_scores.py` | After scoring, call `check_social_pulse()` for top 20 topics and persist results. Runs after export so it doesn't block the core pipeline. |
| `app/models.py` | Add `SocialMention` dataclass. Add `socialMentions: list[SocialMention]` to `TrendDetailRecord`. |
| `app/exports/serializers.py` | Serialize social mentions in detail payload. Add summary to explorer payload (`socialPlatforms: list[str]`). |

#### Frontend changes

| File | Change |
|------|--------|
| `web/lib/types.ts` | `SocialMention` type. Add `socialMentions` to detail type, `socialPlatforms` to explorer type. |
| `web/components/explorer-card.tsx` | Row of small platform icons/badges: "Also on: 🎥 YouTube · 💬 Reddit (12 subs)" |
| Trend detail page | New "Social Presence" section showing per-platform mention counts, top subreddits, recent video count. |
| `web/app/globals.css` | `.social-platforms`, `.platform-badge`, `.platform-youtube`, `.platform-reddit` |

#### Future expansion

The `social_mentions` table and `SocialMention` model are platform-agnostic.
Adding TikTok, LinkedIn, or Twitter/X later requires only a new checker function
in `social_pulse.py` — no schema changes needed. When APIs become available or
the user provides API keys, swap RSS for structured endpoints.

### Acceptance

- Top 20 trends show social mention data from YouTube and broad Reddit after each
  pipeline run.
- Explorer cards display platform badges for trends with detected social presence.
- Detail page shows mention counts and platform-specific context (subreddit names,
  video counts).
- Social pulse check adds < 60 seconds to the pipeline run (parallelized where
  possible, rate-limited).
- Missing or failed social checks do not block the pipeline or affect scoring.

### Test plan

- Unit: `check_youtube_pulse` with mocked RSS response → correct `SocialMention`.
- Unit: `check_reddit_broad` with mocked search JSON → correct mention count and
  subreddit list.
- Unit: `check_social_pulse` respects `max_topics` limit.
- Unit: caching — skip re-check when `checked_at` is within 2 hours.
- Integration: pipeline run → `social_mentions` table populated for top 20 topics.
- Edge case: network failure → returns None, pipeline continues unaffected.

---

## Implementation Priority

| # | Feature | Effort | New files | New tables | External deps |
|---|---------|--------|-----------|------------|---------------|
| 1 | Webhook & digest alerts | ~1 day | 3 | 2 | None |
| 2 | CSV export | ~0.5 day | 2 | 0 | None |
| 3 | Trend forecasting | ~1.5 days | 1 | 0 | None |
| 4 | Seasonality detection | ~1 day | 1 | 0 (column add) | None |
| 5 | Social channel breakdown | ~2 days | 1 | 1 | None (RSS) |

Suggested order: 2 → 1 → 3 → 4 → 5. CSV export is the quickest win. Webhooks
unlock the most user value. Forecasting and seasonality build on each other
(forecasting first, since seasonality can later adjust forecast confidence).
Social breakdown is the largest effort but the most differentiating.
