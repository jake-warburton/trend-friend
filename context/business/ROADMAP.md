# Product Roadmap

This file captures the remaining user-facing and product-facing plans.
Items marked DONE were completed on the develop branch.

## Completed

### Geo-Aware Trend Experience — DONE
- Geo summary on watchlists, shared watchlists, and community pages
- Centralized confidence thresholds with minimum quality filter
- UI distinguishes explicit, inferred, and unknown

### Historical Charts — DONE
- Explorer sparklines using persisted history
- Detail score/history chart
- Labels for breakout, rising, and cooling states

### Shared Watchlist Quality — DONE
- Trend status and momentum context on shared items
- Source coverage summaries
- Direct links into trend detail pages
- Category labels and rank change indicators

### Dashboard Interaction Polish — DONE
- Loading states for share creation and alert actions
- Success notices with auto-dismiss for copy/share/alert/watchlist flows
- Error states with status codes
- Helpful empty states for alerts and community pages

### Google Trends As A First-Class Signal — DONE
- Adapter and fallback behavior already implemented
- Search component feeds the score

### Category And Sector Views — DONE
- Interactive meta trend cards that filter the explorer
- Category filters in explorer
- Category-level summary stats (trend count, average score)

## Now

### Source Health As A Product Surface

Why:
- Source coverage and data freshness affect trust.

Scope:
- Show last successful fetch
- Show fallback usage
- Explain source contribution to rankings

Acceptance:
- Users can understand data freshness and source reliability without leaving the app

Note: Much of this is already visible in the Sources sidebar section (status,
fetch time, fallback warnings, error messages). Remaining work is primarily
surfacing source contribution to individual trend rankings.

### Automated Refresh UX

Scope:
- Auto-refresh behavior
- Staleness warnings (DONE — stale badge on last-run card)
- Background update cues

## Later

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

1. Source health contribution detail
2. Automated refresh UX
3. Authentication
4. Richer opportunity layers
