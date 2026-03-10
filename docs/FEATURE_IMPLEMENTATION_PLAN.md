# Ranked Feature Implementation Plan

This document ranks the five competitor-inspired features in
[docs/FEATURE_SPECS.md](/Users/jakewarburton/Documents/repos/trend-friend/docs/FEATURE_SPECS.md)
against the current state of the `develop` branch as of March 10, 2026.

The ranking reflects what is already built in this repo:
- auth and watchlist ownership
- share management and community discovery
- geo summary and source contribution rollups
- historical charts, trend detail enrichment, and recent history payloads
- local-first API fallback coverage

It is intended to be execution-oriented, not aspirational.

## Recommended Order

1. CSV / Data Export
2. Webhook & Digest Alerts
3. Trend Forecasting
4. Seasonality Detection
5. Social Channel Breakdown

## 1. CSV / Data Export

Decision: `Build now`

Why this ranks first:
- Lowest implementation risk of the five.
- No new tables are required.
- Reuses current explorer, watchlist, geo, source contribution, and opportunity
  payloads immediately.
- Produces a clear user-facing win for analysts without increasing ingestion
  complexity.

Why it fits the current repo:
- Trend and watchlist payloads are already rich enough to export meaningful CSVs.
- Auth/ownership already exists, so watchlist export permissions are straightforward.
- The local-first fallback pattern is already established and can support a CLI
  or route-backed export cleanly.

Suggested scope:
- `GET /export/trends.csv`
- `GET /export/watchlists/{id}.csv`
- dashboard and watchlist `Export CSV` actions
- ownership checks for watchlist exports

Do not add yet:
- Excel-specific formatting
- scheduled exports
- Google Sheets sync

Success criteria:
- export works in both API mode and local-first mode
- CSV headers match the current product language
- empty watchlists export a header-only file

## 2. Webhook & Digest Alerts

Decision: `Build next`

Why this ranks second:
- High user value with moderate implementation cost.
- Alert evaluation already exists; delivery is the missing leg.
- Auth/ownership is already in place, which removes a major ambiguity from the
  original spec.

Why it fits the current repo:
- Alert rules and alert events are already persisted.
- Share/activity history patterns in the repo make audit logging a natural fit.
- The dashboard already has action/state patterns for asynchronous settings flows.

Suggested scope:
- webhook channels only
- test-send action
- post-run delivery with non-blocking failure logging
- digest payload with alerts, breakouts, and biggest movers

Do not add yet:
- retries/backoff workers
- email delivery
- per-rule channel routing

Main implementation caution:
- notification delivery must never block or fail the scoring pipeline
- SSRF and unsafe destination handling need explicit validation

## 3. Trend Forecasting

Decision: `Build after notifications`

Why this ranks third:
- The data foundation already exists, so this is now practical rather than speculative.
- More differentiated than CSV export, but easier to mislead users if presented too aggressively.
- Good leverage because it can improve both detail views and explorer scanability.

Why it fits the current repo:
- historical chart data already exists
- breakout prediction and opportunity layers already exist
- detail pages already show advanced reasoning panels where forecast confidence can
  be explained

Suggested scope:
- on-the-fly forecast from existing score history
- detail chart dashed continuation
- explorer `predicted` badge for medium/high-confidence upward forecasts
- conservative confidence labeling

Do not add yet:
- long-range forecasts
- forecasting in ranking itself
- strong product claims about accuracy

Main implementation caution:
- keep the output framed as a short-horizon model projection
- do not let confidence language outrun the amount of stored history

## 4. Seasonality Detection

Decision: `Build later`

Why this ranks fourth:
- Useful correction layer, but lower immediate value than forecasts or notifications.
- Its accuracy improves only with deeper historical accumulation.
- It is most useful once forecasting exists and breakout logic needs a brake on
  cyclical noise.

Why it fits less well right now:
- The repo has history, but not necessarily enough long-duration history in most
  environments to make calendar-driven seasonality compelling.
- The spec's snapshot-column idea is probably heavier than necessary for phase 1.

Suggested scope:
- derived `recurring` and `evergreen` tags from appearance gaps
- explorer badge and optional `hide recurring` filter
- breakout confidence dampening only

Do not add yet:
- snapshot-level persistence for every run
- annual/quarterly seasonality claims
- complex decomposition models

Main implementation caution:
- treat seasonality as derived metadata first
- avoid schema weight unless repeated recalculation proves too expensive

## 5. Social Channel Breakdown

Decision: `Build last`

Why this ranks fifth:
- Most differentiating feature here, but also the highest ingestion and maintenance cost.
- Adds external fetches, rate limiting, caching, persistence, and reliability concerns.
- Easy to sprawl into a second data-collection subsystem.

Why it does not rank higher:
- The current product already improved trust and discovery significantly through
  source contributions, geo summaries, watchlist sharing, and community browse.
- This feature adds breadth, but not with the same leverage-to-risk ratio as CSV,
  notifications, or forecasting.

Suggested scope:
- start with a tightly capped social pulse check for top trends only
- persist lightweight per-topic platform summaries
- expose detail-page social presence first, explorer badges second

Do not add yet:
- many new platforms at once
- social pulse feeding the core score
- expensive API-key-dependent integrations in the first cut

Main implementation caution:
- keep it post-run and non-blocking
- cap the budget hard so the pipeline remains predictable

## Build / Later / Reject Summary

Build now:
- CSV / Data Export
- Webhook & Digest Alerts
- Trend Forecasting

Later:
- Seasonality Detection
- Social Channel Breakdown

Reject for now:
- expanding any of the five into multi-channel enterprise workflows before the
  first narrow cut lands

## Sequencing Notes

Recommended execution path:
1. CSV export
2. Webhook notifications
3. Forecasting
4. Seasonality as a forecast/breakout correction layer
5. Social pulse as a separate ingestion-quality project

This order keeps the first three features:
- low-to-moderate risk
- compatible with the current local-first architecture
- valuable without large schema or pipeline complexity increases

## Planning Notes

Two planning docs in the repo are now stale relative to the current branch:
- [context/business/ROADMAP.md](/Users/jakewarburton/Documents/repos/trend-friend/context/business/ROADMAP.md)
- [context/stack/IMPLEMENTATION_BACKLOG.md](/Users/jakewarburton/Documents/repos/trend-friend/context/stack/IMPLEMENTATION_BACKLOG.md)

Before using them as the primary roadmap again, update them to reflect that the
following are already done:
- auth and ownership
- automated refresh UX
- richer opportunity/detail layers
- community discovery and share lifecycle management
