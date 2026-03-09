# Next Phase Notes

These items were explicitly deferred from the first browser dashboard phase.

## Deferred Product Scope

- charts
- evidence drill-down by topic
- dedicated topic detail pages
- authentication implementation

## Deferred Interaction Scope

- switching refresh from a local server-side Python invocation to a real backend API call
- auto-refresh behavior

## Deferred Architecture Evolution

- full HTTP API for trend reads and refresh actions
- production auth model
- richer history exploration UX

## Constraints Already Agreed

- keep the repo as a monorepo with the frontend under `web/`
- use JSON first, but shape it as a real API contract
- design for future auth without implementing auth now
- plan for historical data soon
- use Next.js with TypeScript and App Router
- use MUI Base
- start with a single dashboard page
