# Supabase Setup Plan

This project is not Postgres-ready yet, but Supabase is the target database platform.

## Target architecture

- Vercel hosts the private frontend
- Supabase hosts Postgres
- GitHub Actions runs scheduled Python ingestion
- the frontend reads exported JSON snapshots first, then can move to DB-backed API reads later

## Phase 1: Supabase project setup

1. Create a Supabase project for Signal Eye.
2. Copy the Postgres connection string.
3. Store it as `SIGNAL_EYE_DATABASE_URL` in local `.env` and GitHub Actions secrets.
4. Use the Session Pooler connection string if you are on an IPv4-only network.
5. Keep `SIGNAL_EYE_ENABLE_POSTGRES_RUNTIME=false` until you have validated the current runtime path.

Recommended secrets:

- `SIGNAL_EYE_DATABASE_URL`
- `SIGNAL_EYE_ENABLE_POSTGRES_RUNTIME`
- `SIGNAL_EYE_REDDIT_USER_AGENT`
- `GITHUB_TOKEN`
- `TWITTER_BEARER_TOKEN`

## Phase 2: Backend portability work

Before Supabase can be used, complete the migration items in [docs/POSTGRES_MIGRATION.md](/Users/jakewarburton/Documents/repos/trend-friend/docs/POSTGRES_MIGRATION.md):

1. remove raw `sqlite3.Connection` assumptions from the repository boundary
2. add explicit migrations
3. make repository SQL portable to Postgres
4. verify refresh, exports, and history reads against Postgres

Current local verification command:

```bash
python3 scripts/check_supabase.py
```

That script:

- reads `SIGNAL_EYE_DATABASE_URL` from `.env`
- connects to Supabase
- applies the current Postgres migration set
- verifies that `schema_migrations` and the `trend_scores` table exist

Core repository smoke test:

```bash
python3 scripts/check_supabase_trend_scores.py
```

That script:

- writes one isolated `trend_runs` + `trend_score_snapshots` payload
- reads it back through `TrendScoreRepository`
- deletes the smoke-test rows afterward

## Phase 3: GitHub Actions integration

The scheduled workflow now uses Supabase as the source of truth.

Required GitHub Actions secrets:

- `SIGNAL_EYE_DATABASE_URL`
- `SIGNAL_EYE_REDDIT_USER_AGENT`
- `GITHUB_TOKEN_API` if you want higher GitHub ingestion limits
- `TWITTER_BEARER_TOKEN` if you want live Twitter/X ingestion

Current workflow behavior:

1. runs `python3 scripts/check_supabase.py`
2. runs the ingestion pipeline with `SIGNAL_EYE_ENABLE_POSTGRES_RUNTIME=true`
3. exports `web/data/*.json` from Supabase-backed state
4. commits only the refreshed `web/data` payloads

That means:

- SQLite is no longer needed for the scheduled free-hosting path
- Vercel can stay in static snapshot mode

## Phase 4: Frontend read model

Short term:

- keep `SIGNAL_EYE_API_URL` unset
- let the site read exported snapshots

Later:

- either add a lightweight hosted API backed by Supabase
- or expose carefully scoped read endpoints/functions

## Rollout order

1. Finish Postgres migration work locally.
2. Validate local runs against Supabase.
3. Switch GitHub Actions to Supabase writes.
4. Keep Vercel in snapshot/file mode.
5. Decide later whether a live API is worth the extra hosting complexity.
