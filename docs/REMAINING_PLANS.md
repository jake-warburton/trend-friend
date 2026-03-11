# Remaining Plans

This file is the current index of work that is still intentionally deferred after the local-first, share-flow, alerts, and geo-summary iterations completed on March 10, 2026.

It complements older planning docs rather than replacing them.

## Primary Backlogs

- Business and product roadmap: [context/business/ROADMAP.md](/Users/jakewarburton/Documents/repos/signal-eye/context/business/ROADMAP.md)
- Engineering and architecture backlog: [context/stack/IMPLEMENTATION_BACKLOG.md](/Users/jakewarburton/Documents/repos/signal-eye/context/stack/IMPLEMENTATION_BACKLOG.md)

## Existing Detailed Plans Still Relevant

- Broader feature roadmap: [docs/IMPROVEMENT_PLANS.md](/Users/jakewarburton/Documents/repos/signal-eye/docs/IMPROVEMENT_PLANS.md)
- Earlier web/dashboard deferrals: [docs/NEXT_PHASE.md](/Users/jakewarburton/Documents/repos/signal-eye/docs/NEXT_PHASE.md)
- Dashboard V2 contract and rollout context: [docs/DASHBOARD_V2_PLAN.md](/Users/jakewarburton/Documents/repos/signal-eye/docs/DASHBOARD_V2_PLAN.md)
- Competitor-inspired feature ranking: [docs/FEATURE_IMPLEMENTATION_PLAN.md](/Users/jakewarburton/Documents/repos/signal-eye/docs/FEATURE_IMPLEMENTATION_PLAN.md)

## Completed (March 2026)

1. ~~Add geo summary to watchlists, shared watchlists, and community payloads~~ — already present in all payloads; expanded panel now shows geo labels.
2. ~~Add Google Trends ingestion~~ — already integrated; expanded to US/UK/DE/IN regions with explicit geo metadata.
3. ~~Add historical charts and richer trend trajectory UX~~ — trajectory chart, forecast dashed lines, score breakdown chart all implemented.
4. ~~Polish dashboard interaction states~~ — loading/error/empty states, aria-live regions, refresh redesign, server-side scheduled refresh.
5. ~~Harden the local-first stack~~ — normalization unit tests, forward-auth tests, 99 web + 237 Python tests passing.
6. ~~CSV export enrichment~~ — added volatility, momentum, coverage, forecast columns to backend and frontend exports.
7. ~~Webhook delivery hardening~~ — HMAC signatures, retry with backoff, User-Agent and delivery ID headers.
8. ~~Forecast UI polish~~ — stable badge, tooltip labels, expanded panel forecast card, trajectory chart forecast lines.

## Highest-Priority Next Steps

1. Seasonality detection — derived recurring/evergreen tags, explorer badge, breakout confidence dampening.
2. Social channel breakdown — tightly capped social pulse for top trends, per-topic platform summaries.
3. Update ROADMAP.md and IMPLEMENTATION_BACKLOG.md to reflect current state.

## Notes

- If a plan appears in more than one file, the more specific file wins.
- Business-facing priorities should live in `context/business/`.
- Technical execution details and operational follow-ups should live in `context/stack/`.
