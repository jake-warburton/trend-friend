import assert from "node:assert/strict";
import test from "node:test";

import { listActiveExplorerFilters, isThesisPresetApplied, shouldClearActiveThesisPreset } from "@/components/explorer/filters";
import { confidenceBucketForTrend } from "@/lib/trend-filters";
import { isRecurringTrend } from "@/lib/seasonality-ui";
import { compareDates } from "@/components/explorer/format";

// ---------------------------------------------------------------------------
// Mock trend factory
// ---------------------------------------------------------------------------

function makeTrend(overrides: Partial<any> = {}): any {
  return {
    id: "t1",
    name: "Test Trend",
    category: "tech",
    status: "rising",
    volatility: "stable",
    rank: 1,
    previousRank: 2,
    rankChange: 1,
    firstSeenAt: "2026-03-01T00:00:00Z",
    latestSignalAt: "2026-03-15T00:00:00Z",
    score: { total: 25, social: 10, developer: 5, knowledge: 5, search: 3, advertising: 0, diversity: 2 },
    momentum: { previousRank: 2, absoluteDelta: 1, percentDelta: 5 },
    coverage: { sourceCount: 3, signalCount: 10 },
    sources: ["reddit", "github"],
    evidencePreview: ["some evidence text"],
    stage: "rising",
    confidence: 0.8,
    metaTrend: "AI",
    summary: "A test trend",
    breaking: null,
    seasonality: null,
    forecastDirection: null,
    relatedTrends: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Standalone filter function replicating use-filtered-trends.ts logic
// ---------------------------------------------------------------------------

type FilterState = {
  deferredKeyword: string;
  selectedSource: string;
  selectedCategory: string;
  selectedStage: string;
  selectedConfidence: string;
  selectedMetaTrend: string;
  selectedStatus: string;
  minimumScore: number | null;
  hideRecurring: boolean;
};

const DEFAULT_FILTER_STATE: FilterState = {
  deferredKeyword: "",
  selectedSource: "all",
  selectedCategory: "all",
  selectedStage: "all",
  selectedConfidence: "all",
  selectedMetaTrend: "all",
  selectedStatus: "all",
  minimumScore: 0,
  hideRecurring: false,
};

function filterTrend(trend: ReturnType<typeof makeTrend>, filters: Partial<FilterState> = {}): boolean {
  const state = { ...DEFAULT_FILTER_STATE, ...filters };

  const normalizedKeyword = state.deferredKeyword.trim().toLowerCase();
  const minimum = state.minimumScore ?? 0;

  const matchesSource =
    state.selectedSource === "all" || trend.sources.includes(state.selectedSource);
  const matchesCategory =
    state.selectedCategory === "all" || trend.category === state.selectedCategory;
  const matchesStage =
    state.selectedStage === "all" || trend.stage === state.selectedStage;
  const matchesConfidence =
    state.selectedConfidence === "all" ||
    confidenceBucketForTrend(trend.confidence) === state.selectedConfidence;
  const matchesMetaTrend =
    state.selectedMetaTrend === "all" || trend.metaTrend === state.selectedMetaTrend;
  const matchesKeyword =
    normalizedKeyword.length === 0 ||
    trend.name.toLowerCase().includes(normalizedKeyword) ||
    trend.evidencePreview.some((item: string) =>
      item.toLowerCase().includes(normalizedKeyword),
    );
  const matchesScore = trend.score.total >= minimum;
  const matchesSeasonality =
    !state.hideRecurring || !isRecurringTrend(trend.seasonality);
  const matchesStatus =
    state.selectedStatus === "all" || trend.status === state.selectedStatus;

  return (
    matchesSource &&
    matchesCategory &&
    matchesStage &&
    matchesConfidence &&
    matchesMetaTrend &&
    matchesKeyword &&
    matchesScore &&
    matchesSeasonality &&
    matchesStatus
  );
}

// ---------------------------------------------------------------------------
// Standalone sort function replicating use-filtered-trends.ts logic
// ---------------------------------------------------------------------------

function sortTrends(
  trends: ReturnType<typeof makeTrend>[],
  sortBy: string,
  sortDirection: "asc" | "desc",
): ReturnType<typeof makeTrend>[] {
  const dir = sortDirection === "asc" ? 1 : -1;
  return [...trends].sort((left, right) => {
    if (sortBy === "strength") {
      return (
        dir * (left.score.total - right.score.total) ||
        left.rank - right.rank
      );
    }
    if (sortBy === "dateAdded") {
      return (
        dir * compareDates(left.firstSeenAt, right.firstSeenAt) ||
        left.rank - right.rank
      );
    }
    if (sortBy === "latestActivity") {
      return (
        dir * compareDates(left.latestSignalAt, right.latestSignalAt) ||
        left.rank - right.rank
      );
    }
    if (sortBy === "sources") {
      return (
        dir * (left.coverage.sourceCount - right.coverage.sourceCount) ||
        left.rank - right.rank
      );
    }
    if (sortBy === "momentum") {
      return (
        dir *
          ((left.momentum.absoluteDelta ?? 0) -
            (right.momentum.absoluteDelta ?? 0)) || left.rank - right.rank
      );
    }
    return dir * (left.rank - right.rank);
  });
}

// ===========================================================================
// A) Filter active chips — listActiveExplorerFilters
// ===========================================================================

test("listActiveExplorerFilters returns empty array when all filters are default", () => {
  const chips = listActiveExplorerFilters({
    keyword: "",
    selectedSource: "all",
    selectedCategory: "all",
    selectedStage: "all",
    selectedConfidence: "all",
    selectedLens: "all",
    selectedMetaTrend: "all",
    selectedAudience: "all",
    selectedMarket: "all",
    selectedLanguage: "all",
    selectedGeoCountry: "all",
    sortBy: "rank",
    sortDirection: "asc",
    selectedStatus: "all",
    hideRecurring: false,
  });
  assert.equal(chips.length, 0);
});

test("listActiveExplorerFilters returns keyword chip when keyword is set", () => {
  const chips = listActiveExplorerFilters({
    keyword: "  machine learning ",
    selectedSource: "all",
    selectedCategory: "all",
    selectedAudience: "all",
    selectedMarket: "all",
    selectedLanguage: "all",
    selectedGeoCountry: "all",
    sortBy: "rank",
    hideRecurring: false,
  });
  const keywordChip = chips.find((c) => c.key === "keyword");
  assert.ok(keywordChip);
  assert.equal(keywordChip.value, "machine learning");
});

test("listActiveExplorerFilters returns multiple chips for several active filters", () => {
  const chips = listActiveExplorerFilters({
    keyword: "",
    selectedSource: "reddit",
    selectedCategory: "tech",
    selectedStage: "rising",
    selectedConfidence: "high",
    selectedLens: "seo",
    selectedMetaTrend: "AI",
    selectedAudience: "all",
    selectedMarket: "all",
    selectedLanguage: "all",
    selectedGeoCountry: "all",
    sortBy: "rank",
    sortDirection: "asc",
    selectedStatus: "all",
    hideRecurring: true,
  });
  const keys = chips.map((c) => c.key);
  assert.ok(keys.includes("source"));
  assert.ok(keys.includes("category"));
  assert.ok(keys.includes("stage"));
  assert.ok(keys.includes("confidence"));
  assert.ok(keys.includes("lens"));
  assert.ok(keys.includes("metaTrend"));
  assert.ok(keys.includes("seasonality"));
  // sort should NOT appear since rank/asc is default
  assert.ok(!keys.includes("sort"));
});

test("listActiveExplorerFilters includes sort chip for non-default sort", () => {
  const chips = listActiveExplorerFilters({
    keyword: "",
    selectedSource: "all",
    selectedCategory: "all",
    selectedAudience: "all",
    selectedMarket: "all",
    selectedLanguage: "all",
    selectedGeoCountry: "all",
    sortBy: "strength",
    sortDirection: "desc",
    hideRecurring: false,
  });
  const sortChip = chips.find((c) => c.key === "sort");
  assert.ok(sortChip);
  assert.ok(sortChip.value.includes("Strength"));
});

// ===========================================================================
// B) Thesis preset matching
// ===========================================================================

test("isThesisPresetApplied returns true when state matches preset defaults", () => {
  const preset = { key: "test", label: "Test", description: "d" } as any;
  const state = {
    keyword: "",
    selectedSource: "all",
    selectedCategory: "all",
    selectedStage: "all",
    selectedConfidence: "all",
    selectedLens: "all",
    selectedMetaTrend: "all",
    selectedAudience: "all",
    selectedMarket: "all",
    selectedLanguage: "all",
    selectedGeoCountry: "all",
    minimumScore: 0,
    sortBy: "rank",
    sortDirection: "asc" as const,
    selectedStatus: "all",
    hideRecurring: false,
  };
  assert.ok(isThesisPresetApplied(preset, state));
});

test("isThesisPresetApplied returns false when keyword is set", () => {
  const preset = { key: "test", label: "Test", description: "d" } as any;
  const state = {
    keyword: "something",
    selectedSource: "all",
    selectedCategory: "all",
    selectedStage: "all",
    selectedConfidence: "all",
    selectedLens: "all",
    selectedMetaTrend: "all",
    selectedAudience: "all",
    selectedMarket: "all",
    selectedLanguage: "all",
    selectedGeoCountry: "all",
    minimumScore: 0,
    sortBy: "rank",
    sortDirection: "asc" as const,
    selectedStatus: "all",
    hideRecurring: false,
  };
  assert.equal(isThesisPresetApplied(preset, state), false);
});

test("shouldClearActiveThesisPreset returns true when preset key matches active key", () => {
  const preset = { key: "breakout-tech" } as any;
  assert.ok(shouldClearActiveThesisPreset("breakout-tech", preset));
  assert.equal(shouldClearActiveThesisPreset("other-key", preset), false);
  assert.equal(shouldClearActiveThesisPreset(null, preset), false);
});

// ===========================================================================
// C) Trend filtering logic
// ===========================================================================

test("keyword filtering matches trend name (case insensitive)", () => {
  const trend = makeTrend({ name: "Machine Learning Advances" });
  assert.ok(filterTrend(trend, { deferredKeyword: "machine" }));
  assert.ok(filterTrend(trend, { deferredKeyword: "MACHINE" }));
  assert.equal(filterTrend(trend, { deferredKeyword: "blockchain" }), false);
});

test("keyword filtering matches evidence preview", () => {
  const trend = makeTrend({ evidencePreview: ["GPT-4 usage is skyrocketing"] });
  assert.ok(filterTrend(trend, { deferredKeyword: "gpt-4" }));
  assert.ok(filterTrend(trend, { deferredKeyword: "skyrocketing" }));
  assert.equal(filterTrend(trend, { deferredKeyword: "blockchain" }), false);
});

test("keyword filtering with empty string matches all trends", () => {
  const trend = makeTrend();
  assert.ok(filterTrend(trend, { deferredKeyword: "" }));
  assert.ok(filterTrend(trend, { deferredKeyword: "   " }));
});

test("source filtering only includes trends with matching source", () => {
  const trend = makeTrend({ sources: ["reddit", "github"] });
  assert.ok(filterTrend(trend, { selectedSource: "reddit" }));
  assert.ok(filterTrend(trend, { selectedSource: "github" }));
  assert.equal(filterTrend(trend, { selectedSource: "twitter" }), false);
  assert.ok(filterTrend(trend, { selectedSource: "all" }));
});

test("category filtering matches exact category", () => {
  const trend = makeTrend({ category: "tech" });
  assert.ok(filterTrend(trend, { selectedCategory: "tech" }));
  assert.equal(filterTrend(trend, { selectedCategory: "finance" }), false);
  assert.ok(filterTrend(trend, { selectedCategory: "all" }));
});

test("stage filtering matches exact stage", () => {
  const trend = makeTrend({ stage: "rising" });
  assert.ok(filterTrend(trend, { selectedStage: "rising" }));
  assert.equal(filterTrend(trend, { selectedStage: "breakout" }), false);
  assert.ok(filterTrend(trend, { selectedStage: "all" }));
});

test("confidence bucket filtering maps correctly: 0.8 = high, 0.6 = medium, 0.3 = low", () => {
  const highTrend = makeTrend({ confidence: 0.8 });
  const medTrend = makeTrend({ confidence: 0.6 });
  const lowTrend = makeTrend({ confidence: 0.3 });

  // Verify bucket mapping
  assert.equal(confidenceBucketForTrend(0.8), "high");
  assert.equal(confidenceBucketForTrend(0.75), "high");
  assert.equal(confidenceBucketForTrend(0.6), "medium");
  assert.equal(confidenceBucketForTrend(0.5), "medium");
  assert.equal(confidenceBucketForTrend(0.3), "low");
  assert.equal(confidenceBucketForTrend(0.49), "low");

  // Filter by high
  assert.ok(filterTrend(highTrend, { selectedConfidence: "high" }));
  assert.equal(filterTrend(medTrend, { selectedConfidence: "high" }), false);
  assert.equal(filterTrend(lowTrend, { selectedConfidence: "high" }), false);

  // Filter by medium
  assert.equal(filterTrend(highTrend, { selectedConfidence: "medium" }), false);
  assert.ok(filterTrend(medTrend, { selectedConfidence: "medium" }));

  // Filter by low
  assert.ok(filterTrend(lowTrend, { selectedConfidence: "low" }));
});

test("minimum score threshold filters out trends below threshold", () => {
  const strong = makeTrend({ score: { total: 30 } });
  const weak = makeTrend({ score: { total: 5 } });

  assert.ok(filterTrend(strong, { minimumScore: 20 }));
  assert.equal(filterTrend(weak, { minimumScore: 20 }), false);
  // Boundary: exact match should pass
  assert.ok(filterTrend(strong, { minimumScore: 30 }));
  // Null minimumScore treated as 0
  assert.ok(filterTrend(weak, { minimumScore: null }));
});

test("hide recurring filters out trends with seasonality tag = recurring", () => {
  const recurring = makeTrend({ seasonality: { tag: "recurring", recurrenceCount: 3, avgGapRuns: 2.5 } });
  const evergreen = makeTrend({ seasonality: { tag: "evergreen" } });
  const noSeason = makeTrend({ seasonality: null });

  assert.equal(filterTrend(recurring, { hideRecurring: true }), false);
  assert.ok(filterTrend(evergreen, { hideRecurring: true }));
  assert.ok(filterTrend(noSeason, { hideRecurring: true }));
  // When hideRecurring is false, recurring trends pass
  assert.ok(filterTrend(recurring, { hideRecurring: false }));
});

test("meta trend filtering matches exact metaTrend value", () => {
  const aiTrend = makeTrend({ metaTrend: "AI" });
  const cryptoTrend = makeTrend({ metaTrend: "Crypto" });

  assert.ok(filterTrend(aiTrend, { selectedMetaTrend: "AI" }));
  assert.equal(filterTrend(aiTrend, { selectedMetaTrend: "Crypto" }), false);
  assert.ok(filterTrend(cryptoTrend, { selectedMetaTrend: "Crypto" }));
  assert.ok(filterTrend(aiTrend, { selectedMetaTrend: "all" }));
});

test("status filtering matches exact status value", () => {
  const risingTrend = makeTrend({ status: "rising" });
  const breakoutTrend = makeTrend({ status: "breakout" });

  assert.ok(filterTrend(risingTrend, { selectedStatus: "rising" }));
  assert.equal(filterTrend(risingTrend, { selectedStatus: "breakout" }), false);
  assert.ok(filterTrend(breakoutTrend, { selectedStatus: "breakout" }));
  assert.ok(filterTrend(risingTrend, { selectedStatus: "all" }));
});

test("multiple filters combine with AND logic", () => {
  const trend = makeTrend({
    category: "tech",
    sources: ["reddit"],
    stage: "rising",
    confidence: 0.8,
    score: { total: 30 },
  });

  // All matching
  assert.ok(
    filterTrend(trend, {
      selectedCategory: "tech",
      selectedSource: "reddit",
      selectedStage: "rising",
      selectedConfidence: "high",
      minimumScore: 20,
    }),
  );

  // One mismatch breaks the entire match
  assert.equal(
    filterTrend(trend, {
      selectedCategory: "tech",
      selectedSource: "twitter", // mismatch
      selectedStage: "rising",
    }),
    false,
  );
});

// ===========================================================================
// D) Trend sorting logic
// ===========================================================================

test("sort by rank ascending orders by rank number", () => {
  const trends = [
    makeTrend({ id: "t3", rank: 3 }),
    makeTrend({ id: "t1", rank: 1 }),
    makeTrend({ id: "t2", rank: 2 }),
  ];
  const sorted = sortTrends(trends, "rank", "asc");
  assert.deepEqual(sorted.map((t) => t.id), ["t1", "t2", "t3"]);
});

test("sort by rank descending reverses order", () => {
  const trends = [
    makeTrend({ id: "t1", rank: 1 }),
    makeTrend({ id: "t2", rank: 2 }),
    makeTrend({ id: "t3", rank: 3 }),
  ];
  const sorted = sortTrends(trends, "rank", "desc");
  assert.deepEqual(sorted.map((t) => t.id), ["t3", "t2", "t1"]);
});

test("sort by strength descending orders by total score high to low", () => {
  const trends = [
    makeTrend({ id: "low", rank: 1, score: { total: 10 } }),
    makeTrend({ id: "high", rank: 2, score: { total: 50 } }),
    makeTrend({ id: "mid", rank: 3, score: { total: 30 } }),
  ];
  const sorted = sortTrends(trends, "strength", "desc");
  assert.deepEqual(sorted.map((t) => t.id), ["high", "mid", "low"]);
});

test("sort by strength ascending orders by total score low to high", () => {
  const trends = [
    makeTrend({ id: "high", rank: 1, score: { total: 50 } }),
    makeTrend({ id: "low", rank: 2, score: { total: 10 } }),
    makeTrend({ id: "mid", rank: 3, score: { total: 30 } }),
  ];
  const sorted = sortTrends(trends, "strength", "asc");
  assert.deepEqual(sorted.map((t) => t.id), ["low", "mid", "high"]);
});

test("sort by strength uses rank as tiebreaker", () => {
  const trends = [
    makeTrend({ id: "b", rank: 5, score: { total: 20 } }),
    makeTrend({ id: "a", rank: 2, score: { total: 20 } }),
  ];
  const sorted = sortTrends(trends, "strength", "desc");
  // Same score, so tiebreaker is rank ascending
  assert.deepEqual(sorted.map((t) => t.id), ["a", "b"]);
});

test("sort by dateAdded descending orders newest first", () => {
  const trends = [
    makeTrend({ id: "old", rank: 1, firstSeenAt: "2026-01-01T00:00:00Z" }),
    makeTrend({ id: "new", rank: 2, firstSeenAt: "2026-03-15T00:00:00Z" }),
    makeTrend({ id: "mid", rank: 3, firstSeenAt: "2026-02-10T00:00:00Z" }),
  ];
  const sorted = sortTrends(trends, "dateAdded", "desc");
  assert.deepEqual(sorted.map((t) => t.id), ["new", "mid", "old"]);
});

test("sort by sources descending orders by sourceCount high to low", () => {
  const trends = [
    makeTrend({ id: "few", rank: 1, coverage: { sourceCount: 1, signalCount: 2 } }),
    makeTrend({ id: "many", rank: 2, coverage: { sourceCount: 8, signalCount: 20 } }),
    makeTrend({ id: "some", rank: 3, coverage: { sourceCount: 4, signalCount: 10 } }),
  ];
  const sorted = sortTrends(trends, "sources", "desc");
  assert.deepEqual(sorted.map((t) => t.id), ["many", "some", "few"]);
});

test("sort by momentum descending orders by absoluteDelta high to low", () => {
  const trends = [
    makeTrend({ id: "flat", rank: 1, momentum: { absoluteDelta: 0, percentDelta: 0 } }),
    makeTrend({ id: "surge", rank: 2, momentum: { absoluteDelta: 10, percentDelta: 50 } }),
    makeTrend({ id: "mild", rank: 3, momentum: { absoluteDelta: 3, percentDelta: 15 } }),
  ];
  const sorted = sortTrends(trends, "momentum", "desc");
  assert.deepEqual(sorted.map((t) => t.id), ["surge", "mild", "flat"]);
});

test("sort by momentum handles null absoluteDelta as 0", () => {
  const trends = [
    makeTrend({ id: "null", rank: 1, momentum: { absoluteDelta: null, percentDelta: null } }),
    makeTrend({ id: "positive", rank: 2, momentum: { absoluteDelta: 5, percentDelta: 10 } }),
  ];
  const sorted = sortTrends(trends, "momentum", "desc");
  assert.deepEqual(sorted.map((t) => t.id), ["positive", "null"]);
});

// ===========================================================================
// E) Export href building (testing the URL param construction pattern)
// ===========================================================================

test("export href includes only non-default filter params", () => {
  // Replicate the export href logic from use-explorer-filters.ts
  function buildExportHref(filters: Record<string, any>): string {
    const params = new URLSearchParams();
    if (filters.selectedSource !== "all") params.set("source", filters.selectedSource);
    if (filters.selectedCategory !== "all") params.set("category", filters.selectedCategory);
    if (filters.selectedStage !== "all") params.set("stage", filters.selectedStage);
    if (filters.selectedConfidence !== "all") params.set("confidence", filters.selectedConfidence);
    if (filters.selectedLens !== "all") params.set("lens", filters.selectedLens);
    if (filters.selectedMetaTrend !== "all") params.set("metaTrend", filters.selectedMetaTrend);
    if (filters.selectedAudience !== "all") params.set("audience", filters.selectedAudience);
    if (filters.selectedMarket !== "all") params.set("market", filters.selectedMarket);
    if (filters.selectedLanguage !== "all") params.set("language", filters.selectedLanguage);
    if (filters.selectedGeoCountry !== "all") params.set("geo", filters.selectedGeoCountry);
    if (filters.keyword) params.set("q", filters.keyword);
    if (filters.minimumScore && filters.minimumScore > 0) params.set("min", String(filters.minimumScore));
    if (filters.hideRecurring) params.set("hideRecurring", "1");
    if (filters.selectedStatus !== "all") params.set("status", filters.selectedStatus);
    params.set("sort", filters.sortBy);
    params.set("sortDir", filters.sortDirection);
    return `/api/export?${params.toString()}`;
  }

  // Default filters
  const defaultHref = buildExportHref({
    selectedSource: "all",
    selectedCategory: "all",
    selectedStage: "all",
    selectedConfidence: "all",
    selectedLens: "all",
    selectedMetaTrend: "all",
    selectedAudience: "all",
    selectedMarket: "all",
    selectedLanguage: "all",
    selectedGeoCountry: "all",
    keyword: "",
    minimumScore: 0,
    hideRecurring: false,
    selectedStatus: "all",
    sortBy: "rank",
    sortDirection: "asc",
  });
  assert.ok(defaultHref.startsWith("/api/export?"));
  assert.ok(defaultHref.includes("sort=rank"));
  assert.ok(defaultHref.includes("sortDir=asc"));
  assert.ok(!defaultHref.includes("source="));
  assert.ok(!defaultHref.includes("category="));

  // With filters
  const filteredHref = buildExportHref({
    selectedSource: "reddit",
    selectedCategory: "tech",
    selectedStage: "all",
    selectedConfidence: "high",
    selectedLens: "all",
    selectedMetaTrend: "all",
    selectedAudience: "all",
    selectedMarket: "all",
    selectedLanguage: "all",
    selectedGeoCountry: "all",
    keyword: "AI",
    minimumScore: 10,
    hideRecurring: true,
    selectedStatus: "rising",
    sortBy: "strength",
    sortDirection: "desc",
  });
  assert.ok(filteredHref.includes("source=reddit"));
  assert.ok(filteredHref.includes("category=tech"));
  assert.ok(filteredHref.includes("confidence=high"));
  assert.ok(filteredHref.includes("q=AI"));
  assert.ok(filteredHref.includes("min=10"));
  assert.ok(filteredHref.includes("hideRecurring=1"));
  assert.ok(filteredHref.includes("status=rising"));
  assert.ok(filteredHref.includes("sort=strength"));
  assert.ok(filteredHref.includes("sortDir=desc"));
});
