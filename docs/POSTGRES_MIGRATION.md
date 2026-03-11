# Postgres Migration Plan

Trend Friend is not ready for a direct SQLite -> Postgres flip yet.

## Why this is not a config-only change

The current backend is tightly coupled to SQLite in three ways:

1. **Connection types**
   - API routers and repositories currently assume `sqlite3.Connection`
   - request dependencies return raw SQLite connections

2. **Schema management**
   - schema creation lives in [app/data/database.py](/Users/jakewarburton/Documents/repos/trend-friend/app/data/database.py)
   - migrations rely on SQLite-only features such as `PRAGMA table_info`, `PRAGMA index_list`, and table rebuild patterns

3. **Query semantics**
   - the repository layer in [app/data/repositories.py](/Users/jakewarburton/Documents/repos/trend-friend/app/data/repositories.py) uses SQLite-shaped SQL and behaviors such as:
     - `?` parameter placeholders
     - `INSERT OR IGNORE`
     - `ON CONFLICT(...) DO UPDATE` in SQLite form
     - `cursor.lastrowid`
     - boolean values stored as integers
     - JSON stored as text blobs

## Boundary added

This repo now includes [app/data/primary.py](/Users/jakewarburton/Documents/repos/trend-friend/app/data/primary.py).

That module is now the runtime boundary used by:

- [app/api/dependencies.py](/Users/jakewarburton/Documents/repos/trend-friend/app/api/dependencies.py)
- [app/jobs/compute_scores.py](/Users/jakewarburton/Documents/repos/trend-friend/app/jobs/compute_scores.py)
- [app/api/routers/refresh.py](/Users/jakewarburton/Documents/repos/trend-friend/app/api/routers/refresh.py)

This is the first cutover point for introducing Postgres support.

## Recommended migration stages

### Stage 1: Repository interface cleanup

Goal: stop exposing `sqlite3.Connection` outside the data layer.

Tasks:

- replace raw `sqlite3.Connection` type annotations in routers and services
- introduce a database protocol or repository factory abstraction
- isolate dialect-specific insert/update helpers

### Stage 2: External schema management

Goal: move schema creation out of runtime `executescript`.

Tasks:

- create versioned SQL migrations
- create a Postgres schema equivalent for all current tables
- replace `PRAGMA`-based column checks with explicit migrations

### Stage 3: Query portability

Goal: make repository SQL run against Postgres.

Tasks:

- replace `?` placeholders with a driver abstraction or SQL builder
- replace `INSERT OR IGNORE`
- replace `cursor.lastrowid` assumptions
- convert boolean integer storage to real booleans where appropriate
- decide whether JSON stays as text or becomes `jsonb`

### Stage 4: Dual-run verification

Goal: verify correctness before switching production traffic.

Tasks:

- export SQLite data
- import into Postgres
- run API reads against Postgres in staging
- verify refresh, watchlists, auth, notifications, alerts, and exports

### Stage 5: Hosted cutover

Goal: move the deployed backend from SQLite-on-disk to Postgres.

Tasks:

- provision hosted Postgres
- wire `TREND_FRIEND_DATABASE_URL`
- remove the SQLite persistent disk dependency
- run a migration/import job
- redeploy API

## Current guardrail

`TREND_FRIEND_DATABASE_URL` is now recognized in config, but the app intentionally raises an explicit error if you try to use it before the repository layer is migrated.

That is deliberate. A half-wired database switch would be riskier than staying on SQLite until the data layer is actually portable.
