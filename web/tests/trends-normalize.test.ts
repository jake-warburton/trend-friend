import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFallbackTrendDetailFromExplorer,
  buildFallbackTrendDetailFromOverviewItem,
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
  assert.deepEqual(result.sections.experimentalTrends, []);
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

test("normalizeDashboardOverview defaults missing source quality fields", () => {
  const input: DashboardOverviewResponse = {
    generatedAt: "2026-03-10T00:00:00Z",
    summary: { trackedTrends: 0, totalSignals: 0, sourceCount: 0, averageScore: 0 },
    highlights: {
      topTrendId: null,
      topTrendName: null,
      biggestMoverId: null,
      biggestMoverName: null,
      newestTrendId: null,
      newestTrendName: null,
    },
    charts: { topTrendScores: [], sourceShare: [], statusBreakdown: [] },
    sections: { topTrends: [], breakoutTrends: [], risingTrends: [], experimentalTrends: [], metaTrends: [] },
    operations: { lastRunAt: null, successRate: 0, averageDurationMs: 0, recentRuns: [] },
    sources: [
      {
        source: "reddit",
        signalCount: 10,
        trendCount: 5,
        status: "healthy",
        latestFetchAt: "2026-03-10T00:00:00Z",
        latestSuccessAt: "2026-03-10T00:00:00Z",
        rawItemCount: 20,
        latestItemCount: 10,
        keptItemCount: 8,
        yieldRatePercent: 40,
        durationMs: 1000,
      } as any,
    ],
  };

  const result = normalizeDashboardOverview(input);

  assert.equal(result.sources[0].rawTopicCount, 0);
  assert.equal(result.sources[0].mergedTopicCount, 0);
  assert.equal(result.sources[0].duplicateTopicRate, 0);
  assert.equal(result.sources[0].family, "other");
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
    sections: { topTrends: [], breakoutTrends: [], risingTrends: [], experimentalTrends: [], metaTrends: [] },
    operations: { lastRunAt: "2026-03-10T00:00:00Z", successRate: 1.0, averageDurationMs: 5000, recentRuns: [] },
    sources: [],
  };
  const result = normalizeDashboardOverview(input);

  assert.equal(result.summary.trackedTrends, 50);
  assert.equal(result.highlights.topTrendId, "ai-agents");
  assert.equal(result.charts.topTrendScores.length, 1);
  assert.equal(result.operations.successRate, 1.0);
  assert.deepEqual(result.sections.experimentalTrends, []);
});

test("normalizeDashboardOverview defaults missing run quality fields", () => {
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
    sections: { topTrends: [], breakoutTrends: [], risingTrends: [], experimentalTrends: [], metaTrends: [] },
    operations: {
      lastRunAt: "2026-03-10T00:00:00Z",
      successRate: 1.0,
      averageDurationMs: 5000,
      recentRuns: [
        {
          capturedAt: "2026-03-10T00:00:00Z",
          durationMs: 5000,
          sourceCount: 6,
          successfulSourceCount: 6,
          failedSourceCount: 0,
          signalCount: 200,
          rankedTrendCount: 100,
          status: "healthy",
          topTrendId: "ai-agents",
          topTrendName: "AI Agents",
          topScore: 42.4,
        } as any,
      ],
    },
    sources: [],
  };

  const result = normalizeDashboardOverview(input);

  assert.equal(result.operations.recentRuns[0].rawTopicCount, 0);
  assert.equal(result.operations.recentRuns[0].duplicateTopicRate, 0);
  assert.equal(result.operations.recentRuns[0].lowEvidenceTrendCount, 0);
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
  assert.equal(trend.metaTrend, "General");
  assert.equal(trend.stage, "steady");
  assert.equal(trend.confidence, 0);
  assert.equal(trend.summary, "");
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
        metaTrend: "AI and automation",
        stage: "breakout",
        confidence: 0.91,
        summary: "AI Agents is a breakout AI trend.",
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
  assert.equal(trend.metaTrend, "AI and automation");
  assert.equal(trend.stage, "breakout");
  assert.equal(trend.confidence, 0.91);
  assert.equal(trend.summary, "AI Agents is a breakout AI trend.");
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
  assert.equal(result.metaTrend, "General");
  assert.equal(result.stage, "steady");
  assert.equal(result.confidence, 0);
  assert.equal(result.summary, "");
  assert.deepEqual(result.whyNow, []);
  assert.deepEqual(result.aliases, []);
  assert.equal(result.forecast, null);
  assert.deepEqual(result.opportunity, {
    composite: 0,
    discovery: 0,
    seo: 0,
    content: 0,
    product: 0,
    investment: 0,
    reasoning: [],
  });
  assert.deepEqual(result.history, []);
  assert.deepEqual(result.sourceBreakdown, []);
  assert.deepEqual(result.sourceContributions, []);
  assert.deepEqual(result.marketFootprint, []);
  assert.deepEqual(result.geoSummary, []);
  assert.deepEqual(result.duplicateCandidates, []);
  assert.deepEqual(result.relatedTrends, []);
});

test("normalizeTrendDetailRecord normalizes existing forecast", () => {
  const input = {
    id: "ai-agents",
    name: "AI Agents",
    rank: 1,
    metaTrend: "AI and automation",
    stage: "breakout",
    confidence: 0.88,
    summary: "AI Agents is a breakout AI trend.",
    whyNow: ["Social signals are leading."],
    aliases: ["AI Agents", "ai agents"],
    marketFootprint: [
      {
        source: "google_trends",
        metricKey: "search_traffic",
        label: "Google search traffic",
        valueNumeric: 2400000,
        valueDisplay: "2.4M",
        unit: "searches",
        period: "current run",
        capturedAt: "2026-03-10T00:00:00Z",
        confidence: 0.88,
        provenanceUrl: "https://trends.google.com/example",
        isEstimated: false,
      },
    ],
    duplicateCandidates: [{ id: "ai-agent", name: "AI Agent", similarity: 0.8, reason: "Tracked aliases overlap." }],
    latestSignalAt: "2026-03-10T00:00:00Z",
    score: { total: 42, social: 15, developer: 10, knowledge: 6, search: 5, diversity: 6 },
    forecast: { predictedScores: [45, 48], confidence: "high", mape: 8.5, method: "holt" },
    breakoutPrediction: { confidence: 0.85, predictedDirection: "up", signals: ["Rising score"] },
    opportunity: { composite: 7.5, discovery: 6.5, seo: 6.8, content: 6, product: 8, investment: 7, reasoning: ["Strong momentum"] },
  } as any as TrendDetailRecord;

  const result = normalizeTrendDetailRecord(input);

  assert.deepEqual(result.forecast, {
    predictedScores: [45, 48],
    confidence: "high",
    mape: 8.5,
    method: "holt",
  });
  assert.equal(result.metaTrend, "AI and automation");
  assert.equal(result.stage, "breakout");
  assert.equal(result.confidence, 0.88);
  assert.equal(result.summary, "AI Agents is a breakout AI trend.");
  assert.deepEqual(result.whyNow, ["Social signals are leading."]);
  assert.deepEqual(result.aliases, ["AI Agents", "ai agents"]);
  assert.equal(result.marketFootprint[0].label, "Google search traffic");
  assert.equal(result.marketFootprint[0].valueDisplay, "2.4M");
  assert.equal(result.duplicateCandidates[0].id, "ai-agent");
  assert.equal(result.duplicateCandidates[0].similarity, 0.8);
  assert.equal(result.breakoutPrediction.confidence, 0.85);
  assert.equal(result.opportunity.composite, 7.5);
  assert.equal(result.opportunity.discovery, 6.5);
  assert.equal(result.opportunity.seo, 6.8);
  assert.equal(result.opportunity.reasoning[0], "Strong momentum");
});

test("buildFallbackTrendDetailFromExplorer synthesizes a usable detail record", () => {
  const result = buildFallbackTrendDetailFromExplorer(
    {
      id: "awesome-multimodal-object-tracking",
      name: "Awesome Multimodal Object Tracking",
      category: "developer-tools",
      metaTrend: "Computer vision",
      stage: "nascent",
      confidence: 0.42,
      summary: "",
      status: "experimental",
      volatility: "emerging",
      rank: 91,
      previousRank: null,
      rankChange: null,
      firstSeenAt: null,
      latestSignalAt: "2026-03-13T00:00:00Z",
      score: { total: 14.4, social: 1.2, developer: 9.4, knowledge: 0.8, search: 1.1, diversity: 1.9 },
      momentum: { previousRank: null, rankChange: null, absoluteDelta: null, percentDelta: null },
      coverage: { sourceCount: 2, signalCount: 4 },
      sources: ["github", "reddit"],
      evidencePreview: ["GitHub repo stars accelerated this run."],
      audienceSummary: [],
      primaryEvidence: null,
      seasonality: null,
      forecastDirection: null,
    },
    "2026-03-13T00:00:00Z",
  );

  assert.equal(result.id, "awesome-multimodal-object-tracking");
  assert.equal(result.status, "experimental");
  assert.equal(result.summary.includes("full detail enrichment"), true);
  assert.equal(result.whyNow[0], "GitHub repo stars accelerated this run.");
  assert.equal(result.sourceBreakdown.length, 2);
  assert.equal(result.breakoutPrediction.predictedDirection, "stable");
});

test("buildFallbackTrendDetailFromOverviewItem synthesizes experimental detail from overview data", () => {
  const overview = normalizeDashboardOverview({
    generatedAt: "2026-03-13T00:00:00Z",
    summary: { trackedTrends: 0, totalSignals: 0, sourceCount: 0, averageScore: 0 },
    highlights: {
      topTrendId: null,
      topTrendName: null,
      biggestMoverId: null,
      biggestMoverName: null,
      newestTrendId: null,
      newestTrendName: null,
    },
    charts: { topTrendScores: [], sourceShare: [], statusBreakdown: [] },
    sections: {
      topTrends: [],
      breakoutTrends: [],
      risingTrends: [],
      experimentalTrends: [
        {
          id: "awesome-multimodal-object-tracking",
          name: "Awesome Multimodal Object Tracking",
          category: "developer-tools",
          status: "experimental",
          rank: 91,
          scoreTotal: 14.4,
        },
      ],
      metaTrends: [],
    },
    operations: { lastRunAt: null, successRate: 0, averageDurationMs: 0, recentRuns: [] },
    sources: [],
  });

  const result = buildFallbackTrendDetailFromOverviewItem(overview.sections.experimentalTrends[0], overview);

  assert.equal(result.id, "awesome-multimodal-object-tracking");
  assert.equal(result.status, "experimental");
  assert.equal(result.metaTrend, "Experimental");
  assert.equal(result.rank, 91);
  assert.equal(result.score.total, 14.4);
  assert.equal(result.whyNow[0], "This topic is currently ranked in the experimental bucket.");
});

// ── normalizeSourceSummary ──────────────────────────────────────────────

test("normalizeSourceSummary defaults missing source fields", () => {
  const input: SourceSummaryResponse = {
    generatedAt: "2026-03-10T00:00:00Z",
    sources: [{ source: "reddit" } as any],
    familyHistory: [],
  };
  const result = normalizeSourceSummary(input);
  const source = result.sources[0];

  assert.equal(source.status, "stale");
  assert.equal(source.family, "other");
  assert.equal(source.latestFetchAt, null);
  assert.equal(source.signalCount, 0);
  assert.equal(source.trendCount, 0);
  assert.equal(source.usedFallback, false);
  assert.equal(source.errorMessage, null);
  assert.deepEqual(source.runHistory, []);
  assert.deepEqual(source.topTrends, []);
  assert.deepEqual(result.familyHistory, []);
});

test("normalizeSourceSummary handles empty sources array", () => {
  const input = { generatedAt: "2026-03-10T00:00:00Z" } as SourceSummaryResponse;
  const result = normalizeSourceSummary(input);

  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.familyHistory, []);
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
    familyHistory: [
      {
        family: "community",
        label: "Community",
        capturedAt: "2026-03-10T00:00:00Z",
      } as any,
    ],
  };
  const result = normalizeSourceSummary(input);
  const run = result.sources[0].runHistory[0];
  const family = result.familyHistory[0];

  assert.equal(run.fetchedAt, "2026-03-10T00:00:00Z");
  assert.equal(run.success, false);
  assert.equal(run.rawItemCount, 0);
  assert.equal(run.usedFallback, false);
  assert.equal(run.errorMessage, null);
  assert.equal(family.family, "community");
  assert.equal(family.topRankedTrendCount, 0);
  assert.equal(family.successRatePercent, 0);
});
