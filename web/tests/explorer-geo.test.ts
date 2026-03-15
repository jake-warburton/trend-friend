import assert from "node:assert/strict";
import test from "node:test";

import { buildExplorerGeoMapData, trendMatchesGeo } from "@/lib/explorer-geo";
import type { TrendDetailRecord, TrendExplorerRecord } from "@/lib/types";

test("buildExplorerGeoMapData aggregates countries across visible trends with compressed intensity", () => {
  const trends: TrendExplorerRecord[] = [
    {
      id: "alpha",
      name: "Alpha Robotics",
      category: "developer-tools",
      status: "breakout",
      volatility: "medium",
      rank: 1,
      previousRank: null,
      rankChange: null,
      firstSeenAt: null,
      latestSignalAt: "2026-03-12T10:00:00Z",
      score: { total: 12, social: 3, developer: 5, knowledge: 2, search: 2, advertising: 0, diversity: 0 },
      momentum: { previousRank: null, rankChange: null, absoluteDelta: null, percentDelta: null },
      coverage: { sourceCount: 3, signalCount: 10 },
      sources: ["github", "reddit"],
      evidencePreview: ["Alpha Robotics breakout"],
    },
    {
      id: "beta",
      name: "Beta Compute",
      category: "ai-machine-learning",
      status: "rising",
      volatility: "high",
      rank: 2,
      previousRank: 3,
      rankChange: 1,
      firstSeenAt: null,
      latestSignalAt: "2026-03-12T10:00:00Z",
      score: { total: 10, social: 4, developer: 2, knowledge: 2, search: 2, advertising: 0, diversity: 0 },
      momentum: { previousRank: 3, rankChange: 1, absoluteDelta: 2, percentDelta: 25 },
      coverage: { sourceCount: 2, signalCount: 8 },
      sources: ["reddit", "google_trends"],
      evidencePreview: ["Beta Compute is accelerating"],
    },
  ];

  const alphaDetail = buildDetailRecord("alpha", "Alpha Robotics", 1, [
    { label: "United States", countryCode: "US", region: null, signalCount: 16, explicitCount: 10, inferredCount: 6, averageConfidence: 0.8 },
    { label: "United Kingdom", countryCode: "GB", region: null, signalCount: 4, explicitCount: 3, inferredCount: 1, averageConfidence: 0.6 },
  ]);
  const betaDetail = buildDetailRecord("beta", "Beta Compute", 2, [
    { label: "United States", countryCode: "US", region: null, signalCount: 9, explicitCount: 7, inferredCount: 2, averageConfidence: 0.9 },
    { label: "United Kingdom", countryCode: "GB", region: null, signalCount: 3, explicitCount: 1, inferredCount: 2, averageConfidence: 0.5 },
    { label: "Germany", countryCode: "DE", region: null, signalCount: 1, explicitCount: 1, inferredCount: 0, averageConfidence: 0.7 },
  ]);

  const result = buildExplorerGeoMapData(
    trends,
    new Map<string, TrendDetailRecord>([
      ["alpha", alphaDetail],
      ["beta", betaDetail],
    ]),
  );

  assert.deepEqual(
    result.map((entry) => [entry.countryCode, entry.signalCount]),
    [["US", 25], ["GB", 7], ["DE", 1]],
  );
  assert.equal(result[0]?.intensity, 1);
  assert.equal(result[1]?.intensity.toFixed(3), Math.sqrt(7 / 25).toFixed(3));
  assert.equal(result[0]?.averageConfidence.toFixed(3), ((16 * 0.8 + 9 * 0.9) / 25).toFixed(3));
  assert.deepEqual(
    result[0]?.contributingTrends?.map((trend) => [trend.id, trend.signalCount]),
    [["alpha", 16], ["beta", 9]],
  );
});

test("trendMatchesGeo respects selected country filters", () => {
  const detail = buildDetailRecord("alpha", "Alpha Robotics", 1, [
    { label: "United States", countryCode: "US", region: null, signalCount: 2, explicitCount: 2, inferredCount: 0, averageConfidence: 1 },
  ]);

  assert.equal(trendMatchesGeo(detail, "all"), true);
  assert.equal(trendMatchesGeo(detail, "US"), true);
  assert.equal(trendMatchesGeo(detail, "GB"), false);
  assert.equal(trendMatchesGeo(undefined, "US"), false);
});

function buildDetailRecord(
  id: string,
  name: string,
  rank: number,
  geoSummary: TrendDetailRecord["geoSummary"],
): TrendDetailRecord {
  return {
    id,
    name,
    category: "developer-tools",
    status: "breakout",
    volatility: "medium",
    rank,
    previousRank: null,
    rankChange: null,
    firstSeenAt: null,
    latestSignalAt: "2026-03-12T10:00:00Z",
    score: { total: 10, social: 2, developer: 4, knowledge: 2, search: 2, advertising: 0, diversity: 0 },
    momentum: { previousRank: null, rankChange: null, absoluteDelta: null, percentDelta: null },
    breakoutPrediction: { confidence: 0.8, predictedDirection: "up", signals: [] },
    forecast: null,
    opportunity: { composite: 5, discovery: 5, seo: 5, content: 5, product: 5, investment: 5, reasoning: [] },
    coverage: { sourceCount: 2, signalCount: 4 },
    sources: ["github"],
    history: [],
    sourceBreakdown: [],
    sourceContributions: [],
    geoSummary,
    audienceSummary: [],
    evidenceItems: [],
    relatedTrends: [],
    primaryEvidence: null,
    seasonality: null,
  };
}
