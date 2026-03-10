# Improvement Plans

Plans for the next phase of Trend Friend development. Each plan is self-contained with scope, implementation steps, and effort estimates. The final section provides a prioritized roadmap across all plans.

---

## Plan 1: Google Trends Adapter

### Why

Search data is the single biggest signal gap. Every competitor (Exploding Topics, Treendly, Google Trends itself) relies on search interest as a core signal. The scoring system already has a `search_weight` field but it's set to `0.0` because no adapter feeds it. Adding this source would immediately differentiate the scoring from a pure social/developer signal aggregator.

### Scope

- New source adapter at `app/sources/google_trends.py`
- Fallback sample data for offline/rate-limited runs
- Register in `app/jobs/ingest.py`
- Activate `search_weight` in `app/scoring/weights.py`

### Implementation Steps

1. **Research free access options.** Google Trends has no official REST API. Options:
   - `pytrends` library (unofficial, scrapes Google Trends) — free, widely used, but rate-limited and fragile
   - SerpAPI Google Trends endpoint — freemium, more stable but has quota limits
   - Pre-seeded trending queries from Google Trends RSS/Atom feeds
   - Recommendation: start with `pytrends` for MVP; add SerpAPI as a fallback later

2. **Create `GoogleTrendsSourceAdapter`** following the existing pattern:
   - Extend `SourceAdapter` base class
   - `source_name = "google_trends"`
   - `fetch()` queries rising searches and interest-over-time for broad categories
   - `normalize_items()` maps results to `RawSourceItem` with `engagement_score` derived from search interest value
   - `sample_payload()` returns deterministic fallback data

3. **Query strategy:**
   - Fetch "trending searches" (daily/realtime) for general discovery
   - Fetch "interest over time" for topics already discovered by other sources (cross-validation)
   - Use broad categories initially: Technology, Business, Science
   - Limit to 5-10 queries per run to stay under rate limits

4. **Update scoring weights:**
   - Set `search_weight` to `0.25` (rebalance others proportionally)
   - The `scaled_component_score` function already handles `search` signal type — just needs data flowing in

5. **Add `pytrends` to `requirements.txt`**

6. **Tests:**
   - Unit test normalization with fixture data
   - Unit test fallback path
   - Integration test with sample payload

### Effort

Medium (2-3 days). The adapter pattern is well-established. Main risk is `pytrends` reliability and rate limiting.

### Dependencies

None. Can be built independently.

---

## Plan 2: Historical Trend Charts

### Why

Understanding trend trajectory is the core value proposition. A snapshot ranking is useful but a chart showing "this topic went from rank 15 to rank 2 over 10 days" is dramatically more compelling. This is what Exploding Topics does best — the growth curve is the product.

### Scope

- Frontend chart components on trend detail pages
- Chart data on the dashboard overview page
- Historical sparklines in the trend explorer list
- Backend: data already exists in `trend_score_snapshots` table

### Current State

The backend already stores historical snapshots (`trend_score_snapshots` table, `TrendHistoryPoint` model, `trend-history.json` export). The `TrendDetailRecord` already contains a `history` list. The serializer already outputs `TrendHistoryPointPayload`. **The data pipeline is ready — this is purely a frontend task.**

### Implementation Steps

1. **Choose a chart library.** Options:
   - Recharts — React-native, composable, good for dashboards, lightweight
   - Chart.js via react-chartjs-2 — heavier but battle-tested
   - Nivo — beautiful defaults, more opinionated
   - Recommendation: **Recharts** — fits the Next.js/React stack, small bundle, simple API

2. **Trend detail page (`web/app/trends/[slug]/page.tsx`):**
   - Add a score-over-time line chart using `history` data
   - X-axis: `captured_at` timestamps
   - Y-axis: `score_total`
   - Secondary Y-axis or tooltip: `rank`
   - Include score component breakdown as stacked area (social, developer, knowledge, search, diversity)

3. **Dashboard overview page:**
   - Add a "Top Trends Over Time" multi-line chart showing top 5 trends' score trajectories
   - Use the `charts.top_trend_scores` data already being exported

4. **Explorer list sparklines:**
   - Add inline SVG sparklines (or Recharts `<Sparkline>`) next to each trend in the explorer table
   - Show last 10 data points of `score_total`
   - Requires the explorer payload to include mini-history (add `recent_history: TrendHistoryPointPayload[]` to `TrendExplorerRecordPayload`)

5. **Backend change for sparklines:**
   - Extend `build_trend_explorer_payload` to include last 10 history points per trend
   - Extend `TrendExplorerRecordPayload` with `recent_history` field
   - Update `serialize_explorer_trend` to populate it

6. **Tests:**
   - Snapshot tests for chart components
   - Verify serializer includes history data

### Effort

Medium (3-4 days). Chart library integration is straightforward. Most time goes to UX polish — axis formatting, responsive sizing, loading states.

### Dependencies

None. Data layer is ready.

---

## Plan 3: Scheduled Ingestion

### Why

Without automation, the tool only updates when someone manually runs `python main.py`. A trend detection tool that doesn't continuously monitor is fundamentally limited. Competitors run continuously; Trend Friend should too.

### Scope

- Scheduled pipeline execution (configurable interval)
- Lightweight, no external infrastructure required
- Health monitoring so failed runs are visible
- Clean shutdown handling

### Implementation Steps

1. **Choose a scheduling approach.** Options:
   - System cron — simplest, no code changes, but invisible to the app
   - Python `schedule` library — in-process, simple loop
   - APScheduler — more robust, supports cron expressions, missed job handling
   - Simple `while True` + `time.sleep()` loop — minimal dependencies
   - Recommendation: **`schedule` library** for simplicity, with a `scripts/run_scheduler.py` entrypoint. Fall back to system cron as documented alternative.

2. **Create `scripts/run_scheduler.py`:**
   ```python
   # Runs the pipeline on a configurable interval
   # Default: every 30 minutes
   # Configurable via TREND_FRIEND_POLL_INTERVAL_MINUTES env var
   ```

3. **Add configuration:**
   - `poll_interval_minutes` to `Settings` (default: 30)
   - `TREND_FRIEND_POLL_INTERVAL_MINUTES` env var

4. **Add health file output:**
   - After each successful run, write a `data/last_run.json` with timestamp, status, duration
   - The web dashboard can read this to show "last updated X minutes ago" with a stale warning

5. **Add clean shutdown:**
   - Handle SIGTERM/SIGINT gracefully
   - Complete current run before exiting
   - Log shutdown reason

6. **Document both approaches in README:**
   - `scripts/run_scheduler.py` for always-on process
   - Cron example for system-level scheduling
   - Docker/systemd hints for production

7. **Add `schedule` to `requirements.txt`**

8. **Tests:**
   - Unit test scheduler configuration parsing
   - Unit test health file writing

### Effort

Small (1-2 days). The pipeline already works end-to-end. This is orchestration wrapper code.

### Dependencies

None. Can be built independently.

---

## Plan 4: Sector Categorization

### Why

Exploding Topics' key feature is browsing trends by category (AI, Fintech, Health, etc.). Without categorization, all trends appear in one flat list. Categories enable:
- Filtering by interest area
- Sector-level meta analysis ("AI sector is heating up")
- Content creators finding trends in their niche

### Current State

The `TrendExplorerRecord` and `TrendDetailRecord` models already have a `category` field. The dashboard overview already builds `meta_trends` grouped by category. **However**, the actual categorization logic needs examination — it may be placeholder or rule-based.

### Implementation Steps

1. **Audit current categorization.** Check how `category` is currently assigned in the pipeline. It likely comes from `app/topics/` or `app/scoring/ranking.py`.

2. **Define a category taxonomy:**
   ```
   AI & Machine Learning
   Developer Tools
   Fintech & Crypto
   Health & Biotech
   Consumer Tech
   Enterprise & SaaS
   Science & Research
   Energy & Climate
   Gaming & Entertainment
   Other
   ```
   Keep it to 8-12 categories max. Store as a named constant in `app/topics/categorize.py`.

3. **Implement keyword-based categorization:**
   - Create `app/topics/categorize.py`
   - Map keywords/patterns to categories (e.g., "llm", "gpt", "neural" -> "AI & Machine Learning")
   - Use evidence text and topic name for matching
   - Assign "Other" as fallback
   - This is the KISS approach — no ML needed for MVP

4. **Integrate into pipeline:**
   - Call categorization after topic extraction, before scoring
   - Store category in the signals/scores tables (add column if needed)
   - Pass through to serializers (already have the field)

5. **Frontend: category filter on explorer page:**
   - Add category dropdown/pill filter to the explorer
   - Filter client-side (payload is small)
   - Show category badge on trend cards

6. **Frontend: category overview on dashboard:**
   - The `meta_trends` section already exists — ensure it's rendered prominently
   - Add click-through from category summary to filtered explorer view

7. **Tests:**
   - Unit test keyword-to-category mapping
   - Test edge cases (topic matching multiple categories, unknown topics)
   - Test category distribution isn't overly skewed to "Other"

### Effort

Medium (2-3 days). Keyword mapping is straightforward. Frontend filter is simple client-side logic.

### Dependencies

None. Can be built independently. Benefits from more data sources feeding in.

---

## Plan 5: Alerts System

### Why

Proactive notifications turn Trend Friend from a tool you check into a tool that reaches out to you. "AI Agents just hit breakout status" or "Your watchlist item jumped 5 ranks" are high-value notifications. The database schema for `alert_rules` and `watchlists` already exists.

### Current State

- `alert_rules` and `watchlists` tables exist in the database
- `AlertRule` and `Watchlist` models exist in `app/models.py`
- `web/app/api/alerts/route.ts` and `web/app/api/watchlists/route.ts` API routes exist
- The data layer and API surface are partially scaffolded but alert evaluation and delivery are not implemented

### Implementation Steps

1. **Define supported alert rule types:**
   - `score_above` — trend score exceeds threshold
   - `rank_change` — trend moves up by N or more ranks
   - `new_breakout` — trend status changes to "breakout"
   - `new_trend` — a topic appears for the first time
   - Store as an enum/constant in a new `app/alerts/` module

2. **Create alert evaluation engine (`app/alerts/evaluate.py`):**
   - After each pipeline run, evaluate all enabled alert rules against current state
   - Compare current scores/ranks to previous run
   - Return a list of `AlertEvent` dataclass instances (rule_id, trend_id, message, triggered_at)

3. **Create alert storage:**
   - Add `alert_events` table to database schema
   - Store triggered alerts with read/unread status
   - Repository functions: `save_alert_events()`, `get_unread_alerts()`, `mark_alerts_read()`

4. **Integrate into pipeline:**
   - After scoring and ranking, run alert evaluation
   - Persist any triggered events

5. **Alert delivery — Phase 1 (in-app):**
   - Export unread alerts in the dashboard JSON payload
   - Show notification badge/bell in the web dashboard header
   - Alert drawer or dropdown showing recent alerts with links to trends

6. **Alert delivery — Phase 2 (optional, future):**
   - Email via SMTP (configurable)
   - Webhook POST to arbitrary URL (Slack, Discord, Zapier)
   - These are nice-to-haves that don't block the core feature

7. **Frontend: alert management UI:**
   - View/dismiss alerts on dashboard
   - Create/edit alert rules from watchlist pages
   - Toggle rules enabled/disabled

8. **Tests:**
   - Unit test each rule type evaluation
   - Test alert deduplication (don't re-fire same alert)
   - Test with no previous run data (first run edge case)

### Effort

Medium-Large (3-5 days). The data scaffolding exists. Main work is the evaluation engine, pipeline integration, and frontend notification UX.

### Dependencies

- Benefits from scheduled ingestion (Plan 3) — alerts are only useful if the pipeline runs automatically
- Benefits from historical data — rank change alerts need previous run state

---

## Plan 6: Additional Social Sources (Twitter/X)

### Why

The signals research doc lists Twitter/X and TikTok as desired social sources. Twitter/X is particularly valuable because tech trends often break there first (product launches, viral threads, tech discourse). Adding it strengthens the "multi-signal" differentiator vs. single-source competitors like Treendly.

### Scope

- Twitter/X source adapter
- TikTok is deprioritized (API access is restrictive and content is less tech-focused)

### Implementation Steps

1. **Assess API access options:**
   - Twitter/X API v2 Free tier — 1 app, read-only, 1500 tweets/month read — **very limited**
   - Twitter/X API v2 Basic tier — $100/month, 10k tweets/month read — possible but has cost
   - Nitter instances (scraping) — free but unreliable, instances shutting down
   - Alternative: **social listening proxies** like Social Searcher (free tier), or RSS feeds of curated Twitter lists
   - Recommendation: Start with the **free tier** for a focused set of queries. If rate-limited, fall back to sample data like other adapters. Evaluate Basic tier later based on value.

2. **Create `TwitterSourceAdapter` (`app/sources/twitter.py`):**
   - Extend `SourceAdapter`
   - `source_name = "twitter"`
   - Query recent tweets for tech/startup trending topics
   - Use "recent search" endpoint with curated queries (e.g., "trending in tech", "new startup", "AI breakthrough")
   - Normalize into `RawSourceItem` with engagement = likes + retweets + replies
   - Include sample fallback data

3. **Configuration:**
   - Add `twitter_bearer_token` to `Settings`
   - Add `TWITTER_BEARER_TOKEN` env var
   - Make the adapter skip gracefully if token is not configured (like GitHub token)

4. **Register in `app/jobs/ingest.py`:**
   - Add to adapters list, conditionally based on token availability
   - The adapter's signal type maps to "social" in scoring (same as Reddit)

5. **Update scoring considerations:**
   - Twitter signals feed into `social_score` alongside Reddit
   - No weight changes needed — the existing social weight covers both
   - Diversity score naturally increases when Twitter provides independent corroboration

6. **Tests:**
   - Unit test normalization with fixture response
   - Unit test fallback path
   - Test conditional registration (no token = skip, not crash)

### Effort

Medium (2-3 days). Follows established adapter pattern. Main risk is API access limitations and rate constraints.

### Dependencies

None. Can be built independently. Pairs well with the scoring weight rebalance in Plan 1.

---

## Plan 7: Prioritized Roadmap

### Guiding Principles

- Maximize signal quality first (data sources), then improve presentation (charts, categories), then add proactive features (alerts, scheduling)
- Each increment should deliver standalone value
- Maintain the "free to run" constraint
- Keep each phase deployable — no multi-week blocked dependencies

### Recommended Sequence

#### Phase A: Foundation (Week 1-2)

| Priority | Plan | Rationale |
|----------|------|-----------|
| **A1** | **Scheduled Ingestion** (Plan 3) | Unblocks everything. Without automation, no alerts work, history doesn't accumulate, and the tool requires manual babysitting. Smallest effort, highest leverage. |
| **A2** | **Google Trends Adapter** (Plan 1) | Fills the biggest data gap. Activates the dormant `search_score` component. Makes the multi-signal promise real. |

**Milestone:** The system runs unattended every 30 minutes and produces scores informed by search + social + developer + knowledge signals.

#### Phase B: Intelligence (Week 3-4)

| Priority | Plan | Rationale |
|----------|------|-----------|
| **B1** | **Sector Categorization** (Plan 4) | Organizes the growing trend data into navigable categories. Low effort, high UX impact. Needed before the trend list gets unwieldy. |
| **B2** | **Historical Trend Charts** (Plan 2) | Backend data is already accumulating (especially after Phase A enables scheduled runs). Charts make the historical data visible. This is the feature that makes people understand trend momentum at a glance. |

**Milestone:** Users can browse categorized trends with visual trajectory charts. The dashboard feels like a real product.

#### Phase C: Engagement (Week 5-6)

| Priority | Plan | Rationale |
|----------|------|-----------|
| **C1** | **Alerts System** (Plan 5) | Now that the system runs automatically and has enough data richness, alerts add proactive value. Users get notified instead of having to check. |
| **C2** | **Twitter/X Adapter** (Plan 6) | Adds another high-value social signal. By this point the pipeline is robust and the scoring is tuned, so a new source integrates cleanly. |

**Milestone:** The tool proactively notifies users of important trend movements and covers 5+ independent data sources.

### Risk-Adjusted Notes

- **Plan 1 (Google Trends)** carries the most technical risk due to `pytrends` fragility. If it proves too unreliable, consider a lighter approach: RSS feeds of Google Trends daily/realtime trending searches rather than programmatic queries.
- **Plan 6 (Twitter/X)** carries cost risk if the free tier proves too limiting. Scope the initial implementation to work within 1500 tweets/month — roughly 50 tweets per run at 30 runs/month.
- **Plan 5 (Alerts)** is the largest effort. If time is tight, ship in-app alerts first (notification badge) and defer email/webhook delivery.
- **Plans 3 and 4** are low-risk and can be completed quickly — consider tackling them first even if working on Plan 1 in parallel.

### What Comes After

These plans complete the "competitive parity" gap. Beyond this, the next tier of differentiation would be:
- **Predictive scoring** — forecasting which rising trends will break out (ML-based)
- **Opportunity scoring** — "how actionable is this trend for content/products/investment"
- **Community features** — shared watchlists, public trend pages

---

## Plan 8: Python REST API (Replace JSON File Transport)

### Why

The current architecture has Python write static JSON files to disk (`web/data/*.json`), which Next.js reads via filesystem calls. The refresh button shells out to `python3 scripts/run_ingestion.py` via `child_process`. This works for local dev but is fundamentally undeployable:

- **No independent scaling.** Frontend and backend are welded together by a shared filesystem.
- **No concurrent access safety.** If a pipeline run is writing JSON while the frontend reads, partial reads are possible.
- **No real-time capability.** Polling a file is a dead end for live updates, websockets, or SSE.
- **No external consumers.** The data can only be consumed by code that shares the same disk.
- **Painful `to_dict()` methods.** The contracts layer (`app/exports/contracts.py`) has ~530 lines of manual `snake_case` → `camelCase` key renaming. A proper API framework handles serialization natively.

This is the architectural migration already anticipated in `docs/WEB_DASHBOARD_PLAN.md` (Phase 5). The contracts and serializers were explicitly designed as a "future API schema." Now is the time to deliver on that promise.

### Current Data Flow

```
Python pipeline → serializers → JSON files on disk → Next.js fs.readFile() → Next.js API routes → Browser
                                                    ↑
                                          refresh button shells out to python3
```

### Target Data Flow

```
Python pipeline → SQLite (already exists)
Python API server → reads SQLite → serves JSON over HTTP → Next.js fetch() → Browser
                                                          ↑
                                               refresh endpoint triggers pipeline
```

### Scope

- New Python HTTP API server (`app/api/`)
- Replace all `web/data/*.json` file reads with HTTP fetches
- Replace the `child_process` refresh route with an HTTP call to the Python API
- Remove the `app/exports/files.py` file-writing layer
- Keep the `app/exports/contracts.py` and `app/exports/serializers.py` as the API response builders (they already produce the right shapes)

### Framework Choice

Options:
- **FastAPI** — async, automatic OpenAPI docs, Pydantic integration, modern Python standard. Well-suited.
- **Flask** — simpler, synchronous, smaller dependency. Adequate for this use case.
- **Litestar** — newer, fast, but less ecosystem support.
- Recommendation: **FastAPI**. The automatic OpenAPI/Swagger docs are valuable for a data product (future consumers can self-serve). Pydantic integration will clean up the manual `to_dict()` serialization. Async support pairs well with scheduled pipeline runs.

### API Endpoints

Map directly from the existing JSON file exports and Next.js API routes:

| Method | Endpoint | Replaces File | Description |
|--------|----------|---------------|-------------|
| `GET` | `/api/v1/dashboard/overview` | `dashboard-overview.v2.json` | Dashboard landing page data |
| `GET` | `/api/v1/trends` | `trend-explorer.v2.json` | Explorer list with filtering |
| `GET` | `/api/v1/trends/{slug}` | `trend-detail-index.v2.json` (filtered) | Single trend detail |
| `GET` | `/api/v1/trends/latest` | `latest-trends.json` | Simple ranked list |
| `GET` | `/api/v1/trends/history` | `trend-history.json` | Historical snapshots |
| `GET` | `/api/v1/sources` | `source-summary.v2.json` | Source health overview |
| `GET` | `/api/v1/sources/{source}` | `source-summary.v2.json` (filtered) | Single source detail |
| `POST` | `/api/v1/refresh` | `POST /api/refresh` (child_process) | Trigger pipeline run |
| `GET` | `/api/v1/watchlists` | — | List watchlists |
| `POST` | `/api/v1/watchlists` | — | Create watchlist |
| `GET` | `/api/v1/alerts` | — | List alert events |
| `POST` | `/api/v1/alerts/rules` | — | Create alert rule |

### Implementation Steps

1. **Add FastAPI + uvicorn to `requirements.txt`**

2. **Create `app/api/` module:**
   ```
   app/api/
     __init__.py
     main.py          # FastAPI app factory, CORS, lifespan
     dependencies.py  # Shared deps: db connection, settings
     routers/
       __init__.py
       dashboard.py   # GET /dashboard/overview
       trends.py      # GET/POST /trends, /trends/{slug}, /trends/latest, /trends/history
       sources.py     # GET /sources, /sources/{source}
       refresh.py     # POST /refresh
       watchlists.py  # CRUD watchlists
       alerts.py      # CRUD alert rules, GET alert events
   ```

3. **Convert contracts to Pydantic models:**
   - Replace the `@dataclass` contracts in `app/exports/contracts.py` with Pydantic `BaseModel` subclasses
   - Use Pydantic's `alias_generator` or `Field(alias=...)` for camelCase serialization — eliminates all the manual `to_dict()` key renaming
   - The ~200 lines of `to_dict()` methods and `*_to_dict()` helper functions get replaced by Pydantic's built-in `model_dump(by_alias=True)`
   - Keep `app/exports/serializers.py` as-is — it builds the payloads from domain models, and the payloads just become Pydantic models instead of dataclasses

4. **Implement route handlers:**
   - Each handler calls the existing repository/serializer functions
   - Example for `GET /api/v1/trends/{slug}`:
     ```python
     @router.get("/trends/{slug}")
     async def get_trend_detail(slug: str, db=Depends(get_db)):
         # Reuse existing repository + serializer logic
         trends = load_trend_details(db)
         detail = next((t for t in trends if t.id == slug), None)
         if not detail:
             raise HTTPException(status_code=404)
         return serialize_detail_trend(detail)
     ```

5. **Implement refresh endpoint:**
   - `POST /api/v1/refresh` runs `run_trend_pipeline()` synchronously (or in a background task)
   - Returns pipeline run summary
   - Add optional mutex/lock to prevent concurrent pipeline runs

6. **Add CORS configuration:**
   - Allow `localhost:3000` (Next.js dev server) in development
   - Configurable origins via env var for production

7. **Create `scripts/run_api.py` entrypoint:**
   ```python
   uvicorn.run("app.api.main:app", host="0.0.0.0", port=8000, reload=True)
   ```

8. **Update Next.js data access layer (`web/lib/trends.ts`):**
   - Replace all `readJsonFile()` calls with `fetch()` to the Python API
   - Use a configurable base URL: `TREND_API_URL` env var (default `http://localhost:8000/api/v1`)
   - The response shapes are identical — the frontend types don't change
   - Example:
     ```typescript
     async function fetchTrendExplorer(): Promise<TrendExplorerResponse> {
       const res = await fetch(`${API_BASE}/trends`);
       if (!res.ok) throw new Error("Failed to fetch trends");
       return res.json();
     }
     ```

9. **Update Next.js refresh route (`web/app/api/refresh/route.ts`):**
   - Replace `execFile("python3", ...)` with `fetch(API_BASE + "/refresh", { method: "POST" })`

10. **Remove file transport:**
    - Delete `app/exports/files.py`
    - Remove `write_export_payloads()` calls from pipeline
    - Remove `web/data/*.json` from git tracking
    - Remove `web_data_path` from `Settings`

11. **Add API health check:**
    - `GET /api/v1/health` returning `{ "status": "ok", "version": "1.0.0" }`

12. **Add OpenAPI metadata:**
    - Title, description, version in FastAPI app config
    - Swagger UI available at `/docs` automatically

### Migration Strategy

Do this **incrementally**, not as a big bang:

**Step 1: Stand up the API alongside the file transport.** Both work. Next.js can be toggled between file reads and HTTP fetches via an env var (`TREND_DATA_SOURCE=file|api`). This lets you verify parity.

**Step 2: Default to API, keep file transport as fallback.** Run both in dev for a week. Validate all pages render identically.

**Step 3: Remove file transport.** Delete `files.py`, remove `web/data/*.json`, clean up.

### Dev Workflow After Migration

```bash
# Terminal 1: Python API
python scripts/run_api.py

# Terminal 2: Next.js frontend
cd web && npm run dev
```

Or with a `docker-compose.yml`:
```yaml
services:
  api:
    command: python scripts/run_api.py
    ports: ["8000:8000"]
  web:
    command: npm run dev
    ports: ["3000:3000"]
    environment:
      TREND_API_URL: http://api:8000/api/v1
```

### Tests

- Unit test each route handler with a test SQLite database
- Integration test the full request/response cycle via FastAPI's `TestClient`
- Verify JSON response shapes match the existing file exports exactly (regression)
- Test CORS headers
- Test refresh endpoint concurrent-run protection
- Test error responses (404 for unknown trend, 500 for failed refresh)

### Effort

Medium-Large (4-6 days). The heavy lifting is already done — the serializers produce the right shapes, the repositories read the right data. This is mostly plumbing the existing logic into HTTP handlers and swapping the frontend transport.

### Dependencies

- Should be done **after** Plan 3 (Scheduled Ingestion) — the API server and scheduler need to coexist (either the API triggers runs, or the scheduler runs alongside the API process)
- Benefits from Plan 5 (Alerts) — the alerts endpoints can be implemented as part of this work

---

## Updated Plan 7: Prioritized Roadmap

### Guiding Principles

- Maximize signal quality first (data sources), then improve presentation (charts, categories), then add proactive features (alerts, scheduling), then harden infrastructure (API)
- Each increment should deliver standalone value
- Maintain the "free to run" constraint
- Keep each phase deployable — no multi-week blocked dependencies

### Recommended Sequence

#### Phase A: Foundation (Week 1-2)

| Priority | Plan | Rationale |
|----------|------|-----------|
| **A1** | **Scheduled Ingestion** (Plan 3) | Unblocks everything. Without automation, no alerts work, history doesn't accumulate, and the tool requires manual babysitting. Smallest effort, highest leverage. |
| **A2** | **Google Trends Adapter** (Plan 1) | Fills the biggest data gap. Activates the dormant `search_score` component. Makes the multi-signal promise real. |

**Milestone:** The system runs unattended every 30 minutes and produces scores informed by search + social + developer + knowledge signals.

#### Phase B: Intelligence (Week 3-4)

| Priority | Plan | Rationale |
|----------|------|-----------|
| **B1** | **Sector Categorization** (Plan 4) | Organizes the growing trend data into navigable categories. Low effort, high UX impact. Needed before the trend list gets unwieldy. |
| **B2** | **Historical Trend Charts** (Plan 2) | Backend data is already accumulating (especially after Phase A enables scheduled runs). Charts make the historical data visible. This is the feature that makes people understand trend momentum at a glance. |

**Milestone:** Users can browse categorized trends with visual trajectory charts. The dashboard feels like a real product.

#### Phase C: Infrastructure (Week 5-6)

| Priority | Plan | Rationale |
|----------|------|-----------|
| **C1** | **Python REST API** (Plan 8) | The system now has enough features that the file-transport hack becomes a bottleneck. The API unlocks deployability, concurrent access, external consumers, and a proper refresh mechanism. Do this before alerts, because alerts need real-time delivery which files can't support. |

**Milestone:** Frontend and backend are decoupled. The system is deployable as two services. OpenAPI docs are live.

#### Phase D: Engagement (Week 7-8)

| Priority | Plan | Rationale |
|----------|------|-----------|
| **D1** | **Alerts System** (Plan 5) | Now runs on a real API with proper endpoints. Alert evaluation hooks into the automated pipeline. In-app notifications via the API are straightforward. |
| **D2** | **Twitter/X Adapter** (Plan 6) | Adds another high-value social signal. By this point the pipeline is robust and the scoring is tuned, so a new source integrates cleanly. |

**Milestone:** The tool proactively notifies users of important trend movements and covers 5+ independent data sources.

### Risk-Adjusted Notes

- **Plan 1 (Google Trends)** carries the most technical risk due to `pytrends` fragility. If it proves too unreliable, consider a lighter approach: RSS feeds of Google Trends daily/realtime trending searches rather than programmatic queries.
- **Plan 6 (Twitter/X)** carries cost risk if the free tier proves too limiting. Scope the initial implementation to work within 1500 tweets/month — roughly 50 tweets per run at 30 runs/month.
- **Plan 5 (Alerts)** is the largest effort. If time is tight, ship in-app alerts first (notification badge) and defer email/webhook delivery.
- **Plan 8 (REST API)** is the most structurally impactful change. The incremental migration strategy (file + API in parallel, then cut over) reduces risk significantly.
- **Plans 3 and 4** are low-risk and can be completed quickly — consider tackling them first even if working on Plan 1 in parallel.

### What Comes After

These plans complete the "competitive parity" gap and establish a production-ready architecture. Beyond this, the next tier of differentiation would be:
- **Predictive scoring** — forecasting which rising trends will break out (ML-based)
- **Opportunity scoring** — "how actionable is this trend for content/products/investment"
- **Community features** — shared watchlists, public trend pages
- **Authentication** — user accounts, personal watchlists, API keys for external consumers
- **Rate limiting and caching** — production hardening for the public API
