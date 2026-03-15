import assert from "node:assert/strict";
import test from "node:test";

import { GET, handleExportGet } from "@/app/api/export/route";
import type { TrendDetailRecord, TrendExplorerRecord } from "@/lib/types";
import { confidenceBucketForTrend, trendMatchesAudience, trendMatchesMarket, trendMatchesLanguage } from "@/lib/trend-filters";

/**
 * The GET handler reads from loadTrendExplorer which falls back to an empty
 * JSON file. In tests there is no data directory, so it returns an empty
 * trend list. The CSV should still include a header row.
 */

test("export CSV route returns text/csv with a header row", async () => {
  const response = await GET();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/csv");

  const disposition = response.headers.get("Content-Disposition") ?? "";
  assert.ok(disposition.startsWith('attachment; filename="signal-eye-export-'));
  assert.ok(disposition.endsWith('.csv"'));

  const body = await response.text();
  const lines = body.trimEnd().split("\n");
  assert.ok(lines.length >= 1, "CSV must contain at least a header row");

  const header = lines[0];
  assert.ok(header.includes("rank"), "Header must include rank");
  assert.ok(header.includes("name"), "Header must include name");
  assert.ok(header.includes("category"), "Header must include category");
  assert.ok(header.includes("score"), "Header must include score");
  assert.ok(header.includes("sources"), "Header must include sources");
});

test("export CSV header has the expected columns", async () => {
  const response = await GET();
  const body = await response.text();
  const header = body.split("\n")[0];
  const columns = header.split(",");

  assert.deepEqual(columns, [
    "rank",
    "name",
    "category",
    "status",
    "volatility",
    "score",
    "social_score",
    "developer_score",
    "knowledge_score",
    "search_score",
    "diversity_score",
    "discovery_score",
    "seo_score",
    "content_score",
    "product_score",
    "investment_score",
    "rank_change",
    "momentum_pct",
    "source_count",
    "signal_count",
    "sources",
    "audience_segments",
    "market_segments",
    "language_segments",
    "forecast_direction",
    "first_seen",
    "latest_signal",
  ]);
});

test("export CSV applies detail-backed explorer filters", async () => {
  const explorerTrends: TrendExplorerRecord[] = [
    {
      id: "ai-agents",
      name: "AI Agents",
      category: "ai-machine-learning",
      metaTrend: "AI",
      stage: "rising",
      confidence: 0.82,
      summary: "Agent systems are accelerating.",
      status: "rising",
      volatility: "stable",
      rank: 1,
      previousRank: 2,
      rankChange: 1,
      firstSeenAt: "2026-03-10T00:00:00Z",
      latestSignalAt: "2026-03-12T00:00:00Z",
      score: { total: 42, social: 12, developer: 10, knowledge: 8, search: 7, advertising: 0, diversity: 5 },
      momentum: { previousRank: 2, rankChange: 1, absoluteDelta: 4, percentDelta: 12 },
      coverage: { sourceCount: 3, signalCount: 7 },
      sources: ["github", "reddit"],
      evidencePreview: ["Developers are building more agent tooling"],
      audienceSummary: [{ segmentType: "audience", label: "developer", signalCount: 3 }],
      primaryEvidence: null,
      recentHistory: [],
      seasonality: null,
      forecastDirection: "accelerating",
    },
    {
      id: "consumer-video",
      name: "Consumer Video",
      category: "creator-tools",
      metaTrend: "Creator economy",
      stage: "rising",
      confidence: 0.64,
      summary: "Video workflows for creators.",
      status: "rising",
      volatility: "stable",
      rank: 2,
      previousRank: 3,
      rankChange: 1,
      firstSeenAt: "2026-03-09T00:00:00Z",
      latestSignalAt: "2026-03-11T00:00:00Z",
      score: { total: 31, social: 14, developer: 3, knowledge: 4, search: 6, advertising: 0, diversity: 4 },
      momentum: { previousRank: 3, rankChange: 1, absoluteDelta: 2, percentDelta: 8 },
      coverage: { sourceCount: 2, signalCount: 5 },
      sources: ["youtube"],
      evidencePreview: ["Creators are adopting new editing stacks"],
      audienceSummary: [{ segmentType: "audience", label: "creator", signalCount: 2 }],
      primaryEvidence: null,
      recentHistory: [],
      seasonality: null,
      forecastDirection: null,
    },
  ];

  const detailRecord = (id: string, audience: string, languageCode: string, countryCode: string): TrendDetailRecord =>
    ({
      id,
      name: id,
      category: "ai-machine-learning",
      metaTrend: "AI",
      stage: "rising",
      confidence: 0.8,
      summary: "",
      whyNow: [],
      status: "rising",
      volatility: "stable",
      rank: 1,
      previousRank: 2,
      rankChange: 1,
      firstSeenAt: "2026-03-10T00:00:00Z",
      latestSignalAt: "2026-03-12T00:00:00Z",
      score: { total: 42, social: 12, developer: 10, knowledge: 8, search: 7, advertising: 0, diversity: 5 },
      momentum: { previousRank: 2, rankChange: 1, absoluteDelta: 4, percentDelta: 12 },
      breakoutPrediction: { confidence: 0.7, predictedDirection: "up", signals: [] },
      forecast: null,
      opportunity: { composite: 8, discovery: 9, seo: 5, content: 4, product: 10, investment: 3, reasoning: [] },
      coverage: { sourceCount: 3, signalCount: 7 },
      sources: ["github"],
      aliases: [],
      history: [],
      sourceBreakdown: [],
      sourceContributions: [],
      marketFootprint: [],
      geoSummary: [
        {
          label: "United States",
          countryCode,
          region: null,
          signalCount: 3,
          explicitCount: 3,
          inferredCount: 0,
          averageConfidence: 1,
        },
      ],
      audienceSummary: [
        { segmentType: "audience", label: audience, signalCount: 3 },
        { segmentType: "market", label: "b2b", signalCount: 2 },
      ],
      evidenceItems: [
        {
          source: "github",
          signalType: "repo",
          timestamp: "2026-03-12T00:00:00Z",
          value: 1,
          evidence: "evidence",
          evidenceUrl: null,
          languageCode,
          audienceFlags: [],
          marketFlags: [],
          geoFlags: [],
          geoCountryCode: countryCode,
          geoRegion: null,
          geoDetectionMode: "explicit",
          geoConfidence: 1,
        },
      ],
      primaryEvidence: null,
      duplicateCandidates: [],
      relatedTrends: [],
      seasonality: null,
    });

  const response = await handleExportGet(
    new Request(
      "http://localhost/api/export?audience=developer&language=en&geo=US&sort=rank&sortDir=asc",
    ),
    {
      loadTrendExplorer: async () => ({
        generatedAt: "2026-03-12T00:00:00Z",
        trends: explorerTrends,
      }),
      loadTrendDetails: async () => ({
        generatedAt: "2026-03-12T00:00:00Z",
        trends: [
          detailRecord("ai-agents", "developer", "en", "US"),
          detailRecord("consumer-video", "creator", "es", "GB"),
        ],
      }),
    },
  );

  assert.equal(response.status, 200);
  const lines = (await response.text()).trimEnd().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[1] ?? "", /AI Agents/);
  assert.doesNotMatch(lines[1] ?? "", /Consumer Video/);
});

test("trend-filters: confidenceBucketForTrend classifies correctly", () => {
  assert.equal(confidenceBucketForTrend(0.9), "high");
  assert.equal(confidenceBucketForTrend(0.75), "high");
  assert.equal(confidenceBucketForTrend(0.6), "medium");
  assert.equal(confidenceBucketForTrend(0.5), "medium");
  assert.equal(confidenceBucketForTrend(0.3), "low");
  assert.equal(confidenceBucketForTrend(0), "low");
});

test("trend-filters: trendMatchesAudience returns true for 'all'", () => {
  assert.equal(trendMatchesAudience(undefined, "all"), true);
});

test("trend-filters: trendMatchesAudience matches by segment label", () => {
  const detail = {
    audienceSummary: [{ segmentType: "audience", label: "developer", signalCount: 3 }],
  } as TrendDetailRecord;
  assert.equal(trendMatchesAudience(detail, "developer"), true);
  assert.equal(trendMatchesAudience(detail, "founder"), false);
});

test("trend-filters: trendMatchesMarket returns true for 'all'", () => {
  assert.equal(trendMatchesMarket(undefined, "all"), true);
});

test("trend-filters: trendMatchesLanguage matches by evidenceItems languageCode", () => {
  const detail = {
    evidenceItems: [
      { source: "github", signalType: "developer", timestamp: "2026-03-12T00:00:00Z", value: 1, evidence: "test", evidenceUrl: null, languageCode: "en", audienceFlags: [], marketFlags: [], geoFlags: [], geoCountryCode: null, geoRegion: null, geoDetectionMode: "unknown", geoConfidence: 0 },
    ],
  } as TrendDetailRecord;
  assert.equal(trendMatchesLanguage(detail, "en"), true);
  assert.equal(trendMatchesLanguage(detail, "de"), false);
  assert.equal(trendMatchesLanguage(detail, "all"), true);
});

test("export CSV handles trends with missing optional fields gracefully", async () => {
  const minimalTrend: TrendExplorerRecord = {
    id: "minimal",
    name: "Minimal Trend",
    category: "general-tech",
    metaTrend: "General",
    stage: "steady",
    confidence: 0.5,
    summary: "",
    status: "steady",
    volatility: "stable",
    rank: 1,
    previousRank: null,
    rankChange: null,
    firstSeenAt: null,
    latestSignalAt: "2026-03-15T00:00:00Z",
    score: { total: 5, social: 1, developer: 1, knowledge: 1, search: 1, advertising: 0, diversity: 1 },
    momentum: { previousRank: null, rankChange: null, absoluteDelta: null, percentDelta: null },
    coverage: { sourceCount: 1, signalCount: 1 },
    sources: ["reddit"],
    evidencePreview: [],
    // intentionally omit audienceSummary, primaryEvidence, recentHistory, seasonality, forecastDirection
  };

  const response = await handleExportGet(
    new Request("http://localhost/api/export"),
    {
      loadTrendExplorer: async () => ({
        generatedAt: "2026-03-15T00:00:00Z",
        trends: [minimalTrend],
      }),
      loadTrendDetails: async () => ({
        generatedAt: "2026-03-15T00:00:00Z",
        trends: [],
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = await response.text();
  const lines = body.trimEnd().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[1] ?? "", /Minimal Trend/);
  // Should not crash with undefined audienceSummary
});

test("export CSV escapes commas and quotes in trend names", async () => {
  const trendWithComma: TrendExplorerRecord = {
    id: "tricky",
    name: 'Trend "With", Commas',
    category: "general-tech",
    metaTrend: "General",
    stage: "steady",
    confidence: 0.5,
    summary: "",
    status: "steady",
    volatility: "stable",
    rank: 1,
    previousRank: null,
    rankChange: null,
    firstSeenAt: null,
    latestSignalAt: "2026-03-15T00:00:00Z",
    score: { total: 5, social: 1, developer: 1, knowledge: 1, search: 1, advertising: 0, diversity: 1 },
    momentum: { previousRank: null, rankChange: null, absoluteDelta: null, percentDelta: null },
    coverage: { sourceCount: 1, signalCount: 1 },
    sources: ["reddit"],
    evidencePreview: [],
    audienceSummary: [],
    primaryEvidence: null,
    recentHistory: [],
    seasonality: null,
    forecastDirection: null,
  };

  const response = await handleExportGet(
    new Request("http://localhost/api/export"),
    {
      loadTrendExplorer: async () => ({
        generatedAt: "2026-03-15T00:00:00Z",
        trends: [trendWithComma],
      }),
      loadTrendDetails: async () => ({
        generatedAt: "2026-03-15T00:00:00Z",
        trends: [],
      }),
    },
  );

  const body = await response.text();
  const lines = body.trimEnd().split("\n");
  // The name with commas and quotes should be properly escaped
  assert.ok(lines[1]?.includes('"Trend ""With""'), "Should escape double quotes");
});
