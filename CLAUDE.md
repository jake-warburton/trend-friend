# Signal Eye — Navigation Index

Signal Eye (repo name: trend-friend) is a trend intelligence platform that ingests data
from ~22 source adapters, scores trends across 5 dimensions, and surfaces them via a
REST API and Next.js dashboard. It operates in two modes: **API mode** (Python on
Render + Vercel) and **Supabase-only mode** (GitHub Actions pipeline → Vercel reads
exported JSON directly).

---

## Existing Documentation (don't duplicate — read these)

| Topic | File |
|---|---|
| Coding principles | `AGENTS.md` |
| TDD workflow | `AGENTS.tdd.md` |
| Architecture & engineering standards | `context/stack/ARCHITECTURE.md` |
| Coding standards (27 rules) | `context/stack/CODING_STANDARDS.md` |
| Product spec | `context/business/SPEC.md` |
| Roadmap | `context/business/ROADMAP.md` |

---

## Start-Here Map

Where to go first for common tasks:

| Task | Start with |
|---|---|
| Adding a new data source | `app/sources/base.py` → `app/sources/catalog.py` |
| Changing scoring | `app/scoring/weights.py`, `app/scoring/calculator.py` |
| Adding an API endpoint | `app/api/routers/` + `app/api/main.py` + `web/app/api/` |
| Adding a frontend page | `web/app/` (App Router), `web/lib/trends.ts` (data loading) |
| Pipeline flow | `app/jobs/ingest.py` → `app/jobs/compute_scores.py` → `app/exports/web_data.py` |
| Frontend display changes | `web/components/dashboard-shell.tsx`, `web/lib/types.ts` |
| Database schema | `app/data/sqlite_migrations/` + `app/data/postgres_migrations/` (keep in sync) |
| Auth | `app/auth/` (Python) + `web/lib/supabase/` + `web/middleware.ts` |
| Billing | `app/api/routers/billing.py` + `app/api/routers/stripe_webhooks.py` |
| Watchlists | `app/data/repositories.py` (WatchlistRepository) + `web/lib/server/watchlist-service.ts` |
| Alerts | `app/alerts/evaluate.py` + `app/api/routers/alerts.py` |
| Export contract (Python↔TS) | `app/exports/contracts.py` + `app/exports/serializers.py` + `web/lib/types.ts` (all three must stay in sync) |

---

## Directory Glossary

```
app/                    Python backend — all business logic lives here
  api/                  FastAPI app and route handlers
    routers/            One router per domain (trends, alerts, billing, etc.)
  alerts/               Alert evaluation engine
  auth/                 Password hashing, tokens, user repository, middleware
  data/                 Database layer — models, repositories, migrations
    sqlite_migrations/  SQLite migration SQL files (local / CI)
    postgres_migrations/ PostgreSQL migration SQL files (production)
    primary.py          Runtime SQLite ↔ PostgreSQL switch — always go through this
    repositories.py     All CRUD in one file — the DB's single entry point
  enrichment/           External market-footprint enrichment (Google Trends, etc.)
  exports/              JSON + CSV export: contracts, serializers, file writers
  jobs/                 Pipeline orchestration: ingest → score → export
  notifications/        Digest builder and webhook delivery
  scoring/              Trend score calculation, weights, ranking logic
  sources/              ~22 source adapters (Reddit, GitHub, HN, Wikipedia, etc.)
  theses/               Saved-thesis matching engine
  topics/               Topic extraction, normalization, clustering
  ui/                   CLI presentation helpers
web/                    Next.js frontend (App Router)
  app/                  Pages and API routes
    api/                Next.js API route handlers (proxy to Python or local JSON)
  components/           React components (dashboard-shell.tsx is the main shell)
  lib/                  Utilities, type definitions, data loading
    server/             Server-only helpers (watchlist-service, etc.)
    supabase/           Supabase client + server helpers
    trends.ts           Dual-path data loader (API vs local JSON)
    types.ts            TypeScript type definitions — must match contracts.py
  tests/                TypeScript test suite (32 files)
tests/                  Python test suite (24 files)
context/                Project guidelines and specs (not app code)
  business/             Product spec, roadmap, tasks
  stack/                Architecture, coding standards, acceptance criteria
  research/             Competitor and signal research
  examples/             Reference trend reports
docs/                   Feature specs, hosting guides, migration notes
scripts/                CLI entry points: run_api.py, run_scheduler.py, watchlists_api.py, etc.
fixtures/               Test fixtures and sample data
data/                   Live SQLite database (gitignored contents)
.github/                GitHub Actions CI/CD workflows
```

---

## Key Architectural Decisions

- **`app/data/primary.py`** switches SQLite ↔ PostgreSQL at runtime — always go through `primary.py`, never connect directly.
- **`web/lib/trends.ts`** has dual-path logic (API vs local JSON) — check both paths when debugging data loading.
- **JSON contract triple**: `app/exports/contracts.py` ↔ `app/exports/serializers.py` ↔ `web/lib/types.ts` — always change together.
- **`web/components/dashboard-shell.tsx`** is ~158KB — intentional monolith for now, don't split without a plan.
- **`app/data/repositories.py`** is ~151KB — all CRUD in one file, the DB's single entry point.

---

## How to Run

```bash
# Pipeline (ingest → score → export)
python main.py

# API server (localhost:8000)
python scripts/run_api.py

# Frontend dev server
cd web && npm run dev

# Python tests
python -m unittest discover -s tests

# TypeScript tests
cd web && node --import tsx --test tests/**/*.test.ts
```

---

## Known Gotchas

- Two parallel migration directories (`sqlite_migrations/` and `postgres_migrations/`) must be kept in sync manually.
- The `web/lib/trends.ts` dual-path (API vs JSON) means data-loading bugs can be mode-specific — test both paths.
