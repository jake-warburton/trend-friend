import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDashboardOverview,
  normalizeTrendExplorer,
  normalizeTrendDetailRecord,
  normalizeSourceSummary,
} from "@/lib/trends";
import type {
  DashboardOverviewResponse,
  TrendExplorerResponse,
  TrendDetailRecord,
  SourceSummaryResponse,
} from "@/lib/types";

// ── normalizeDashboardOverview ──────────────────────────────────────────

test("normalizeDashboardOverview fills missing summary fields with zeros", () => {
  const input = { generatedAt: "2026-03-10T00:00:00Z" } as DashboardOverviewResponse;
  const result = normalizeDashboardOverview(input);

  assert.equal(result.summary.trackedTrends, 0);
  assert.equal(result.summary.totalSignals, 0);
  assert.equal(result.summary.sourceCount, 0);
  assert.equal(result.summary.averageScore, 0);
});

test("normalizeDashboardOverview fills missing highlights with nulls", () => {
  const input = { generatedAt: "2026-03-10T00:00:00Z" } as DashboardOverviewResponse;
  const result = normalizeDashboardOverview(input);

  assert.equal(result.highlights.topTrendId, null);
  assert.equal(result.highlights.biggestMoverId, null);
  assert.equal(result.highlights.newestTrendId, null);
});

test("normalizeDashboardOverview defaults empty charts and sections", () => {
  const input = { generatedAt: "2026-03-10T00:00:00Z" } as DashboardOverviewResponse;
  const result = normalizeDashboardOverview(input);

  assert.deepEqual(result.charts.topTrendScores, []);
  assert.deepEqual(result.charts.sourceShare, []);
  assert.deepEqual(result.sections.topTrends, []);
  assert.deepEqual(result.sections.breakoutTrends, []);
  assert.deepEqual(result.sections.metaTrends, []);
});

test("normalizeDashboardOverview defaults missing operations", () => {
  const input = { generatedAt: "2026-03-10T00:00:00Z" } as DashboardOverviewResponse;
  const result = normalizeDashboardOverview(input);

  assert.equal(result.operations.lastRunAt, null);
  assert.equal(result.operations.successRate, 0);
  assert.deepEqual(result.operations.recentRuns, []);
});

test("normalizeDashboardOverview defaults missing sources and sourceWatch", () => {
  const input = { generatedAt: "2026-03-10T00:00:00Z" } as DashboardOverviewResponse;
  const result = normalizeDashboardOverview(input);

  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.sourceWatch, []);
});

test("normalizeDashboardOverview preserves provided values", () => {
  const input: DashboardOverviewResponse = {
    generatedAt: "2026-03-10T00:00:00Z",
    summary: { trackedTrends: 50, totalSignals: 200, sourceCount: 6, averageScore: 32.5 },
    highlights: {
      topTrendId: "ai-agents",
      topTrendName: "AI Agents",
      biggestMoverId: null,
      biggestMoverName: null,
      newestTrendId: null,
      newestTrendName: null,
    },
    charts: { topTrendScores: [{ label: "AI", value: 50 }], sourceShare: [], statusBreakdown: [] },
    sections: { topTrends: [], breakoutTrends: [], risingTrends: [], metaTrends: [] },
    operations: { lastRunAt: "2026-03-10T00:00:00Z", successRate: 1.0, averageDurationMs: 5000, recentRuns: [] },
    sources: [],
  };
  const result = normalizeDashboardOverview(input);

  assert.equal(result.summary.trackedTrends, 50);
  assert.equal(result.highlights.topTrendId, "ai-agents");
  assert.equal(result.charts.topTrendScores.length, 1);
  assert.equal(result.operations.successRate, 1.0);
});

// ── normalizeTrendExplorer ──────────────────────────────────────────────

test("normalizeTrendExplorer defaults missing trend fields", () => {
  const input: TrendExplorerResponse = {
    generatedAt: "2026-03-10T00:00:00Z",
    trends: [
      {
        id: "ai-agents",
        name: "AI Agents",
        rank: 1,
        latestSignalAt: "2026-03-10T00:00:00Z",
        score: { total: 42, social: 15, developer: 10, knowledge: 6, search: 5, diversity: 6 },
      } as any,
    ],
  };
  const result = normalizeTrendExplorer(input);
  const trend = result.trends[0];

  assert.equal(trend.category, "general-tech");
  assert.equal(trend.status, "steady");
  assert.equal(trend.volatility, "stable");
  assert.equal(trend.previousRank, null);
  assert.equal(trend.rankChange, null);
  assert.equal(trend.firstSeenAt, null);
  assert.deepEqual(trend.momentum, {
    previousRank: null,
    rankChange: null,
    absoluteDelta: null,
    percentDelta: null,
  });
  assert.deepEqual(trend.coverage, { sourceCount: 0, signalCount: 0 });
  assert.deepEqual(trend.sources, []);
  assert.deepEqual(trend.evidencePreview, []);
  assert.equal(trend.forecastDirection, null);
});

test("normalizeTrendExplorer preserves provided momentum and coverage", () => {
  const input: TrendExplorerResponse = {
    generatedAt: "2026-03-10T00:00:00Z",
    trends: [
      {
        id: "ai-agents",
        name: "AI Agents",
        category: "artificial-intelligence",
        status: "breakout",
        volatility: "spiking",
        rank: 1,
        previousRank: 4,
        rankChange: 3,
        firstSeenAt: "2026-03-01T00:00:00Z",
        latestSignalAt: "2026-03-10T00:00:00Z",
        score: { total: 42, social: 15, developer: 10, knowledge: 6, search: 5, diversity: 6 },
        momentum: { previousRank: 4, rankChange: 3, absoluteDelta: 12.3, percentDelta: 40.2 },
        coverage: { sourceCount: 4, signalCount: 12 },
        sources: ["reddit", "github"],
        evidencePreview: ["Evidence 1"],
        forecastDirection: "accelerating",
      } as any,
    ],
  };
  const result = normalizeTrendExplorer(input);
  const trend = result.trends[0];

  assert.equal(trend.category, "artificial-intelligence");
  assert.equal(trend.status, "breakout");
  assert.equal(trend.momentum.percentDelta, 40.2);
  assert.equal(trend.coverage.signalCount, 12);
  assert.equal(trend.forecastDirection, "accelerating");
});

// ── normalizeTrendDetailRecord ──────────────────────────────────────────

test("normalizeTrendDetailRecord defaults breakout, forecast, and opportunity", () => {
  const input = {
    id: "ai-agents",
    name: "AI Agents",
    rank: 1,
    latestSignalAt: "2026-03-10T00:00:00Z",
    score: { total: 42, social: 15, developer: 10, knowledge: 6, search: 5, diversity: 6 },
  } as any as TrendDetailRecord;

  const result = normalizeTrendDetailRecord(input);

  assert.deepEqual(result.breakoutPrediction, {
    confidence: 0,
    predictedDirection: "stable",
    signals: [],
  });
  assert.equal(result.forecast, null);
  assert.deepEqual(result.opportunity, {
    composite: 0,
    content: 0,
    product: 0,
    investment: 0,
    reasoning: [],
  });
  assert.deepEqual(result.history, []);
  assert.deepEqual(result.sourceBreakdown, []);
  assert.deepEqual(result.sourceContributions, []);
  assert.deepEqual(result.geoSummary, []);
  assert.deepEqual(result.relatedTrends, []);
});

test("normalizeTrendDetailRecord normalizes existing forecast", () => {
  const input = {
    id: "ai-agents",
    name: "AI Agents",
    rank: 1,
    latestSignalAt: "2026-03-10T00:00:00Z",
    score: { total: 42, social: 15, developer: 10, knowledge: 6, search: 5, diversity: 6 },
    forecast: { predictedScores: [45, 48], confidence: "high", mape: 8.5, method: "holt" },
    breakoutPrediction: { confidence: 0.85, predictedDirection: "up", signals: ["Rising score"] },
    opportunity: { composite: 7.5, content: 6, product: 8, investment: 7, reasoning: ["Strong momentum"] },
  } as any as TrendDetailRecord;

  const result = normalizeTrendDetailRecord(input);

  assert.deepEqual(result.forecast, {
    predictedScores: [45, 48],
    confidence: "high",
    mape: 8.5,
    method: "holt",
  });
  assert.equal(result.breakoutPrediction.confidence, 0.85);
  assert.equal(result.opportunity.composite, 7.5);
  assert.equal(result.opportunity.reasoning[0], "Strong momentum");
});

// ── normalizeSourceSummary ──────────────────────────────────────────────

test("normalizeSourceSummary defaults missing source fields", () => {
  const input: SourceSummaryResponse = {
    generatedAt: "2026-03-10T00:00:00Z",
    sources: [{ source: "reddit" } as any],
  };
  const result = normalizeSourceSummary(input);
  const source = result.sources[0];

  assert.equal(source.status, "stale");
  assert.equal(source.latestFetchAt, null);
  assert.equal(source.signalCount, 0);
  assert.equal(source.trendCount, 0);
  assert.equal(source.usedFallback, false);
  assert.equal(source.errorMessage, null);
  assert.deepEqual(source.runHistory, []);
  assert.deepEqual(source.topTrends, []);
});

test("normalizeSourceSummary handles empty sources array", () => {
  const input = { generatedAt: "2026-03-10T00:00:00Z" } as SourceSummaryResponse;
  const result = normalizeSourceSummary(input);

  assert.deepEqual(result.sources, []);
});

test("normalizeSourceSummary preserves run history with defaults", () => {
  const input: SourceSummaryResponse = {
    generatedAt: "2026-03-10T00:00:00Z",
    sources: [
      {
        source: "reddit",
        runHistory: [{ fetchedAt: "2026-03-10T00:00:00Z" } as any],
      } as any,
    ],
  };
  const result = normalizeSourceSummary(input);
  const run = result.sources[0].runHistory[0];

  assert.equal(run.fetchedAt, "2026-03-10T00:00:00Z");
  assert.equal(run.success, false);
  assert.equal(run.rawItemCount, 0);
  assert.equal(run.usedFallback, false);
  assert.equal(run.errorMessage, null);
});
