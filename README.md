# Signal Eye MVP

Signal Eye is a local-first trend intelligence MVP that aggregates free signals from across the web, extracts recurring topics, computes transparent momentum scores, and displays a ranked list of emerging trends.

The implementation is intentionally simple:

- Python 3.9+
- Next.js for the browser dashboard
- SQLite for persistence
- standard-library HTTP clients
- resilient source fallbacks so the system still runs without live network access

## What It Does

The MVP ingests signals from these free sources:

- Reddit hot posts
- Hacker News top stories
- GitHub repository search
- Wikipedia top pageviews

It then:

1. normalizes source items into a shared internal model
2. extracts and clusters candidate topics
3. computes explainable component scores
4. ranks topics deterministically
5. stores the latest signals and scores in SQLite
6. prints a readable CLI dashboard

## Project Structure

```text
app/
  sources/      external source adapters
  topics/       topic extraction, normalization, clustering
  scoring/      weights, score calculation, ranking
  data/         SQLite setup and repositories
  exports/      frontend-facing JSON contract and file export
  jobs/         ingestion and pipeline orchestration
  ui/           CLI dashboard rendering
web/
  app/          Next.js App Router pages and routes
  components/   browser dashboard components
  lib/          typed data loading helpers
  data/         generated JSON snapshots for the web app
scripts/
  run_ingestion.py
  run_dashboard.py
  export_web_data.py
  run_scheduler.py
tests/
main.py
.env.example
requirements.txt
```

## Installation

No third-party packages are required for the MVP.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Copy the example environment file if you want to customize runtime values:

```bash
cp .env.example .env
```

Supported environment variables:

- `SIGNAL_EYE_DATABASE_PATH`: SQLite database location. Default: `data/signal_eye.db`
- `SIGNAL_EYE_WEB_DATA_PATH`: Export directory for web JSON payloads. Default: `web/data`
- `SIGNAL_EYE_REQUEST_TIMEOUT_SECONDS`: HTTP timeout in seconds. Default: `10`
- `SIGNAL_EYE_MAX_ITEMS_PER_SOURCE`: Max records fetched per source. Default: `30`
- `SIGNAL_EYE_RANKING_LIMIT`: Number of ranked trends to store and display. Default: `100`
- `SIGNAL_EYE_REDDIT_USER_AGENT`: User agent for Reddit requests
- `SIGNAL_EYE_CORS_ORIGINS`: Comma-separated allowed origins for the REST API
- `SIGNAL_EYE_REFRESH_SECRET`: Optional shared secret required by `POST /api/v1/refresh`
- `GITHUB_TOKEN`: Optional token for higher GitHub API rate limits
- `TWITTER_BEARER_TOKEN`: Optional token for live Twitter/X ingestion

## Running The MVP

Run the full ingestion, scoring, persistence, and dashboard flow:

```bash
python3 main.py
```

Run ingestion only:

```bash
python3 scripts/run_ingestion.py
```

Render the latest stored ranking:

```bash
python3 scripts/run_dashboard.py
```

Export the latest and historical JSON payloads for the web UI:

```bash
python3 scripts/export_web_data.py
```

Run the simple scheduler loop:

```bash
python3 scripts/run_scheduler.py
```

The scheduler runs ingestion every 30 minutes until stopped.

## Running The REST API

Run the FastAPI backend locally:

```bash
python3 scripts/run_api.py
```

The API is available at `http://localhost:8000/api/v1`.

Health check:

```bash
curl http://localhost:8000/api/v1/health
```

## Hosting

If the frontend is deployed separately from the Python backend, set:

```bash
SIGNAL_EYE_API_URL=https://your-api-host.example.com
```

on the frontend deployment so Next.js reads from the hosted API instead of local JSON exports.

For a hosted setup guide, see [docs/HOSTING.md](/Users/jakewarburton/Documents/repos/signal-eye/docs/HOSTING.md).

## Free Hosting Path

If you want to avoid paying for a backend host, keep the frontend on Vercel and refresh the generated data with GitHub Actions.

This repo now includes:

- [refresh-data.yml](/Users/jakewarburton/Documents/repos/signal-eye/.github/workflows/refresh-data.yml)

How it works:

1. GitHub Actions runs the Python ingestion pipeline on a schedule.
2. It refreshes `data/signal_eye.db` so historical trend state persists between runs.
3. It exports fresh `web/data/*.json`.
4. It commits those generated files back to the repo.
5. Vercel redeploys from the updated repo and serves the refreshed static snapshots.

For this free path:

- do **not** set `SIGNAL_EYE_API_URL` in Vercel
- keep the app in file mode
- add these GitHub repository secrets if you want live enrichment:
  - `SIGNAL_EYE_REDDIT_USER_AGENT`
  - `GITHUB_TOKEN_API`
  - `TWITTER_BEARER_TOKEN`

The included workflow defaults to every 15 minutes to keep repo churn reasonable. You can tighten or loosen the cron expression in [refresh-data.yml](/Users/jakewarburton/Documents/repos/signal-eye/.github/workflows/refresh-data.yml).

## Running Codex Autopilot

If you want Codex to make repeated small improvement passes while you are away, use the local wrapper:

```bash
./scripts/codex_autopilot.sh 3
```

That runs up to `3` non-interactive Codex passes in a row. Each pass is instructed to:

- make one small coherent improvement
- run tests before finishing
- commit only if tests pass
- stop if blocked

Useful variants:

```bash
GOAL="Improve dashboard usability and commit after each green pass." ./scripts/codex_autopilot.sh 4
USE_DANGEROUS_MODE=1 nohup ./scripts/codex_autopilot.sh 8 > autopilot.out 2>&1 &
WORKERS="topics,scoring" ./scripts/codex_autopilot.sh 2
WORKERS="topics,scoring" WORKER_GOALS="topics=Improve topic extraction quality.;scoring=Improve scoring quality." ./scripts/codex_autopilot.sh 2
AUTO_CLEAN=1 WORKERS="topics,scoring" ./scripts/codex_autopilot.sh 2
```

Notes:

- default mode uses `codex exec --full-auto`
- unattended runs are more reliable with `USE_DANGEROUS_MODE=1`, but that is materially riskier because it bypasses approvals and sandboxing
- per-pass logs are written to `.codex-autopilot/`
- use `tmux` or `nohup` if you want the process to keep running after you disconnect
- `WORKERS="topics,scoring"` creates separate git worktrees under `.codex-worktrees/` and runs one Codex worker per worktree on its own branch
- worker branches are left in place so you can inspect, cherry-pick, or merge them manually afterward
- multi-worker mode currently forces dangerous execution for the worker runs so commits and worktree Git operations are less likely to stall on sandbox restrictions
- `AUTO_CLEAN=1` removes the previous `.codex-autopilot/` and `.codex-worktrees/` directories before starting a new run
- multi-worker runs write a summary file to `.codex-autopilot/run-summary.txt` by default

## Running The Browser Dashboard

Generate fresh data for the browser UI:

```bash
python3 scripts/run_ingestion.py
python3 scripts/export_web_data.py
```

Or run the whole browser workflow in one command:

```bash
./scripts/start_dashboard.sh
```

Install and run the Next.js app:

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

If port `3000` is already in use, run:

```bash
PORT=3001 npm run dev
```

The dashboard reads `web/data/latest-trends.json` and `web/data/trend-history.json`.
The refresh button triggers the local Python ingestion and export scripts through a Next.js server route.
The dashboard can also generate private or public watchlist share links, and shared watchlists render at `/shared/<token>`.

## Running Tests

```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m unittest discover -s tests -v
```

For the web app quality gates:

```bash
cd web
npm run lint
npx tsc --noEmit
npm test
```

The test suite covers:

- topic normalization
- duplicate merging
- score calculation
- deterministic ranking
- repository persistence
- web export contract generation
- source adapter normalization

## How Scoring Works

Each topic receives explicit score components:

- `social_score`: Reddit and Hacker News signals
- `developer_score`: GitHub signals
- `knowledge_score`: Wikipedia pageview signals
- `diversity_score`: bonus for appearing across multiple sources

The implementation uses a simple weighted logarithmic scale so large raw metrics stay comparable without hiding the scoring logic.

Each ranked result includes:

- topic name
- total score
- component scores
- source coverage
- evidence text
- latest update timestamp

## Fallback Behavior

Live APIs are not guaranteed to be available. To keep the MVP usable:

- each source adapter catches fetch failures
- the pipeline logs the failure
- the adapter falls back to deterministic sample payloads
- the full ingestion run continues

This makes the project runnable in offline or rate-limited environments and keeps tests independent from live services.

## Adding A New Source

1. Create a new adapter in `app/sources/`.
2. Normalize external records into `RawSourceItem`.
3. Add the adapter to `fetch_source_items()` in [app/jobs/ingest.py](/Users/jakewarburton/Documents/repos/signal-eye/app/jobs/ingest.py).
4. Map the source to a `signal_type` in [app/topics/extract.py](/Users/jakewarburton/Documents/repos/signal-eye/app/topics/extract.py) if needed.
5. Add normalization tests in `tests/test_sources.py`.

Because all sources feed the same shared models, scoring, ranking, persistence, and UI do not need structural changes for most new adapters.

## Assumptions

- Google Trends was not included in the first MVP because a stable free integration usually requires extra unofficial tooling. The current architecture leaves room to add it later as another adapter.
- The CLI dashboard is the chosen MVP presentation layer because it is the lowest-complexity option that still satisfies the product and acceptance requirements.
- Topic extraction uses simple heuristics rather than ML so behavior stays inspectable and testable.
