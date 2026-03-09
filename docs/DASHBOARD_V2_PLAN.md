# Dashboard V2 Data Contract And Rollout Plan

## Goal

Expand the dashboard so it can support substantially more information without moving business logic into the frontend.

The existing architecture already has the right split:

- Python owns ingestion, normalization, scoring, persistence, and export
- Next.js owns rendering, filters, and refresh UX

Dashboard V2 should keep that split and evolve the exported JSON contract into a richer product-facing schema.

## Design Principles

- Keep Python as the source of truth for all derived metrics
- Add fields to the export contract only when they are backed by persisted data
- Prefer stable, product-facing DTOs over exposing raw database shapes
- Preserve a simple read path for the frontend
- Design the contract so it can later be served over HTTP without structural rewrites

## Current Constraints

The current export shape is optimized for a simple top-trends page:

- `latest-trends.json` exposes rank, score, sources, evidence, and latest signal time
- `trend-history.json` exposes recent ranked snapshots

This is enough for a V1 list view, but not enough for:

- rank movement
- breakout detection
- per-source contribution analysis
- charting a topic over time
- evidence drill-down
- sector or category views
- confidence or quality indicators

## V2 Product Scope

Dashboard V2 should support four view types:

1. Overview
   - top trends
   - breakout trends
   - rising trends
   - source contribution summary
   - snapshot freshness

2. Explorer
   - sortable trend table
   - richer filters
   - category and source facets
   - score and momentum comparisons

3. Trend Detail
   - score history chart
   - rank history chart
   - source breakdown
   - evidence timeline
   - related topics

4. Source Health
   - volume by source over time
   - latest successful fetch time
   - fallback status
   - contribution to final rankings

## Recommended V2 Exports

Keep V1 files intact for compatibility initially and add V2 payloads beside them:

- `web/data/dashboard-overview.v2.json`
- `web/data/trend-explorer.v2.json`
- `web/data/trend-detail-index.v2.json`
- `web/data/source-summary.v2.json`

Later, these can become:

- `GET /api/dashboard/overview`
- `GET /api/trends`
- `GET /api/trends/:id`
- `GET /api/sources`

## Canonical V2 Entities

The frontend should treat these as the canonical public entities.

### Trend Summary

Used in overview cards, explorer rows, and related trend lists.

```json
{
  "id": "ai-agents",
  "name": "AI Agents",
  "category": "artificial-intelligence",
  "status": "breakout",
  "rank": 1,
  "previousRank": 4,
  "rankChange": 3,
  "firstSeenAt": "2026-03-02T12:00:00Z",
  "latestSignalAt": "2026-03-09T21:08:16Z",
  "score": {
    "total": 42.4,
    "social": 18.2,
    "developer": 16.1,
    "knowledge": 6.4,
    "search": 0.0,
    "diversity": 1.7
  },
  "momentum": {
    "absoluteDelta": 11.3,
    "percentDelta": 36.3,
    "velocity": 2.1,
    "acceleration": 0.4
  },
  "coverage": {
    "sourceCount": 3,
    "signalCount": 18,
    "evidenceCount": 8
  },
  "confidence": {
    "score": 0.84,
    "label": "high"
  },
  "sources": ["reddit", "github", "wikipedia"],
  "evidencePreview": [
    "AI agents are replacing repetitive office workflows",
    "New agent frameworks saw a spike in repositories and discussion"
  ]
}
```

### Trend Detail

Used by a dedicated trend page.

```json
{
  "generatedAt": "2026-03-09T21:08:16Z",
  "trend": {
    "id": "ai-agents",
    "name": "AI Agents",
    "category": "artificial-intelligence",
    "description": "Autonomous software systems that plan and act toward goals.",
    "status": "breakout",
    "rank": 1,
    "previousRank": 4,
    "rankChange": 3,
    "firstSeenAt": "2026-03-02T12:00:00Z",
    "latestSignalAt": "2026-03-09T21:08:16Z",
    "score": {
      "total": 42.4,
      "social": 18.2,
      "developer": 16.1,
      "knowledge": 6.4,
      "search": 0.0,
      "diversity": 1.7
    },
    "momentum": {
      "absoluteDelta": 11.3,
      "percentDelta": 36.3,
      "velocity": 2.1,
      "acceleration": 0.4
    },
    "coverage": {
      "sourceCount": 3,
      "signalCount": 18,
      "evidenceCount": 8
    },
    "confidence": {
      "score": 0.84,
      "label": "high"
    },
    "sources": [
      {
        "name": "reddit",
        "signalCount": 7,
        "weightContribution": 18.2,
        "latestSignalAt": "2026-03-09T20:42:00Z"
      },
      {
        "name": "github",
        "signalCount": 6,
        "weightContribution": 16.1,
        "latestSignalAt": "2026-03-09T20:15:00Z"
      },
      {
        "name": "wikipedia",
        "signalCount": 5,
        "weightContribution": 6.4,
        "latestSignalAt": "2026-03-09T19:58:00Z"
      }
    ],
    "history": [
      {
        "capturedAt": "2026-03-07T21:00:00Z",
        "rank": 7,
        "scoreTotal": 20.4
      },
      {
        "capturedAt": "2026-03-08T21:00:00Z",
        "rank": 4,
        "scoreTotal": 31.1
      },
      {
        "capturedAt": "2026-03-09T21:08:16Z",
        "rank": 1,
        "scoreTotal": 42.4
      }
    ],
    "evidenceItems": [
      {
        "source": "reddit",
        "title": "AI agents are replacing repetitive office workflows",
        "url": "https://example.com",
        "timestamp": "2026-03-09T20:42:00Z",
        "signalValue": 12.0
      }
    ],
    "relatedTrends": [
      {
        "id": "agentic-workflows",
        "name": "Agentic Workflows",
        "rank": 6
      }
    ]
  }
}
```

### Dashboard Overview

Used by the landing page.

```json
{
  "generatedAt": "2026-03-09T21:08:16Z",
  "summary": {
    "trendCount": 50,
    "activeSources": 4,
    "snapshotCount": 10,
    "lastRunAt": "2026-03-09T21:08:16Z"
  },
  "highlights": {
    "topTrend": "ai-agents",
    "biggestMover": "battery-recycling",
    "newEntry": "local-first-ai"
  },
  "sections": {
    "topTrends": [],
    "breakoutTrends": [],
    "risingTrends": []
  }
}
```

### Source Summary

Used by a source health and contribution panel.

```json
{
  "generatedAt": "2026-03-09T21:08:16Z",
  "sources": [
    {
      "name": "reddit",
      "displayName": "Reddit",
      "lastSuccessfulFetchAt": "2026-03-09T21:05:00Z",
      "status": "ok",
      "usedFallback": false,
      "rawItemCount": 30,
      "normalizedSignalCount": 80,
      "topTrendIds": ["ai-agents", "battery-recycling"]
    }
  ]
}
```

## Required Backend Changes

The V2 schema needs data that is not currently exported, and some of it is not currently persisted.

### 1. Persist enough information to compute movement

Current state:

- ranked snapshots exist
- each snapshot stores topic scores by run

Needed additions:

- a stable trend history lookup by topic across runs
- the previous rank for each topic
- the first-seen timestamp for each topic

Implementation note:

- this can be derived from `trend_score_snapshots` if repository helpers are added
- no new table is required for the first movement implementation

### 2. Persist enough information to build source breakdowns

Current state:

- `TrendScoreResult.source_counts` is persisted as JSON
- no per-source score contribution is stored directly

Needed additions:

- source-level signal counts per topic per run
- source-level weighted contribution per topic per run

Implementation note:

- add a derived breakdown object during score calculation
- persist it in snapshot rows as JSON rather than recomputing in the frontend

### 3. Persist enough information to render evidence drill-down

Current state:

- only summarized evidence strings survive into scores
- raw signal rows exist in `signals`, but they are replaced on every run

Needed additions:

- timestamped evidence items tied to a run and a topic
- source, title or evidence text, URL when available, and signal value

Implementation note:

- this likely needs a new snapshot evidence table because the current `signals` table is destructive

### 4. Add lightweight categorization and confidence

Current state:

- no category or confidence model exists

Needed additions:

- category assignment
- confidence score and label

Implementation note:

- start with deterministic heuristics
- category can be rule-based
- confidence can combine source diversity, evidence count, and history length

## Suggested Python Model Additions

Add public-facing internal models before updating serializers.

Recommended additions to [app/models.py](/Users/jakewarburton/Documents/repos/trend-friend/app/models.py):

- `TrendMomentum`
- `TrendCoverage`
- `TrendConfidence`
- `TrendSourceBreakdown`
- `TrendHistoryPoint`
- `TrendEvidenceItem`
- `TrendDetailResult`

Keep `TrendScoreResult` as the scoring primitive and build richer view models in the export layer or a dedicated read-model layer.

## Suggested Repository Additions

Add read helpers to [app/data/repositories.py](/Users/jakewarburton/Documents/repos/trend-friend/app/data/repositories.py):

- `get_topic_history(topic: str, limit_runs: int) -> list[TrendHistoryPoint]`
- `get_previous_rank(topic: str, current_run_id: int) -> int | None`
- `get_first_seen_at(topic: str) -> datetime | None`
- `list_latest_trend_details(limit: int) -> list[TrendDetailResult]`
- `list_source_run_summaries(limit_runs: int) -> list[SourceRunSummary]`

If evidence snapshots are added, also add:

- `append_snapshot_evidence(run_id: int, signals: list[NormalizedSignal]) -> None`
- `list_trend_evidence(topic: str, limit: int) -> list[TrendEvidenceItem]`

## Suggested Export Layer Structure

Keep serialization separate from repository concerns.

Recommended modules:

- `app/exports/contracts.py`
  - public DTOs
- `app/exports/serializers.py`
  - DTO to JSON serialization
- `app/exports/builders.py`
  - build overview, explorer, detail, and source payloads from repository data

This avoids turning serializers into mini service objects.

## Suggested Frontend Structure

Keep the web app thin and consume V2 payloads through typed loaders.

Recommended additions:

- [web/lib/types.ts](/Users/jakewarburton/Documents/repos/trend-friend/web/lib/types.ts)
  - add V2 payload types
- [web/lib/trends.ts](/Users/jakewarburton/Documents/repos/trend-friend/web/lib/trends.ts)
  - add V2 loader functions
- `web/app/trends/[id]/page.tsx`
  - trend detail page
- `web/components/overview-shell.tsx`
  - overview layout
- `web/components/trend-table.tsx`
  - explorer table
- `web/components/trend-detail-shell.tsx`
  - detail layout

## Rollout Plan

### Phase 1: Backend read model

- add repository helpers for topic history, previous rank, and first-seen time
- compute momentum from historical snapshots
- define internal read models for trend summary and trend detail
- keep current exports unchanged

Success condition:

- Python can build a trend summary list with movement fields from existing snapshot data

### Phase 2: V2 contract and parallel exports

- add V2 DTOs in `app/exports/contracts.py`
- add builders and serializers for overview, explorer, detail index, and source summary
- write new `.v2.json` files beside the current ones
- add tests for shape and deterministic field generation

Success condition:

- V1 dashboard still works
- V2 exports are generated from the same pipeline run

### Phase 3: Frontend overview and explorer

- add an overview page section using overview payloads
- replace the current card-only list with a sortable explorer table
- keep refresh behavior unchanged

Success condition:

- users can sort and filter a much larger trend set without frontend-only derivations

### Phase 4: Trend detail pages

- add route per trend ID
- render score history, rank history, source breakdown, and evidence timeline
- link overview and explorer items to detail pages

Success condition:

- a user can inspect why a topic is trending without leaving the app

### Phase 5: New sources and category coverage

- add new source adapters one at a time
- map them into existing score components or add new ones if justified
- refine category and confidence heuristics

Success condition:

- dashboard breadth increases without requiring structural UI rewrites

## Testing Plan

Add tests in these areas:

- repository history queries
- movement calculation
- first-seen and previous-rank derivation
- V2 export contract generation
- source summary generation
- detail payload generation

Recommended files:

- `tests/test_repositories.py`
- `tests/test_exports.py`
- `tests/test_scoring.py`

Frontend testing can stay light initially if the payload contract is strongly typed and well covered in Python.

## Recommended First Implementation Slice

Build the smallest slice that unlocks the rest:

1. Add topic history repository helpers
2. Compute `previousRank`, `rankChange`, and `firstSeenAt`
3. Export `trend-explorer.v2.json`
4. Update the web app to render an explorer table from the V2 payload

This gives immediate value:

- more data on screen
- visible movement
- a scalable table-based UI
- no need to solve evidence snapshots or categorization on day one

## Decisions To Lock Early

These should be decided before implementation starts:

- whether V1 exports stay indefinitely or are removed after migration
- whether category is manual, heuristic, or absent in the first V2 release
- whether evidence drill-down requires raw URLs immediately
- whether new sources should map into existing score buckets or introduce new score dimensions

## Recommendation

Start with movement and explorer depth, not with more widgets.

The most valuable path is:

- richer trend summaries
- better history derivation
- a proper explorer table
- then detail pages
- then more sources

That sequence keeps the system legible and avoids building a bigger dashboard on top of a thin data model.
