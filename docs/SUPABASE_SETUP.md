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
4. Do not switch runtime traffic to it yet.

Recommended secrets:

- `SIGNAL_EYE_DATABASE_URL`
- `SIGNAL_EYE_REDDIT_USER_AGENT`
- `GITHUB_TOKEN`
- `TWITTER_BEARER_TOKEN`

## Phase 2: Backend portability work

Before Supabase can be used, complete the migration items in [docs/POSTGRES_MIGRATION.md](/Users/jakewarburton/Documents/repos/trend-friend/docs/POSTGRES_MIGRATION.md):

1. remove raw `sqlite3.Connection` assumptions from the repository boundary
2. add explicit migrations
3. make repository SQL portable to Postgres
4. verify refresh, exports, and history reads against Postgres

## Phase 3: GitHub Actions integration

Once Postgres support is real:

1. update [refresh-data.yml](/Users/jakewarburton/Documents/repos/trend-friend/.github/workflows/refresh-data.yml) to use `SIGNAL_EYE_DATABASE_URL`
2. stop relying on a committed SQLite database file
3. keep exporting `web/data/*.json` for the frontend during the transition

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
