import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategoryDirectory,
  buildComparisonSuggestions,
  buildMetaTrendDirectory,
  findCategoryGroup,
  findMetaTrendGroup,
  slugifyBrowseValue,
} from "@/lib/trend-browse";
import type { TrendDetailRecord } from "@/lib/types";

function buildTrend(overrides: Partial<TrendDetailRecord> & Pick<TrendDetailRecord, "id" | "name" | "category" | "metaTrend" | "rank">): TrendDetailRecord {
  return {
    id: overrides.id,
    name: overrides.name,
    category: overrides.category,
    metaTrend: overrides.metaTrend,
    stage: overrides.stage ?? "rising",
    confidence: overrides.confidence ?? 0.8,
    summary: overrides.summary ?? `${overrides.name} summary`,
    whyNow: overrides.whyNow ?? [],
    status: overrides.status ?? "rising",
    volatility: overrides.volatility ?? "stable",
    rank: overrides.rank,
    previousRank: overrides.previousRank ?? overrides.rank + 1,
    rankChange: overrides.rankChange ?? 1,
    firstSeenAt: overrides.firstSeenAt ?? "2026-03-10T00:00:00Z",
    latestSignalAt: overrides.latestSignalAt ?? "2026-03-12T00:00:00Z",
    score: overrides.score ?? { total: 40 - overrides.rank, social: 10, developer: 8, knowledge: 6, search: 5, diversity: 4 },
    momentum: overrides.momentum ?? { previousRank: overrides.rank + 1, rankChange: 1, absoluteDelta: 4, percentDelta: 10 },
    breakoutPrediction: overrides.breakoutPrediction ?? { confidence: 0.7, predictedDirection: "breakout", signals: [] },
    forecast: overrides.forecast ?? null,
    opportunity: overrides.opportunity ?? { composite: 0.7, discovery: 0.6, seo: 0.5, content: 0.6, product: 0.8, investment: 0.5, reasoning: [] },
    coverage: overrides.coverage ?? { sourceCount: 3, signalCount: 5 },
    sources: overrides.sources ?? ["reddit", "github"],
    aliases: overrides.aliases ?? [overrides.name],
    history: overrides.history ?? [],
    sourceBreakdown: overrides.sourceBreakdown ?? [],
    sourceContributions: overrides.sourceContributions ?? [],
    geoSummary: overrides.geoSummary ?? [],
    audienceSummary: overrides.audienceSummary ?? [],
    evidenceItems: overrides.evidenceItems ?? [],
    primaryEvidence: overrides.primaryEvidence ?? null,
    duplicateCandidates: overrides.duplicateCandidates ?? [],
    relatedTrends: overrides.relatedTrends ?? [],
    seasonality: overrides.seasonality ?? null,
  };
}

const TRENDS: TrendDetailRecord[] = [
  buildTrend({
    id: "ai-agents",
    name: "AI Agents",
    category: "ai-machine-learning",
    metaTrend: "AI and automation",
    rank: 1,
    duplicateCandidates: [{ id: "ai-agent", name: "AI Agent", similarity: 0.82, reason: "Alias overlap." }],
    relatedTrends: [{ id: "agent-workflows", name: "Agent Workflows", status: "rising", rank: 3, scoreTotal: 33, relationshipStrength: 0.7 }],
  }),
  buildTrend({
    id: "ai-agent",
    name: "AI Agent",
    category: "ai-machine-learning",
    metaTrend: "AI and automation",
    rank: 2,
  }),
  buildTrend({
    id: "agent-workflows",
    name: "Agent Workflows",
    category: "developer-tools",
    metaTrend: "AI and automation",
    rank: 3,
  }),
  buildTrend({
    id: "battery-recycling",
    name: "Battery Recycling",
    category: "climate-energy",
    metaTrend: "Climate and energy",
    rank: 4,
  }),
];

test("buildMetaTrendDirectory groups trends by meta trend", () => {
  const directory = buildMetaTrendDirectory(TRENDS);

  assert.equal(directory[0].label, "AI and automation");
  assert.equal(directory[0].trendCount, 3);
  assert.equal(directory[0].topTrendId, "ai-agents");
  assert.ok(directory[0].categories.includes("developer-tools"));
});

test("buildCategoryDirectory groups trends by category", () => {
  const directory = buildCategoryDirectory(TRENDS);
  const ai = directory.find((item) => item.slug === "ai-machine-learning");

  assert.ok(ai);
  assert.equal(ai?.label, "AI Machine Learning");
  assert.equal(ai?.trendCount, 2);
  assert.equal(ai?.metaTrend, "AI and automation");
});

test("findMetaTrendGroup returns ranked trends for one meta trend", () => {
  const group = findMetaTrendGroup(TRENDS, "ai-and-automation");

  assert.ok(group);
  assert.equal(group?.label, "AI and automation");
  assert.equal(group?.trends[0].id, "ai-agents");
  assert.equal(group?.trendCount, 3);
});

test("findCategoryGroup returns ranked trends for one category", () => {
  const group = findCategoryGroup(TRENDS, "ai-machine-learning");

  assert.ok(group);
  assert.equal(group?.label, "AI Machine Learning");
  assert.equal(group?.topTrendId, "ai-agents");
});

test("buildComparisonSuggestions prioritizes duplicate and related candidates", () => {
  const suggestions = buildComparisonSuggestions(["ai-agents"], TRENDS);

  assert.deepEqual(
    suggestions.map((trend) => trend.id),
    ["ai-agent", "agent-workflows"],
  );
});

test("slugifyBrowseValue normalizes labels into route-safe slugs", () => {
  assert.equal(slugifyBrowseValue("AI and automation"), "ai-and-automation");
  assert.equal(slugifyBrowseValue("Climate / energy"), "climate-energy");
});
