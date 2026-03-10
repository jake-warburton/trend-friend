# Implementation Backlog

This file captures remaining engineering work after the current branch reached:
- local-first watchlist/share/alerts support
- route and smoke-test coverage for the main local workflows
- per-signal geo tagging
- trend-level geo summary on detail pages

## Immediate

### Propagate Geo Summary Beyond Trend Detail

Why:
- The backend now computes `geo_summary` for detail records only.
- Watchlists, shared watchlists, and community payloads still lack aggregated location context.

Work:
- Add geo summary fields to watchlist/community/share payload contracts
- Reuse one aggregation path instead of duplicating SQL per route
- Add serializer coverage
- Add web types and rendering for these payloads

Tests:
- Python repository/export tests for collection-level geo rollups
- Next route/page tests for shared and community geo rendering

### Python Tests For CLI Fallback Commands

Why:
- The web fallback relies on `scripts/watchlists_api.py` for alert and share behavior.
- Current coverage is strongest at the Next route/service layer, not at the Python CLI layer itself.

Work:
- Add direct tests for:
  - `share-watchlist`
  - `list-public-watchlists`
  - `get-shared-watchlist`
  - `list-alerts`
  - `mark-alerts-read`
- Validate output contracts and exit behavior

### Production API Boundary Cleanup

Why:
- The app intentionally supports both local subprocess fallback and direct backend API usage.
- That boundary works, but it should be more explicit before further product expansion.

Work:
- Audit the server helpers under `web/lib/server/`
- Ensure fallback and API modes return the same shapes and status semantics
- Keep injectable route handlers for testability
- Document which paths are local-only versus production API-ready

## Near Term

### Google Trends Adapter

Why:
- The scoring model already has a `search` component waiting for a real source.

Work:
- Implement a Google Trends adapter
- Add deterministic fallback behavior
- Rebalance score weights only after signal quality is acceptable

Tests:
- Adapter normalization fixtures
- Fallback-path tests
- End-to-end export verification

### Historical Chart Data Extensions

Why:
- The frontend can render charts today, but explorer and overview views still need chart-ready payload shapes.

Work:
- Add compact recent history to explorer payloads
- Keep detail history payloads stable
- Avoid moving historical calculations into the frontend

### Scheduler And Freshness Plumbing

Why:
- Manual refresh exists, but automated ingestion and explicit freshness signaling are still missing.

Work:
- Add a scheduler entrypoint
- Emit last-run health metadata
- Surface stale-data warnings in web payloads

## Ongoing Cleanup

### Interaction-State UX Support

Engineering angle:
- Ensure routes return enough structured error information for the web app to distinguish conflicts, not-found states, fallback failures, and generic errors.

### Contract Consolidation

Engineering angle:
- Continue to keep Python as the canonical source for derived metrics.
- Avoid drift between:
  - FastAPI responses
  - JSON exports
  - CLI fallback payloads
  - Next.js server helper contracts

### Geo Quality Controls

Why:
- Geo is now partially inferred, which is useful but easy to overstate.

Work:
- Centralize geo confidence thresholds
- Keep origin claims separate from "currently trending in"
- Add fixtures for ambiguous geo text and non-geo false positives

## Deferred

### Auth And Ownership Model

Work:
- Real user identity
- Private/public watchlist permissions
- Share ownership and revocation

### Full Production Read API

Work:
- Move more frontend reads from generated/exported JSON or local helpers to dedicated backend endpoints where appropriate
- Preserve the current contract shapes during migration

## Suggested Execution Order

1. Geo summary propagation to watchlists/shared/community
2. Python CLI fallback tests
3. Production API boundary cleanup
4. Google Trends adapter
5. Historical chart payload extensions
6. Scheduler and freshness plumbing
7. Auth and full production API evolution
