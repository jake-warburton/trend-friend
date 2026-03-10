# Remaining Plans

This file is the current index of work that is still intentionally deferred after the local-first, share-flow, alerts, and geo-summary iterations completed on March 10, 2026.

It complements older planning docs rather than replacing them.

## Primary Backlogs

- Business and product roadmap: [context/business/ROADMAP.md](/Users/jakewarburton/Documents/repos/trend-friend/context/business/ROADMAP.md)
- Engineering and architecture backlog: [context/stack/IMPLEMENTATION_BACKLOG.md](/Users/jakewarburton/Documents/repos/trend-friend/context/stack/IMPLEMENTATION_BACKLOG.md)

## Existing Detailed Plans Still Relevant

- Broader feature roadmap: [docs/IMPROVEMENT_PLANS.md](/Users/jakewarburton/Documents/repos/trend-friend/docs/IMPROVEMENT_PLANS.md)
- Earlier web/dashboard deferrals: [docs/NEXT_PHASE.md](/Users/jakewarburton/Documents/repos/trend-friend/docs/NEXT_PHASE.md)
- Dashboard V2 contract and rollout context: [docs/DASHBOARD_V2_PLAN.md](/Users/jakewarburton/Documents/repos/trend-friend/docs/DASHBOARD_V2_PLAN.md)
- Competitor-inspired feature ranking: [docs/FEATURE_IMPLEMENTATION_PLAN.md](/Users/jakewarburton/Documents/repos/trend-friend/docs/FEATURE_IMPLEMENTATION_PLAN.md)

## Highest-Priority Next Steps

1. Add geo summary to watchlists, shared watchlists, and community payloads so saved trend collections can answer where a cluster is trending.
2. Add Google Trends ingestion so the `search` score component stops being effectively dead weight.
3. Add historical charts and richer trend trajectory UX to make the score history legible in the product.
4. Polish dashboard interaction states for sharing and alerts so loading, success, and failure are visible.
5. Harden the local-first stack with more Python CLI tests and clearer production API migration boundaries.

## Notes

- If a plan appears in more than one file, the more specific file wins.
- Business-facing priorities should live in `context/business/`.
- Technical execution details and operational follow-ups should live in `context/stack/`.
