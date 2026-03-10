# Implementation Backlog

This file captures remaining engineering work. Items marked DONE were completed
on the develop branch and are listed for traceability.

## Completed

### Propagate Geo Summary Beyond Trend Detail — DONE
- Added geo summary to watchlist, shared, and community payloads
- Aggregated location context at collection level
- Updated web types and rendering

### Python Tests For CLI Fallback Commands — DONE
- 18 tests covering share, public lists, shared-watchlist, alerts, mark-read
- Validated output contracts and exit behavior

### Production API Boundary Cleanup — DONE
- Timestamp normalization across FastAPI and CLI fallback
- Error status propagation (was always 500, now typed)
- Consistent shapes between modes

### Google Trends Adapter — DONE (already existed)
- Adapter, fallback, and sample payload were already implemented

### Historical Chart Data Extensions — DONE
- Added `recentHistory` to explorer payloads
- Sparkline rendering in explorer cards

### Scheduler And Freshness Plumbing — DONE
- Scheduler was already fully implemented
- Added stale-data warning badge to dashboard

### Interaction-State UX Support — DONE
- Loading states for async actions (share, alert, watchlist mutations)
- Success notices with auto-dismiss
- Better empty states for alerts and community sections
- Error messages include status codes

### Geo Quality Controls — DONE
- Centralized confidence constants in `app/topics/geo.py`
- Minimum confidence filter on geo summary SQL query
- 8 test fixtures covering false positives, confidence ordering, ambiguous text

### Shared Watchlist Enrichment — DONE
- Items show rank, status, category, sources, rank change
- Reuses existing status pill and movement pill CSS

### Category Improvements — DONE
- Meta trend cards are now interactive (click to filter explorer)
- Cards show trend count and average score

## Ongoing Cleanup

### Contract Consolidation

Engineering angle:
- Continue to keep Python as the canonical source for derived metrics.
- Avoid drift between:
  - FastAPI responses
  - JSON exports
  - CLI fallback payloads
  - Next.js server helper contracts

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
