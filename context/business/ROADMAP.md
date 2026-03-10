# Product Roadmap

This file captures the remaining user-facing and product-facing plans after the recent implementation work.

## Now

### Geo-Aware Trend Experience

Why:
- The product can now tag evidence items and summarize geo presence on trend detail pages.
- The next product step is to make location useful across the rest of the experience, not just on one page.

Scope:
- Show geo summary on watchlists
- Show geo summary on shared watchlists
- Show geo summary on community/public watchlist pages
- Add trend-level labels such as "strongest in US" or "showing up in London and GB"
- Keep "origin" explicitly labeled as inferred unless backed by direct source metadata

Acceptance:
- A saved watchlist can surface its dominant countries/regions
- A shared link can show where the tracked cluster is gaining traction
- The UI distinguishes `explicit`, `inferred`, and `unknown`

### Historical Charts

Why:
- The current product shows rank and score snapshots, but not trend trajectory in a visually useful form.
- Historical movement is a core part of the value proposition.

Scope:
- Trend detail score/history chart
- Explorer sparklines
- Overview trend trajectory chart
- Better labels for breakout, rising, and cooling states

Acceptance:
- A user can quickly see whether a trend is accelerating, plateauing, or fading
- The charts use persisted history rather than frontend-only calculations

### Shared Watchlist Quality

Why:
- Shared watchlists now work end to end, but the artifact still feels thin.

Scope:
- Add trend status and momentum context to shared watchlists
- Add source coverage summaries
- Add direct links into trend detail pages
- Improve copy/share presentation so a shared page reads like a polished report rather than a raw list

Acceptance:
- Shared links feel informative without requiring the dashboard
- A recipient can tell why a trend matters from the shared page alone

### Dashboard Interaction Polish

Why:
- Core actions exist, but the interaction quality is still basic.

Scope:
- Loading states for share creation and alert actions
- Clear success states for copy/share flows
- Error states for local fallback and API failures
- Less ambiguous empty states for alerts, community pages, and watchlists

Acceptance:
- A user always knows whether an action is pending, succeeded, or failed
- Failure states explain whether the issue is local fallback, backend API, or missing data

## Next

### Google Trends As A First-Class Signal

Why:
- Search remains the most obvious signal gap versus competitors.

Scope:
- Add a Google Trends adapter
- Feed the `search` component of the score
- Surface search-backed evidence in the UI

Acceptance:
- Trend scores include real search-derived contribution
- Search activity is visible in evidence and score breakdowns

### Category And Sector Views

Why:
- Flat trend lists are less useful than navigable sectors.

Scope:
- Improve categorization quality
- Add category filters and overview sections
- Expose category-level summary trends

Acceptance:
- A user can browse and compare trends by sector

### Source Health As A Product Surface

Why:
- Source coverage and data freshness affect trust.

Scope:
- Show last successful fetch
- Show fallback usage
- Explain source contribution to rankings

Acceptance:
- Users can understand data freshness and source reliability without leaving the app

## Later

### Automated Refresh UX

Scope:
- Auto-refresh behavior
- Staleness warnings
- Background update cues

### Authentication

Scope:
- Real user identity for ownership of watchlists and shares
- Permissions model for private and public sharing

### Richer Opportunity Layers

Scope:
- Startup or content opportunities
- Sector-specific summaries
- Deeper evidence drill-down

## Priority Order

1. Geo-aware watchlists and shared artifacts
2. Google Trends ingestion
3. Historical charts
4. Shared watchlist enrichment
5. Dashboard interaction polish
6. Category improvements
7. Source health UX
8. Automated refresh UX
9. Authentication
