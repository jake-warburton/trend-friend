import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAudienceFilterOptions,
  buildCommunityExportHref,
  buildCommunitySpotlights,
  buildSharedWatchlistExportHref,
  buildLanguageFilterOptions,
  buildMarketFilterOptions,
  isThesisPresetApplied,
  listActiveExplorerFilters,
  shouldClearActiveThesisPreset,
  trendMatchesAudience,
  trendMatchesLanguage,
  trendMatchesMarket,
} from "@/components/dashboard-shell";
import type { PublicWatchlistsResponse, TrendDetailRecord } from "@/lib/types";

test("buildCommunitySpotlights returns popular, search-driven, and global entries when available", () => {
  const watchlists: PublicWatchlistsResponse["watchlists"] = [
    {
      id: 1,
      name: "Popular Robotics",
      itemCount: 3,
      shareToken: "popular-robotics",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      recentOpenCount: 8,
      accessCount: 20,
      popularThisWeek: true,
      sourceContributions: [
        {
          source: "github",
          signalCount: 3,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 7,
          scoreSharePercent: 70,
          score: { total: 7, social: 0, developer: 7, knowledge: 0, search: 0, diversity: 0 },
        },
      ],
      geoSummary: [
        {
          label: "United Kingdom",
          countryCode: "GB",
          region: null,
          signalCount: 3,
          explicitCount: 3,
          inferredCount: 0,
          averageConfidence: 1,
        },
      ],
      audienceSummary: [{ segmentType: "market", label: "b2b", signalCount: 3 }],
    },
    {
      id: 2,
      name: "AI Search",
      itemCount: 2,
      shareToken: "ai-search",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      recentOpenCount: 4,
      accessCount: 9,
      popularThisWeek: false,
      sourceContributions: [
        {
          source: "google_trends",
          signalCount: 4,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 6,
          scoreSharePercent: 60,
          score: { total: 6, social: 0, developer: 0, knowledge: 0, search: 6, diversity: 0 },
        },
      ],
      geoSummary: [
        {
          label: "United States",
          countryCode: "US",
          region: null,
          signalCount: 3,
          explicitCount: 3,
          inferredCount: 0,
          averageConfidence: 1,
        },
        {
          label: "United Kingdom",
          countryCode: "GB",
          region: null,
          signalCount: 2,
          explicitCount: 2,
          inferredCount: 0,
          averageConfidence: 0.9,
        },
      ],
      audienceSummary: [{ segmentType: "audience", label: "developer", signalCount: 4 }],
    },
  ];

  const spotlights = buildCommunitySpotlights(watchlists);

  assert.deepEqual(
    spotlights.map((spotlight) => spotlight.title),
    ["Popular this week", "Search-driven", "Global interest", "Developer audience", "B2B signal"],
  );
  assert.equal(spotlights[0]?.watchlist.name, "Popular Robotics");
  assert.equal(spotlights[1]?.watchlist.name, "AI Search");
  assert.equal(spotlights[2]?.watchlist.name, "AI Search");
  assert.equal(spotlights[3]?.watchlist.name, "AI Search");
  assert.equal(spotlights[4]?.watchlist.name, "Popular Robotics");
});

test("community export helpers build stable dashboard download URLs", () => {
  assert.equal(buildCommunityExportHref(), "/api/export/community");
  assert.equal(buildSharedWatchlistExportHref("share-123"), "/api/export/shared/share-123");
  assert.equal(
    buildSharedWatchlistExportHref("space token"),
    "/api/export/shared/space%20token",
  );
});

test("buildCommunitySpotlights omits spotlight buckets with no matching watchlists", () => {
  const watchlists: PublicWatchlistsResponse["watchlists"] = [
    {
      id: 1,
      name: "Quiet Robotics",
      itemCount: 2,
      shareToken: "quiet-robotics",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      recentOpenCount: 1,
      accessCount: 2,
      popularThisWeek: false,
      sourceContributions: [
        {
          source: "github",
          signalCount: 2,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 4,
          scoreSharePercent: 40,
          score: { total: 4, social: 0, developer: 4, knowledge: 0, search: 0, diversity: 0 },
        },
      ],
      geoSummary: [
        {
          label: "United Kingdom",
          countryCode: "GB",
          region: null,
          signalCount: 2,
          explicitCount: 2,
          inferredCount: 0,
          averageConfidence: 1,
        },
      ],
      audienceSummary: [{ segmentType: "market", label: "b2c", signalCount: 2 }],
    },
  ];

  const spotlights = buildCommunitySpotlights(watchlists);

  assert.deepEqual(spotlights, []);
});

test("buildAudienceFilterOptions returns readable audience labels for explorer filters", () => {
  const details: TrendDetailRecord[] = [
    {
      id: "robotics",
      name: "Robotics",
      category: "developer-tools",
      status: "breakout",
      volatility: "medium",
      rank: 1,
      previousRank: null,
      rankChange: null,
      firstSeenAt: null,
      latestSignalAt: "2026-03-10T12:00:00Z",
      score: { total: 10, social: 2, developer: 6, knowledge: 1, search: 1, diversity: 0 },
      momentum: { previousRank: null, rankChange: null, absoluteDelta: null, percentDelta: null },
      breakoutPrediction: { confidence: 0.7, predictedDirection: "up", signals: [] },
      opportunity: { composite: 5, discovery: 4, seo: 5, content: 4, product: 6, investment: 5, reasoning: [] },
      coverage: { sourceCount: 2, signalCount: 5 },
      sources: ["github"],
      history: [],
      sourceBreakdown: [],
      sourceContributions: [],
      geoSummary: [],
      audienceSummary: [
        { segmentType: "audience", label: "developer", signalCount: 3 },
        { segmentType: "market", label: "b2b", signalCount: 2 },
      ],
      evidenceItems: [
        {
          source: "github",
          signalType: "repo",
          timestamp: "2026-03-10T12:00:00Z",
          value: 4,
          evidence: "Robotics toolkit",
          evidenceUrl: null,
          languageCode: "en",
          audienceFlags: [],
          marketFlags: [],
          geoFlags: [],
          geoCountryCode: null,
          geoRegion: null,
          geoDetectionMode: "unknown",
          geoConfidence: 0,
        },
      ],
      relatedTrends: [],
    },
    {
      id: "consumer-ai",
      name: "Consumer AI",
      category: "ai-machine-learning",
      status: "rising",
      volatility: "high",
      rank: 2,
      previousRank: 3,
      rankChange: 1,
      firstSeenAt: null,
      latestSignalAt: "2026-03-10T12:00:00Z",
      score: { total: 8, social: 4, developer: 1, knowledge: 1, search: 2, diversity: 0 },
      momentum: { previousRank: 3, rankChange: 1, absoluteDelta: 2, percentDelta: 30 },
      breakoutPrediction: { confidence: 0.6, predictedDirection: "up", signals: [] },
      opportunity: { composite: 4, discovery: 5, seo: 4, content: 5, product: 4, investment: 3, reasoning: [] },
      coverage: { sourceCount: 2, signalCount: 4 },
      sources: ["reddit"],
      history: [],
      sourceBreakdown: [],
      sourceContributions: [],
      geoSummary: [],
      audienceSummary: [{ segmentType: "market", label: "b2c", signalCount: 3 }],
      evidenceItems: [
        {
          source: "reddit",
          signalType: "post",
          timestamp: "2026-03-10T12:00:00Z",
          value: 3,
          evidence: "Consumer AI discussion",
          evidenceUrl: null,
          languageCode: "es",
          audienceFlags: [],
          marketFlags: [],
          geoFlags: [],
          geoCountryCode: null,
          geoRegion: null,
          geoDetectionMode: "unknown",
          geoConfidence: 0,
        },
      ],
      relatedTrends: [],
    },
  ];

  assert.deepEqual(buildAudienceFilterOptions(details), [
    { label: "All audiences", value: "all" },
    { label: "Developer", value: "developer" },
  ]);
  assert.deepEqual(buildMarketFilterOptions(details), [
    { label: "All markets", value: "all" },
    { label: "B2B", value: "b2b" },
    { label: "B2C", value: "b2c" },
  ]);
  assert.deepEqual(buildLanguageFilterOptions(details), [
    { label: "All languages", value: "all" },
    { label: "English", value: "en" },
    { label: "Spanish", value: "es" },
  ]);
});

test("trendMatchesAudience supports explorer audience filtering", () => {
  const detail = {
    id: "robotics",
    name: "Robotics",
    category: "developer-tools",
    status: "breakout",
    volatility: "medium",
    rank: 1,
    previousRank: null,
    rankChange: null,
    firstSeenAt: null,
    latestSignalAt: "2026-03-10T12:00:00Z",
    score: { total: 10, social: 2, developer: 6, knowledge: 1, search: 1, diversity: 0 },
    momentum: { previousRank: null, rankChange: null, absoluteDelta: null, percentDelta: null },
    breakoutPrediction: { confidence: 0.7, predictedDirection: "up", signals: [] },
    opportunity: { composite: 5, discovery: 4, seo: 5, content: 4, product: 6, investment: 5, reasoning: [] },
    coverage: { sourceCount: 2, signalCount: 5 },
    sources: ["github"],
    history: [],
    sourceBreakdown: [],
    sourceContributions: [],
    geoSummary: [],
    audienceSummary: [{ segmentType: "audience", label: "developer", signalCount: 3 }],
    evidenceItems: [
      {
        source: "github",
        signalType: "repo",
        timestamp: "2026-03-10T12:00:00Z",
        value: 3,
        evidence: "Developer trend",
        evidenceUrl: null,
        languageCode: "en",
        audienceFlags: [],
        marketFlags: [],
        geoFlags: [],
        geoCountryCode: null,
        geoRegion: null,
        geoDetectionMode: "unknown",
        geoConfidence: 0,
      },
    ],
    relatedTrends: [],
  } satisfies TrendDetailRecord;

  assert.equal(trendMatchesAudience(detail, "all"), true);
  assert.equal(trendMatchesAudience(detail, "developer"), true);
  assert.equal(trendMatchesAudience(detail, "b2b"), false);
  assert.equal(trendMatchesAudience(undefined, "developer"), false);
  assert.equal(trendMatchesMarket(detail, "all"), true);
  assert.equal(trendMatchesMarket(detail, "b2b"), false);
  assert.equal(trendMatchesLanguage(detail, "all"), true);
  assert.equal(trendMatchesLanguage(detail, "en"), true);
  assert.equal(trendMatchesLanguage(detail, "es"), false);
  assert.equal(trendMatchesLanguage(undefined, "en"), false);
});

test("listActiveExplorerFilters returns readable chips for non-default explorer filters", () => {
  assert.deepEqual(
    listActiveExplorerFilters({
      keyword: "robotics",
      selectedSource: "github",
      selectedCategory: "developer-tools",
      selectedLens: "seo",
      selectedAudience: "developer",
      selectedMarket: "b2b",
      selectedLanguage: "en",
      selectedGeoCountry: "GB",
      sortBy: "strength",
      sortDirection: "desc",
      selectedStatus: "new",
      hideRecurring: true,
    }),
    [
      { key: "keyword", label: "Keyword", value: "robotics" },
      { key: "source", label: "Source", value: "GitHub" },
      { key: "category", label: "Category", value: "Developer Tools" },
      { key: "lens", label: "Lens", value: "SEO" },
      { key: "audience", label: "Audience", value: "Developer" },
      { key: "market", label: "Market", value: "B2B" },
      { key: "language", label: "Language", value: "English" },
      { key: "geo", label: "Geo", value: "GB - Great Britain" },
      { key: "sort", label: "Sort", value: "Strength \u2193" },
      { key: "status", label: "Status", value: "New" },
      { key: "seasonality", label: "Seasonality", value: "Hide recurring" },
    ],
  );
});

test("isThesisPresetApplied only stays active while the full preset remains applied", () => {
  const preset = {
    key: "seo",
    label: "SEO opportunities",
    description: "Surface search-backed demand with enough evidence breadth to publish into.",
    lens: "seo",
    hideRecurring: true,
    minimumScore: 18,
  };

  assert.equal(
    isThesisPresetApplied(preset, {
      keyword: "",
      selectedSource: "all",
      selectedCategory: "all",
      selectedStage: "all",
      selectedConfidence: "all",
      selectedLens: "seo",
      selectedMetaTrend: "all",
      selectedAudience: "all",
      selectedMarket: "all",
      selectedLanguage: "all",
      selectedGeoCountry: "all",
      minimumScore: 18,
      sortBy: "rank",
      sortDirection: "asc",
      selectedStatus: "all",
      hideRecurring: true,
    }),
    true,
  );

  assert.equal(
    isThesisPresetApplied(preset, {
      keyword: "",
      selectedSource: "all",
      selectedCategory: "all",
      selectedStage: "all",
      selectedConfidence: "all",
      selectedLens: "seo",
      selectedMetaTrend: "all",
      selectedAudience: "all",
      selectedMarket: "all",
      selectedLanguage: "all",
      selectedGeoCountry: "all",
      minimumScore: 18,
      sortBy: "rank",
      sortDirection: "asc",
      selectedStatus: "all",
      hideRecurring: false,
    }),
    false,
  );

  assert.equal(
    isThesisPresetApplied(preset, {
      keyword: "",
      selectedSource: "all",
      selectedCategory: "all",
      selectedStage: "all",
      selectedConfidence: "all",
      selectedLens: "seo",
      selectedMetaTrend: "all",
      selectedAudience: "all",
      selectedMarket: "all",
      selectedLanguage: "all",
      selectedGeoCountry: "all",
      minimumScore: 12,
      sortBy: "rank",
      sortDirection: "asc",
      selectedStatus: "all",
      hideRecurring: true,
    }),
    false,
  );
});

test("shouldClearActiveThesisPreset only clears when clicking the active preset", () => {
  const preset = {
    key: "product",
    label: "Build ideas",
    description: "Tilt toward builder demand, product fit, and non-recurring opportunity.",
    lens: "product",
    audience: "developer",
    hideRecurring: true,
    minimumScore: 16,
  };

  assert.equal(shouldClearActiveThesisPreset("product", preset), true);
  assert.equal(shouldClearActiveThesisPreset("seo", preset), false);
  assert.equal(shouldClearActiveThesisPreset(null, preset), false);
});
