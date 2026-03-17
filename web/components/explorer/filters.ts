import type { TrendDetailRecord } from "@/lib/types";
import type { ThesisPreset, ExplorerActiveFilter, ThesisPresetFilterState } from "./types";
import {
  DEFAULT_SORT_DIRECTIONS,
  DEFAULT_AUDIENCE_OPTION,
  DEFAULT_MARKET_OPTION,
  DEFAULT_LANGUAGE_OPTION,
} from "./constants";
import { formatSourceLabel } from "@/lib/source-health";
import {
  formatCategory,
  formatStageLabel,
  formatConfidenceBucketLabel,
  formatLensLabel,
  formatAudienceLabel,
  formatLanguageLabel,
  formatExplorerSortLabel,
  formatStatusLabel,
  formatGeoCountryLabel,
} from "./format";

function buildSegmentFilterOptions(
  details: TrendDetailRecord[],
  segmentType: string,
  defaultOption: { label: string; value: string },
) {
  const labels = new Set<string>();
  for (const detail of details) {
    for (const item of detail.audienceSummary) {
      if (item.segmentType === segmentType) {
        labels.add(item.label);
      }
    }
  }

  return [
    defaultOption,
    ...Array.from(labels)
      .sort()
      .map((label) => ({ label: formatAudienceLabel(label), value: label })),
  ];
}

export function buildAudienceFilterOptions(details: TrendDetailRecord[]) {
  return buildSegmentFilterOptions(
    details,
    "audience",
    DEFAULT_AUDIENCE_OPTION,
  );
}

export function buildMarketFilterOptions(details: TrendDetailRecord[]) {
  return buildSegmentFilterOptions(details, "market", DEFAULT_MARKET_OPTION);
}

export function buildLanguageFilterOptions(details: TrendDetailRecord[]) {
  const codes = new Set<string>();
  for (const detail of details) {
    for (const item of detail.evidenceItems) {
      if (item.languageCode) {
        codes.add(item.languageCode.toLowerCase());
      }
    }
  }

  return [
    DEFAULT_LANGUAGE_OPTION,
    ...Array.from(codes)
      .sort()
      .map((code) => ({ label: formatLanguageLabel(code), value: code })),
  ];
}

export function listActiveExplorerFilters(filters: {
  keyword: string;
  selectedSource: string;
  selectedCategory: string;
  selectedStage?: string;
  selectedConfidence?: string;
  selectedLens?: string;
  selectedMetaTrend?: string;
  selectedAudience: string;
  selectedMarket: string;
  selectedLanguage: string;
  selectedGeoCountry: string;
  sortBy: string;
  sortDirection?: "asc" | "desc";
  selectedStatus?: string;
  hideRecurring: boolean;
}): ExplorerActiveFilter[] {
  const result: ExplorerActiveFilter[] = [];
  if (filters.keyword.trim().length > 0) {
    result.push({
      key: "keyword",
      label: "Keyword",
      value: filters.keyword.trim(),
    });
  }
  if (filters.selectedSource !== "all") {
    result.push({
      key: "source",
      label: "Source",
      value: formatSourceLabel(filters.selectedSource),
    });
  }
  if (filters.selectedCategory !== "all") {
    result.push({
      key: "category",
      label: "Category",
      value: formatCategory(filters.selectedCategory),
    });
  }
  if ((filters.selectedStage ?? "all") !== "all") {
    result.push({
      key: "stage",
      label: "Stage",
      value: formatStageLabel(filters.selectedStage),
    });
  }
  if ((filters.selectedConfidence ?? "all") !== "all") {
    result.push({
      key: "confidence",
      label: "Confidence",
      value: formatConfidenceBucketLabel(filters.selectedConfidence),
    });
  }
  if ((filters.selectedLens ?? "all") !== "all") {
    result.push({
      key: "lens",
      label: "Lens",
      value: formatLensLabel(filters.selectedLens ?? "all"),
    });
  }
  if ((filters.selectedMetaTrend ?? "all") !== "all") {
    result.push({
      key: "metaTrend",
      label: "Meta trend",
      value: filters.selectedMetaTrend ?? "General",
    });
  }
  if (filters.selectedAudience !== "all") {
    result.push({
      key: "audience",
      label: "Audience",
      value: formatAudienceLabel(filters.selectedAudience),
    });
  }
  if (filters.selectedMarket !== "all") {
    result.push({
      key: "market",
      label: "Market",
      value: formatAudienceLabel(filters.selectedMarket),
    });
  }
  if (filters.selectedLanguage !== "all") {
    result.push({
      key: "language",
      label: "Language",
      value: formatLanguageLabel(filters.selectedLanguage),
    });
  }
  if (filters.selectedGeoCountry !== "all") {
    result.push({
      key: "geo",
      label: "Geo",
      value: formatGeoCountryLabel(filters.selectedGeoCountry),
    });
  }
  if (
    filters.sortBy !== "rank" ||
    (filters.sortDirection ?? "asc") !== "asc"
  ) {
    const arrow = (filters.sortDirection ?? "asc") === "asc" ? "\u2191" : "\u2193";
    result.push({
      key: "sort",
      label: "Sort",
      value: `${formatExplorerSortLabel(filters.sortBy)} ${arrow}`,
    });
  }
  if ((filters.selectedStatus ?? "all") !== "all") {
    result.push({
      key: "status",
      label: "Status",
      value: formatStatusLabel(filters.selectedStatus),
    });
  }
  if (filters.hideRecurring) {
    result.push({
      key: "seasonality",
      label: "Seasonality",
      value: "Hide recurring",
    });
  }
  return result;
}

export function isThesisPresetApplied(
  preset: ThesisPreset,
  state: ThesisPresetFilterState,
) {
  const expectedSort = preset.sortBy ?? "rank";
  const expectedDirection =
    preset.sortDirection ?? DEFAULT_SORT_DIRECTIONS[expectedSort] ?? "asc";
  return (
    state.keyword.trim().length === 0 &&
    state.selectedSource === (preset.source ?? "all") &&
    state.selectedCategory === "all" &&
    state.selectedStage === (preset.stage ?? "all") &&
    state.selectedConfidence === "all" &&
    state.selectedLens === (preset.lens ?? "all") &&
    state.selectedMetaTrend === "all" &&
    state.selectedAudience === (preset.audience ?? "all") &&
    state.selectedMarket === "all" &&
    state.selectedLanguage === "all" &&
    state.selectedGeoCountry === "all" &&
    (state.minimumScore ?? 0) === (preset.minimumScore ?? 0) &&
    state.sortBy === expectedSort &&
    state.sortDirection === expectedDirection &&
    state.selectedStatus === (preset.status ?? "all") &&
    state.hideRecurring === (preset.hideRecurring ?? false)
  );
}

export function shouldClearActiveThesisPreset(
  activePresetKey: string | null,
  preset: ThesisPreset,
) {
  return activePresetKey === preset.key;
}

export { trendMatchesAudience, trendMatchesMarket, trendMatchesLanguage } from "@/lib/trend-filters";
export { confidenceBucketForTrend } from "@/lib/trend-filters";
