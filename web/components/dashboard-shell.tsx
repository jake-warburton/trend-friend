"use client";

import { Input } from "@base-ui/react/input";
import { NumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GeoMapClient } from "@/components/geo-map-client";
import { detectChangedTrendIds, hasOverviewChanged } from "@/lib/auto-refresh";
import { formatCategoryLabel } from "@/lib/category-labels";
import type { OverviewRefreshMeta } from "@/lib/auto-refresh";
import { buildExplorerGeoMapData, trendMatchesGeo } from "@/lib/explorer-geo";
import {
  formatForecastConfidence,
  getExplorerForecastBadge,
} from "@/lib/forecast-ui";
import {
  getPrimaryEvidenceLink,
  normalizeEvidenceUrl,
  summarizeEvidencePreview,
} from "@/lib/evidence-links";
import { formatCountryLabel, getRegionName } from "@/lib/geo-map-data";
import { buildSourceImpactRows } from "@/lib/source-impact";
import {
  buildSourceContributionInsights,
  buildSourceFamilyHistoryInsightsFromSnapshots,
  buildSourceFamilyHistoryInsights,
  buildSourceFamilyInsights,
  formatSourceFamilyLabel,
  formatSourceLabel,
  getSourceFreshnessBadge,
  summarizeTopSourceDrivers,
} from "@/lib/source-health";
import { getSeasonalityBadge, isRecurringTrend } from "@/lib/seasonality-ui";
import { getWikipediaLinkFromDetail } from "@/lib/wikipedia";
import { UpgradeModal, useUpgradeGate } from "@/components/upgrade-modal";
import {
  confidenceBucketForTrend,
  trendMatchesAudience,
  trendMatchesMarket,
  trendMatchesLanguage,
} from "@/lib/trend-filters";

import type {
  BreakingFeed,
  ExploreDeferredData,
  ExploreInitialData,
  SourceSummaryResponse,
  TrendDetailIndexResponse,
  TrendDetailRecord,
  TrendExplorerRecord,
  TrendHistoryResponse,
} from "@/lib/types";
import type { ThesisPreset, ExplorerActiveFilter, ThesisPresetFilterState } from "@/components/explorer/types";
import {
  OVERVIEW_POLL_INTERVAL_MS,
  UPDATED_TRENDS_FLASH_MS,
  EMPTY_GENERATED_AT,
  EMPTY_HISTORY,
  EMPTY_DETAIL_INDEX,
  EMPTY_SOURCE_SUMMARY,
  SOURCE_FILTER_OPTIONS,
  DEFAULT_CATEGORY_OPTION,
  DEFAULT_AUDIENCE_OPTION,
  DEFAULT_MARKET_OPTION,
  DEFAULT_LANGUAGE_OPTION,
  DEFAULT_STAGE_OPTION,
  DEFAULT_CONFIDENCE_OPTION,
  DEFAULT_META_TREND_OPTION,
  STAGE_OPTIONS,
  CONFIDENCE_OPTIONS,
  LENS_OPTIONS,
  SORT_OPTIONS,
  DEFAULT_SORT_DIRECTIONS,
  DEFAULT_STATUS_OPTION,
  STATUS_OPTIONS,
  EXPLORER_PAGE_SIZE,
} from "@/components/explorer/constants";
import { THESIS_PRESETS, THESIS_PRESET_ICONS } from "@/components/explorer/thesis-presets";
import { getSourceColor, buildConicGradient } from "@/components/explorer/source-palette";
import {
  buildTrendCardKey, formatDateOnly,
  formatRankChange, formatMomentum, formatMomentumHeadline,
  formatMomentumDetail, formatScoreMix, formatCollapsedSourceDriverSummary,
  formatCollapsedCorroborationSummary, movementClassName, compareDates,
  formatCategory,
  formatTrendStatus, trendStatusClassName, formatVolatility, volatilityClassName,
  scaleValue, formatPercent,
  formatAudiencePrefix, formatAudienceLabel,
  formatConfidenceLabel, formatConfidenceBucketLabel, formatStageLabel,
  buildTrendAudienceBadge, summarizeTrendAudience, formatLanguageLabel,
  formatExplorerSortLabel, formatStatusLabel, getOpportunityScoreForLens,
  formatLensLabel, getOptionLabel, formatGeoCountryLabel,
} from "@/components/explorer/format";
import {
  listActiveExplorerFilters, isThesisPresetApplied, shouldClearActiveThesisPreset,
  buildAudienceFilterOptions, buildMarketFilterOptions, buildLanguageFilterOptions,
} from "@/components/explorer/filters";
import { BreakingFeedSection } from "@/components/explorer/breaking-feed-section";

type DashboardShellProps = {
  initialData: ExploreInitialData;
};

const LazyGeoMapCompact = dynamic(
  () => import("@/components/geo-map-compact").then((mod) => mod.GeoMapCompact),
  { ssr: false, loading: () => null },
);

const LazyTrendTrajectoryChart = dynamic(
  () =>
    import("@/components/trend-trajectory-chart").then(
      (mod) => mod.TrendTrajectoryChart,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="chart-empty">Loading trajectory history...</p>
    ),
  },
);

export function DashboardShell({
  initialData,
}: DashboardShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { modalOpen: upgradeModalOpen, closeModal: closeUpgradeModal, requirePro } = useUpgradeGate();
  const [deferredData, setDeferredData] = useState<ExploreDeferredData | null>(
    null,
  );
  const [deferredDataState, setDeferredDataState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [isPending, startTransition] = useTransition();
  // -- Explorer filter state (defaults match SSR; hydrated from URL in effect below) --
  const [keyword, setKeyword] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedConfidence, setSelectedConfidence] = useState<string>("all");
  const [selectedLens, setSelectedLens] = useState<string>("all");
  const [selectedMetaTrend, setSelectedMetaTrend] = useState<string>("all");
  const [selectedAudience, setSelectedAudience] = useState<string>("all");
  const [selectedMarket, setSelectedMarket] = useState<string>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [selectedGeoCountry, setSelectedGeoCountry] = useState<string>("all");
  const [minimumScore, setMinimumScore] = useState<number | null>(0);
  const [sortBy, setSortBy] = useState<string>("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [hideRecurring, setHideRecurring] = useState(false);
  const [breakingFeed, setBreakingFeed] = useState<BreakingFeed | null>(null);
  const [overviewMeta, setOverviewMeta] = useState({
    generatedAt: initialData.overview.generatedAt,
    lastRunAt: initialData.overview.operations.lastRunAt,
  });
  const [liveUpdateState, setLiveUpdateState] = useState<
    "idle" | "checking" | "updating" | "updated"
  >("idle");
  const [changedTrendIds, setChangedTrendIds] = useState<string[]>([]);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [, startAutoRefresh] = useTransition();
  const overviewMetaRef = useRef<OverviewRefreshMeta>({
    generatedAt: initialData.overview.generatedAt,
    operations: { lastRunAt: initialData.overview.operations.lastRunAt },
  });
  const explorerTrendRef = useRef(
    initialData.explorer.trends.map((trend) => ({
      id: trend.id,
      rank: trend.rank,
      score: { total: trend.score.total },
    })),
  );
  const initialRenderRef = useRef(true);
  const updatedBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const screenshotMode = searchParams.get("screenshot") === "1";
  const screenshotPanel = searchParams.get("panel");
  const screenshotTrendId = searchParams.get("trend");
  const overview = initialData.overview;
  const explorer = initialData.explorer;
  const history = deferredData?.history ?? EMPTY_HISTORY;
  const details = deferredData?.details ?? EMPTY_DETAIL_INDEX;
  const sourceSummary = deferredData?.sourceSummary ?? EMPTY_SOURCE_SUMMARY;
  const hasDeferredData = deferredDataState === "ready";
  const deferredKeyword = useDeferredValue(keyword);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(explorer.trends.map((trend) => trend.category)),
    ).sort();
    return [
      DEFAULT_CATEGORY_OPTION,
      ...categories.map((category) => ({
        label: formatCategory(category),
        value: category,
      })),
    ];
  }, [explorer.trends]);

  const audienceOptions = useMemo(
    () => buildAudienceFilterOptions(details.trends),
    [details.trends],
  );
  const metaTrendOptions = useMemo(() => {
    const metaTrends = Array.from(
      new Set(explorer.trends.map((trend) => trend.metaTrend)),
    ).sort();
    return [
      DEFAULT_META_TREND_OPTION,
      ...metaTrends.map((metaTrend) => ({
        label: metaTrend,
        value: metaTrend,
      })),
    ];
  }, [explorer.trends]);
  const marketOptions = useMemo(
    () => buildMarketFilterOptions(details.trends),
    [details.trends],
  );
  const languageOptions = useMemo(
    () => buildLanguageFilterOptions(details.trends),
    [details.trends],
  );

  const detailsByTrendId = useMemo(() => {
    const map = new Map<string, TrendDetailRecord>();
    for (const detail of details.trends) {
      map.set(detail.id, detail);
    }
    return map;
  }, [details.trends]);
  const sourceImpactRows = useMemo(
    () =>
      buildSourceImpactRows(
        overview.sources,
        explorer.trends,
        detailsByTrendId,
      ),
    [
      detailsByTrendId,
      explorer.trends,
      overview.sources,
    ],
  );
  const sourceFamilyInsights = useMemo(
    () => buildSourceFamilyInsights(overview.sources),
    [overview.sources],
  );
  const sourceFamilyHistoryInsights = useMemo(
    () =>
      sourceSummary.familyHistory.length > 0
        ? buildSourceFamilyHistoryInsightsFromSnapshots(
            sourceSummary.familyHistory,
          )
        : buildSourceFamilyHistoryInsights(sourceSummary.sources),
    [
      sourceSummary.familyHistory,
      sourceSummary.sources,
    ],
  );

  const activeExplorerFilters = useMemo(
    () =>
      listActiveExplorerFilters({
        keyword,
        selectedSource,
        selectedCategory,
        selectedStage,
        selectedConfidence,
        selectedLens,
        selectedMetaTrend,
        selectedAudience,
        selectedMarket,
        selectedLanguage,
        selectedGeoCountry,
        sortBy,
        sortDirection,
        selectedStatus,
        hideRecurring,
      }),
    [
      hideRecurring,
      keyword,
      selectedAudience,
      selectedCategory,
      selectedConfidence,
      selectedGeoCountry,
      selectedLens,
      selectedLanguage,
      selectedMarket,
      selectedMetaTrend,
      selectedSource,
      selectedStage,
      selectedStatus,
      sortBy,
      sortDirection,
    ],
  );
  const selectedSourceLabel = getOptionLabel(
    SOURCE_FILTER_OPTIONS,
    selectedSource,
    "All sources",
  );
  const selectedCategoryLabel = getOptionLabel(
    categoryOptions,
    selectedCategory,
    "All categories",
  );
  const selectedStageLabel = getOptionLabel(
    STAGE_OPTIONS,
    selectedStage,
    "All stages",
  );
  const selectedConfidenceLabel = getOptionLabel(
    CONFIDENCE_OPTIONS,
    selectedConfidence,
    "All confidence",
  );
  const selectedLensLabel = getOptionLabel(
    LENS_OPTIONS,
    selectedLens,
    "All lenses",
  );
  const selectedMetaTrendLabel = getOptionLabel(
    metaTrendOptions,
    selectedMetaTrend,
    "All meta trends",
  );
  const selectedAudienceLabel = getOptionLabel(
    audienceOptions,
    selectedAudience,
    "All audiences",
  );
  const selectedMarketLabel = getOptionLabel(
    marketOptions,
    selectedMarket,
    "All markets",
  );
  const selectedLanguageLabel = getOptionLabel(
    languageOptions,
    selectedLanguage,
    "All languages",
  );
  const selectedSortLabel = getOptionLabel(SORT_OPTIONS, sortBy, "Rank");
  const selectedStatusLabel = getOptionLabel(
    STATUS_OPTIONS,
    selectedStatus,
    "All statuses",
  );
  const activeThesisPresetKey = useMemo(
    () =>
      THESIS_PRESETS.find((preset) =>
        isThesisPresetApplied(preset, {
          keyword,
          selectedSource,
          selectedCategory,
          selectedStage,
          selectedConfidence,
          selectedLens,
          selectedMetaTrend,
          selectedAudience,
          selectedMarket,
          selectedLanguage,
          selectedGeoCountry,
          minimumScore,
          sortBy,
          sortDirection,
          selectedStatus,
          hideRecurring,
        }),
      )?.key ?? null,
    [
      hideRecurring,
      keyword,
      minimumScore,
      selectedAudience,
      selectedCategory,
      selectedConfidence,
      selectedGeoCountry,
      selectedLanguage,
      selectedLens,
      selectedMarket,
      selectedMetaTrend,
      selectedSource,
      selectedStage,
      selectedStatus,
      sortBy,
      sortDirection,
    ],
  );

  const baseFilteredTrends = useMemo(() => {
    const normalizedKeyword = deferredKeyword.trim().toLowerCase();
    const minimum = minimumScore ?? 0;
    const trends = explorer.trends.filter((trend) => {
      const detail = detailsByTrendId.get(trend.id);
      const matchesSource =
        selectedSource === "all" || trend.sources.includes(selectedSource);
      const matchesCategory =
        selectedCategory === "all" || trend.category === selectedCategory;
      const matchesStage =
        selectedStage === "all" || trend.stage === selectedStage;
      const matchesConfidence =
        selectedConfidence === "all" ||
        confidenceBucketForTrend(trend.confidence) === selectedConfidence;
      const matchesMetaTrend =
        selectedMetaTrend === "all" || trend.metaTrend === selectedMetaTrend;
      const matchesAudience = trendMatchesAudience(detail, selectedAudience);
      const matchesMarket = trendMatchesMarket(detail, selectedMarket);
      const matchesLanguage = trendMatchesLanguage(detail, selectedLanguage);
      const matchesGeo = trendMatchesGeo(detail, selectedGeoCountry);
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        trend.name.toLowerCase().includes(normalizedKeyword) ||
        trend.evidencePreview.some((item) =>
          item.toLowerCase().includes(normalizedKeyword),
        );
      const matchesScore = trend.score.total >= minimum;
      const matchesSeasonality =
        !hideRecurring || !isRecurringTrend(trend.seasonality);
      const matchesStatus =
        selectedStatus === "all" || trend.status === selectedStatus;
      return (
        matchesSource &&
        matchesCategory &&
        matchesStage &&
        matchesConfidence &&
        matchesMetaTrend &&
        matchesAudience &&
        matchesMarket &&
        matchesLanguage &&
        matchesGeo &&
        matchesKeyword &&
        matchesScore &&
        matchesSeasonality &&
        matchesStatus
      );
    });

    const dir = sortDirection === "asc" ? 1 : -1;
    return [...trends].sort((left, right) => {
      const leftDetail = detailsByTrendId.get(left.id);
      const rightDetail = detailsByTrendId.get(right.id);
      if (selectedLens !== "all") {
        const lensDelta =
          getOpportunityScoreForLens(rightDetail, selectedLens) -
          getOpportunityScoreForLens(leftDetail, selectedLens);
        if (lensDelta !== 0) {
          return lensDelta;
        }
      }
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
  }, [
    deferredKeyword,
    detailsByTrendId,
    hideRecurring,
    explorer.trends,
    minimumScore,
    selectedAudience,
    selectedCategory,
    selectedConfidence,
    selectedGeoCountry,
    selectedLanguage,
    selectedLens,
    selectedMarket,
    selectedMetaTrend,
    selectedSource,
    selectedStage,
    selectedStatus,
    sortBy,
    sortDirection,
  ]);

  const explorerGeoMapData = useMemo(
    () => buildExplorerGeoMapData(baseFilteredTrends, detailsByTrendId),
    [baseFilteredTrends, detailsByTrendId],
  );

  const filteredTrends = baseFilteredTrends;

  const totalPages = Math.max(1, Math.ceil(filteredTrends.length / EXPLORER_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTrends = filteredTrends.slice(
    (safePage - 1) * EXPLORER_PAGE_SIZE,
    safePage * EXPLORER_PAGE_SIZE,
  );

  // -- Hydrate explorer filter state from URL params on mount --
  const urlHydratedRef = useRef(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const hasParams = p.toString().length > 0;
    if (!hasParams) { urlHydratedRef.current = true; return; }
    if (p.get("q")) setKeyword(p.get("q")!);
    if (p.get("source")) setSelectedSource(p.get("source")!);
    if (p.get("category")) setSelectedCategory(p.get("category")!);
    if (p.get("stage")) setSelectedStage(p.get("stage")!);
    if (p.get("confidence")) setSelectedConfidence(p.get("confidence")!);
    if (p.get("lens")) setSelectedLens(p.get("lens")!);
    if (p.get("metaTrend")) setSelectedMetaTrend(p.get("metaTrend")!);
    if (p.get("audience")) setSelectedAudience(p.get("audience")!);
    if (p.get("market")) setSelectedMarket(p.get("market")!);
    if (p.get("language")) setSelectedLanguage(p.get("language")!);
    if (p.get("geo")) setSelectedGeoCountry(p.get("geo")!);
    if (p.get("minScore")) setMinimumScore(Number(p.get("minScore")));
    if (p.get("sort")) setSortBy(p.get("sort")!);
    if (p.get("dir") === "desc") setSortDirection("desc");
    if (p.get("status")) setSelectedStatus(p.get("status")!);
    if (p.get("hideRecurring") === "1") setHideRecurring(true);
    if (p.get("page")) setCurrentPage(Math.max(1, Number(p.get("page"))));
    // Mark hydrated after a tick so the filter-reset and URL-sync effects skip
    // the state changes triggered by this hydration.
    requestAnimationFrame(() => { urlHydratedRef.current = true; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset page to 1 when any filter changes (but not during hydration or mount).
  const filterFingerprint = `${keyword}|${selectedSource}|${selectedCategory}|${selectedStage}|${selectedConfidence}|${selectedLens}|${selectedMetaTrend}|${selectedAudience}|${selectedMarket}|${selectedLanguage}|${selectedGeoCountry}|${minimumScore}|${sortBy}|${sortDirection}|${selectedStatus}|${hideRecurring}`;
  const prevFilterFingerprint = useRef(filterFingerprint);
  useEffect(() => {
    if (!urlHydratedRef.current) { prevFilterFingerprint.current = filterFingerprint; return; }
    if (prevFilterFingerprint.current !== filterFingerprint) {
      prevFilterFingerprint.current = filterFingerprint;
      setCurrentPage(1);
    }
  }, [filterFingerprint]);

  // -- Sync explorer filter state → URL (replaceState to avoid history spam) --
  useEffect(() => {
    if (!urlHydratedRef.current) return;
    const params = new URLSearchParams();
    if (keyword) params.set("q", keyword);
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedStage !== "all") params.set("stage", selectedStage);
    if (selectedConfidence !== "all") params.set("confidence", selectedConfidence);
    if (selectedLens !== "all") params.set("lens", selectedLens);
    if (selectedMetaTrend !== "all") params.set("metaTrend", selectedMetaTrend);
    if (selectedAudience !== "all") params.set("audience", selectedAudience);
    if (selectedMarket !== "all") params.set("market", selectedMarket);
    if (selectedLanguage !== "all") params.set("language", selectedLanguage);
    if (selectedGeoCountry !== "all") params.set("geo", selectedGeoCountry);
    if (minimumScore && minimumScore > 0) params.set("minScore", String(minimumScore));
    if (sortBy !== "rank") params.set("sort", sortBy);
    if (sortDirection !== "asc") params.set("dir", sortDirection);
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    if (hideRecurring) params.set("hideRecurring", "1");
    if (currentPage > 1) params.set("page", String(currentPage));
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", url);
  }, [
    keyword, selectedSource, selectedCategory, selectedStage, selectedConfidence,
    selectedLens, selectedMetaTrend, selectedAudience, selectedMarket,
    selectedLanguage, selectedGeoCountry, minimumScore, sortBy, sortDirection,
    selectedStatus, hideRecurring, currentPage,
  ]);

  function goToPage(page: number) {
    setCurrentPage(page);
    setExpandedTrendId(null);
    document.getElementById("explorer-heading")?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedStage !== "all") params.set("stage", selectedStage);
    if (selectedConfidence !== "all")
      params.set("confidence", selectedConfidence);
    if (selectedLens !== "all") params.set("lens", selectedLens);
    if (selectedMetaTrend !== "all") params.set("metaTrend", selectedMetaTrend);
    if (selectedAudience !== "all") params.set("audience", selectedAudience);
    if (selectedMarket !== "all") params.set("market", selectedMarket);
    if (selectedLanguage !== "all") params.set("language", selectedLanguage);
    if (selectedGeoCountry !== "all") params.set("geo", selectedGeoCountry);
    if (keyword) params.set("q", keyword);
    if (minimumScore && minimumScore > 0)
      params.set("min", String(minimumScore));
    if (hideRecurring) params.set("hideRecurring", "1");
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    params.set("sort", sortBy);
    params.set("sortDir", sortDirection);
    return `/api/export?${params.toString()}`;
  }, [
    selectedSource,
    selectedCategory,
    selectedStage,
    selectedConfidence,
    selectedLens,
    selectedMetaTrend,
    selectedAudience,
    selectedMarket,
    selectedLanguage,
    selectedGeoCountry,
    keyword,
    minimumScore,
    hideRecurring,
    selectedStatus,
    sortBy,
    sortDirection,
  ]);

  function handleSortChange(value: string) {
    setSortBy(value);
    setSortDirection(DEFAULT_SORT_DIRECTIONS[value] ?? "desc");
  }

  function handleToggleExpand(trendId: string) {
    setExpandedTrendId((prev) => (prev === trendId ? null : trendId));
  }

  function clearExplorerFilter(filterKey: ExplorerActiveFilter["key"]) {
    if (filterKey === "keyword") {
      setKeyword("");
      return;
    }
    if (filterKey === "source") {
      setSelectedSource("all");
      return;
    }
    if (filterKey === "category") {
      setSelectedCategory("all");
      return;
    }
    if (filterKey === "stage") {
      setSelectedStage("all");
      return;
    }
    if (filterKey === "confidence") {
      setSelectedConfidence("all");
      return;
    }
    if (filterKey === "lens") {
      setSelectedLens("all");
      return;
    }
    if (filterKey === "metaTrend") {
      setSelectedMetaTrend("all");
      return;
    }
    if (filterKey === "audience") {
      setSelectedAudience("all");
      return;
    }
    if (filterKey === "market") {
      setSelectedMarket("all");
      return;
    }
    if (filterKey === "language") {
      setSelectedLanguage("all");
      return;
    }
    if (filterKey === "geo") {
      setSelectedGeoCountry("all");
      return;
    }
    if (filterKey === "sort") {
      setSortBy("rank");
      setSortDirection("asc");
      return;
    }
    if (filterKey === "status") {
      setSelectedStatus("all");
      return;
    }
    setHideRecurring(false);
  }

  function clearAllExplorerFilters() {
    setKeyword("");
    setSelectedSource("all");
    setSelectedCategory("all");
    setSelectedStage("all");
    setSelectedConfidence("all");
    setSelectedLens("all");
    setSelectedMetaTrend("all");
    setSelectedAudience("all");
    setSelectedMarket("all");
    setSelectedLanguage("all");
    setSelectedGeoCountry("all");
    setSortBy("rank");
    setSortDirection("asc");
    setSelectedStatus("all");
    setMinimumScore(0);
    setHideRecurring(false);
    setCurrentPage(1);
  }

  function applyThesisPreset(preset: ThesisPreset) {
    if (shouldClearActiveThesisPreset(activeThesisPresetKey, preset)) {
      clearAllExplorerFilters();
      return;
    }
    setKeyword("");
    setSelectedSource(preset.source ?? "all");
    setSelectedCategory("all");
    setSelectedStage(preset.stage ?? "all");
    setSelectedConfidence("all");
    setSelectedLens(preset.lens ?? "all");
    setSelectedMetaTrend("all");
    setSelectedAudience(preset.audience ?? "all");
    setSelectedMarket("all");
    setSelectedLanguage("all");
    setSelectedGeoCountry("all");
    const presetSort = preset.sortBy ?? "rank";
    setSortBy(presetSort);
    setSortDirection(
      preset.sortDirection ?? DEFAULT_SORT_DIRECTIONS[presetSort] ?? "asc",
    );
    setSelectedStatus(preset.status ?? "all");
    setMinimumScore(preset.minimumScore ?? 0);
    setHideRecurring(preset.hideRecurring ?? false);
    setCurrentPage(1);
  }



  useEffect(() => {
    if (screenshotTrendId) {
      setExpandedTrendId(screenshotTrendId);
    }
  }, [screenshotTrendId]);


  useEffect(() => {
    const abortController = new AbortController();

    async function loadDeferredExploreData() {
      setDeferredDataState("loading");
      try {
        const response = await fetch("/api/explore/bootstrap", {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Bootstrap unavailable (${response.status})`);
        }
        const payload = (await response.json()) as ExploreDeferredData;
        if (!abortController.signal.aborted) {
          setDeferredData(payload);
          setDeferredDataState("ready");
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setDeferredDataState("error");
        if (error instanceof Error) {
          console.error("Failed to load deferred explorer data", error);
        }
      }
    }

    void loadDeferredExploreData();
    return () => abortController.abort();
  }, [explorer.generatedAt, overview.generatedAt]);

  useEffect(() => {
    if (
      expandedTrendId != null &&
      !filteredTrends.some((t) => t.id === expandedTrendId)
    ) {
      setExpandedTrendId(null);
    }
  }, [filteredTrends, expandedTrendId]);

  useEffect(() => {
    const nextOverviewMeta = {
      generatedAt: overview.generatedAt,
      operations: { lastRunAt: overview.operations.lastRunAt },
    };
    const nextExplorerTrends = explorer.trends.map((trend) => ({
      id: trend.id,
      rank: trend.rank,
      score: { total: trend.score.total },
    }));

    const overviewChanged = hasOverviewChanged(
      overviewMetaRef.current,
      nextOverviewMeta,
    );
    const changedIds = detectChangedTrendIds(
      explorerTrendRef.current,
      nextExplorerTrends,
    );

    overviewMetaRef.current = nextOverviewMeta;
    explorerTrendRef.current = nextExplorerTrends;
    setOverviewMeta({
      generatedAt: nextOverviewMeta.generatedAt,
      lastRunAt: nextOverviewMeta.operations.lastRunAt,
    });

    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    if (overviewChanged) {
      setLiveUpdateState("updated");
      setChangedTrendIds(changedIds);
      if (updatedBadgeTimeoutRef.current) {
        clearTimeout(updatedBadgeTimeoutRef.current);
      }
      updatedBadgeTimeoutRef.current = setTimeout(() => {
        setLiveUpdateState("idle");
        setChangedTrendIds([]);
      }, UPDATED_TRENDS_FLASH_MS);
    }
  }, [explorer.trends, overview]);

  useEffect(() => {
    async function fetchBreakingFeed() {
      try {
        const response = await fetch("/api/breaking");
        if (response.ok) {
          const feed = await response.json();
          setBreakingFeed(feed);
        }
      } catch { /* ignore fetch errors */ }
    }
    void fetchBreakingFeed();
    const intervalId = window.setInterval(() => {
      void fetchBreakingFeed();
    }, 300_000); // 5 minutes
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void fetchBreakingFeed();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (screenshotMode) {
      return;
    }
    const intervalId = window.setInterval(async () => {
      setLiveUpdateState((current) =>
        current === "updating" ? current : "checking",
      );
      try {
        const response = await fetch("/api/dashboard/overview");
        if (!response.ok) {
          setLiveUpdateState("idle");
          return;
        }
        const nextOverview = (await response.json()) as OverviewRefreshMeta;
        if (!hasOverviewChanged(overviewMetaRef.current, nextOverview)) {
          setLiveUpdateState("idle");
          return;
        }
        setLiveUpdateState("updating");
        startAutoRefresh(() => {
          router.refresh();
        });
      } catch {
        setLiveUpdateState("idle");
      }
    }, OVERVIEW_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      if (updatedBadgeTimeoutRef.current) {
        clearTimeout(updatedBadgeTimeoutRef.current);
      }
    };
  }, [router, screenshotMode, startAutoRefresh]);

  return (
    <main
      className={
        screenshotMode
          ? "dashboard-page dashboard-page-screenshot"
          : "dashboard-page"
      }
      data-screenshot-target="explore"
      data-screenshot-panel={screenshotPanel ?? undefined}
    >
      {/* ── Top 5 Trends ──────────────────────────────────── */}
      <section className="top-trends-strip">
        {overview.sections.topTrends.slice(0, 5).map((trend, i) => (
          <Link
            className="top-trend-chip"
            href={`/trends/${trend.id}`}
            key={trend.id}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="top-trend-rank">#{trend.rank}</span>
            <span className="top-trend-name">{trend.name}</span>
            <span className="top-trend-score">{trend.scoreTotal.toFixed(1)}</span>
          </Link>
        ))}
      </section>

      {/* ── Breaking Feed ─────────────────────────────────── */}
      <BreakingFeedSection feed={breakingFeed} />

      {hasDeferredData && explorerGeoMapData.length > 0 ? (
        <section className="explorer-geo-strip">
          <div className="explorer-geo-panel">
            <div className="explorer-geo-panel-head">
              <div>
                <strong>Geographic footprint</strong>
                <p className="source-summary-copy">
                  {explorerGeoMapData.length} countr
                  {explorerGeoMapData.length === 1 ? "y" : "ies"} across{" "}
                  {filteredTrends.length} visible trend
                  {filteredTrends.length === 1 ? "" : "s"}
                </p>
              </div>
              {selectedGeoCountry !== "all" ? (
                <button
                  className="mini-action-button"
                  onClick={() => setSelectedGeoCountry("all")}
                  type="button"
                >
                  Clear geo filter
                </button>
              ) : (
                <span className="section-heading-meta">
                  Click a country to filter
                </span>
              )}
            </div>
            <GeoMapClient
              height={320}
              mapData={explorerGeoMapData}
              onCountrySelect={(countryCode) =>
                setSelectedGeoCountry((current) =>
                  current === countryCode ? "all" : countryCode,
                )
              }
              selectedCountryCode={
                selectedGeoCountry !== "all" ? selectedGeoCountry : null
              }
            />
          </div>
        </section>
      ) : deferredDataState === "loading" ? (
        <section className="explorer-geo-strip">
          <div className="explorer-geo-panel">
            <div className="explorer-geo-panel-head">
              <div>
                <strong>Geographic footprint</strong>
                <p className="source-summary-copy">
                  Loading geographic coverage...
                </p>
              </div>
            </div>
            <div className="geo-map-skeleton skeleton-pulse" style={{ height: 320 }} />
          </div>
        </section>
      ) : null}

      <section className="content-grid">
        <div className="ranking-panel">
          <div className="section-heading" id="explorer-heading">
            <h2>Explorer</h2>
            <div className="section-heading-actions">
              <button
                className="mini-action-button export-button"
                type="button"
                onClick={() => {
                  requirePro(() => {
                    window.location.href = exportHref;
                  });
                }}
              >
                Export CSV
              </button>
              <span className="section-heading-meta">
                {filteredTrends.length} live · page {safePage} of {totalPages}
              </span>
            </div>
          </div>

          <div
            className={
              isPending
                ? "explorer-list explorer-list-pending"
                : "explorer-list"
            }
            aria-busy={isPending}
          >
            <section className="thesis-filters-panel">
              <div className="filter-field filter-field-wide thesis-filter-block">
                <span>Thesis presets</span>
                <div className="thesis-presets-grid">
                  {THESIS_PRESETS.map((preset) => (
                    <button
                      aria-pressed={activeThesisPresetKey === preset.key}
                      className={
                        activeThesisPresetKey === preset.key
                          ? "thesis-preset-card thesis-preset-card-active"
                          : "thesis-preset-card"
                      }
                      key={preset.key}
                      onClick={() => applyThesisPreset(preset)}
                      type="button"
                    >
                      {THESIS_PRESET_ICONS[preset.key] ?? null}
                      <strong>{preset.label}</strong>
                      <small>{preset.description}</small>
                    </button>
                  ))}
                </div>
              </div>

            </section>

            <details className="advanced-filters-panel">
              <summary>
                <span>Advanced filters</span>
                <small>
                  {activeExplorerFilters.length > 0
                    ? `${activeExplorerFilters.length} active`
                    : "Keyword, source, scoring, and audience controls"}
                </small>
                <span aria-hidden="true" className="advanced-filters-chevron">
                  ▾
                </span>
              </summary>
              <section className="advanced-filters-grid filters-panel-wide">
                <label className="filter-field">
                  <span>Keyword</span>
                  <Input
                    className="text-input"
                    placeholder="AI agents, robotics, battery..."
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                  />
                </label>

                <label className="filter-field">
                  <span>Source</span>
                  <Select.Root
                    value={selectedSource}
                    onValueChange={(value) => setSelectedSource(value ?? "all")}
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedSourceLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {SOURCE_FILTER_OPTIONS.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Category</span>
                  <Select.Root
                    value={selectedCategory}
                    onValueChange={(value) =>
                      setSelectedCategory(value ?? "all")
                    }
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedCategoryLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {categoryOptions.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Stage</span>
                  <Select.Root
                    value={selectedStage}
                    onValueChange={(value) => setSelectedStage(value ?? "all")}
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedStageLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {STAGE_OPTIONS.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Status</span>
                  <Select.Root
                    value={selectedStatus}
                    onValueChange={(value) =>
                      setSelectedStatus(value ?? "all")
                    }
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedStatusLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {STATUS_OPTIONS.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Confidence</span>
                  <Select.Root
                    value={selectedConfidence}
                    onValueChange={(value) =>
                      setSelectedConfidence(value ?? "all")
                    }
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedConfidenceLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {CONFIDENCE_OPTIONS.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Lens</span>
                  <Select.Root
                    value={selectedLens}
                    onValueChange={(value) => setSelectedLens(value ?? "all")}
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedLensLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {LENS_OPTIONS.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Meta trend</span>
                  <Select.Root
                    value={selectedMetaTrend}
                    onValueChange={(value) =>
                      setSelectedMetaTrend(value ?? "all")
                    }
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedMetaTrendLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {metaTrendOptions.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Audience</span>
                  <Select.Root
                    value={selectedAudience}
                    onValueChange={(value) =>
                      setSelectedAudience(value ?? "all")
                    }
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedAudienceLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {audienceOptions.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Market</span>
                  <Select.Root
                    value={selectedMarket}
                    onValueChange={(value) => setSelectedMarket(value ?? "all")}
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedMarketLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {marketOptions.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Language</span>
                  <Select.Root
                    value={selectedLanguage}
                    onValueChange={(value) =>
                      setSelectedLanguage(value ?? "all")
                    }
                  >
                    <Select.Trigger className="select-trigger">
                      <span>{selectedLanguageLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="select-positioner"
                        sideOffset={8}
                      >
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {languageOptions.map((option) => (
                              <Select.Item
                                className="select-item"
                                key={option.value}
                                value={option.value}
                              >
                                <Select.ItemText>
                                  {option.label}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="filter-field">
                  <span>Sort</span>
                  <span
                    style={{
                      display: "flex",
                      gap: "0.25rem",
                      alignItems: "center",
                    }}
                  >
                    <Select.Root
                      value={sortBy}
                      onValueChange={(value) =>
                        handleSortChange(value ?? "rank")
                      }
                    >
                      <Select.Trigger className="select-trigger">
                        <span>{selectedSortLabel}</span>
                        <Select.Icon className="select-icon">▼</Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Positioner
                          className="select-positioner"
                          sideOffset={8}
                        >
                          <Select.Popup className="select-popup">
                            <Select.List className="select-list">
                              {SORT_OPTIONS.map((option) => (
                                <Select.Item
                                  className="select-item"
                                  key={option.value}
                                  value={option.value}
                                >
                                  <Select.ItemText>
                                    {option.label}
                                  </Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.List>
                          </Select.Popup>
                        </Select.Positioner>
                      </Select.Portal>
                    </Select.Root>
                    <button
                      className="toggle-chip"
                      type="button"
                      onClick={() =>
                        setSortDirection((d) =>
                          d === "asc" ? "desc" : "asc",
                        )
                      }
                      title={
                        sortDirection === "asc" ? "Ascending" : "Descending"
                      }
                      style={{ minWidth: "2rem", textAlign: "center" }}
                    >
                      {sortDirection === "asc" ? "\u2191" : "\u2193"}
                    </button>
                  </span>
                </label>

                <label className="filter-field">
                  <span>Minimum score</span>
                  <NumberField.Root
                    className="number-field"
                    min={0}
                    value={minimumScore}
                    onValueChange={setMinimumScore}
                  >
                    <NumberField.Group className="number-group">
                      <NumberField.Decrement className="number-button">
                        -
                      </NumberField.Decrement>
                      <NumberField.Input className="number-input" />
                      <NumberField.Increment className="number-button">
                        +
                      </NumberField.Increment>
                    </NumberField.Group>
                  </NumberField.Root>
                </label>

                <label className="filter-field filter-checkbox-field">
                  <span>Seasonality</span>
                  <button
                    className={
                      hideRecurring
                        ? "toggle-chip toggle-chip-active"
                        : "toggle-chip"
                    }
                    onClick={() => setHideRecurring((current) => !current)}
                    type="button"
                  >
                    {hideRecurring ? "Hiding recurring" : "Hide recurring"}
                  </button>
                </label>
              </section>
            </details>

            {activeExplorerFilters.length > 0 ? (
              <section
                className="explorer-active-filters"
                aria-label="Active explorer filters"
              >
                <div className="community-chip-group">
                  {activeExplorerFilters.map((filter) => (
                    <button
                      className="community-filter-chip"
                      key={filter.key}
                      onClick={() => clearExplorerFilter(filter.key)}
                      type="button"
                    >
                      {filter.label}: {filter.value}{" "}
                      <span aria-hidden="true">x</span>
                    </button>
                  ))}
                </div>
                <button
                  className="source-summary-copy detail-button-link"
                  onClick={clearAllExplorerFilters}
                  type="button"
                >
                  Clear all
                </button>
              </section>
            ) : null}

            <div className="explorer-legend" aria-hidden="true">
              <span>Trend</span>
              <span>Metrics</span>
            </div>
            {filteredTrends.length === 0 ? (
              <div className="empty-state">
                <h3>No trends match these filters.</h3>
                <p>
                  Lower the minimum score or broaden the keyword and source
                  filters.
                </p>
              </div>
            ) : (
              paginatedTrends.map((trend, index) => {
                const forecastBadge = getExplorerForecastBadge(
                  trend.forecastDirection,
                );
                const seasonalityBadge = getSeasonalityBadge(trend.seasonality);
                const detail = detailsByTrendId.get(trend.id);
                const primaryEvidenceLink = getPrimaryEvidenceLink(detail);
                const wikipediaLink = getWikipediaLinkFromDetail(detail);
                const audienceBadge = buildTrendAudienceBadge(
                  detail?.audienceSummary ?? [],
                );
                const audienceSummary = summarizeTrendAudience(
                  detail?.audienceSummary ?? [],
                );
                const evidencePreviewText = primaryEvidenceLink
                  ? summarizeEvidencePreview(
                      primaryEvidenceLink.evidence,
                      primaryEvidenceLink.source,
                    )
                  : summarizeEvidencePreview(trend.evidencePreview[0] ?? "");
                const evidenceMeta = [
                  primaryEvidenceLink
                    ? formatSourceLabel(primaryEvidenceLink.source)
                    : null,
                  audienceSummary,
                ]
                  .filter((item): item is string => Boolean(item))
                  .join(" · ");
                const compactSummaryParts = [
                  formatStageLabel(trend.stage),
                  formatConfidenceLabel(trend.confidence),
                  formatTrendStatus(trend.status),
                  formatVolatility(trend.volatility),
                  forecastBadge?.label ?? null,
                  seasonalityBadge?.label ?? null,
                  audienceBadge ?? null,
                  trend.metaTrend,
                ].filter((item): item is string => Boolean(item));
                const sourceInsights = detail
                  ? buildSourceContributionInsights(
                      detail.sourceContributions,
                      overview.sources,
                    ).slice(0, 5)
                  : [];
                return (
                  <article
                    className={
                      changedTrendIds.includes(trend.id)
                        ? "explorer-card explorer-card-updated"
                        : "explorer-card"
                    }
                    data-status={trend.status}
                    key={buildTrendCardKey(trend, index)}
                  >
                    <div className="explorer-card-top">
                      <div className="trend-cell explorer-card-head">
                        <div className="explorer-card-title-line">
                          <span className="explorer-rank-chip">
                            #{trend.rank}
                          </span>
                          <div className="trend-title-row">
                            <strong>
                              <Link
                                className="trend-link"
                                href={`/trends/${trend.id}`}
                              >
                                {trend.name}
                              </Link>
                            </strong>
                          </div>
                        </div>
                        <div className="explorer-card-meta">
                          <span>
                            {trend.firstSeenAt
                              ? `Since ${formatDateOnly(trend.firstSeenAt)}`
                              : "This run"}
                          </span>
                          <span>Sources: {trend.sources.length}</span>
                          <span>{formatCategory(trend.category)}</span>
                        </div>
                        <div className="explorer-card-summary">
                          <span>{compactSummaryParts.join(" / ")}</span>
                        </div>
                        {sourceInsights.length > 0 && (
                          <div className="explorer-source-bars">
                            {sourceInsights.map((insight) => (
                              <span
                                key={insight.source}
                                className="explorer-source-pip"
                                title={`${insight.title} ${insight.scoreSharePercent.toFixed(0)}%`}
                                style={{
                                  flex: `${insight.scoreSharePercent} 0 0`,
                                  opacity: 0.5 + (insight.scoreSharePercent / 100) * 0.5,
                                }}
                              >
                                {insight.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="explorer-metrics-row">
                        <div className="explorer-metrics-panel">
                          <div className="explorer-metric-card">
                            <span className="explorer-metric-label">
                              Trend strength
                            </span>
                            <strong className="explorer-metric-value">
                              {trend.score.total.toFixed(1)}
                            </strong>
                            <small className="explorer-metric-copy">
                              {formatScoreMix(trend.score)}
                            </small>
                          </div>

                          <div className="explorer-metric-card">
                            <span className="explorer-metric-label">
                              Change vs last run
                            </span>
                            <strong
                              className={`explorer-metric-value ${movementClassName(trend.rankChange)}`}
                            >
                              {formatMomentumHeadline(trend)}
                            </strong>
                            <small className="explorer-metric-copy">
                              {formatMomentumDetail(trend)}
                            </small>
                          </div>

                          <div className="explorer-metric-card">
                            <span className="explorer-metric-label">
                              Evidence base
                            </span>
                            <strong className="explorer-metric-value">
                              {trend.coverage.signalCount} signal
                              {trend.coverage.signalCount === 1 ? "" : "s"}
                            </strong>
                            <small className="explorer-metric-copy">
                              {trend.coverage.sourceCount} source{trend.coverage.sourceCount === 1 ? "" : "s"}
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="explorer-card-bottom">
                      <div className="evidence-preview evidence-preview-inline">
                        <div className="evidence-main-row">
                          <span className="explorer-evidence-label">
                            Latest signal
                          </span>
                          {primaryEvidenceLink?.evidenceUrl ? (
                            <a
                              className="trend-link"
                              href={normalizeEvidenceUrl(primaryEvidenceLink.evidenceUrl)}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {evidencePreviewText}
                            </a>
                          ) : (
                            <span>{evidencePreviewText}</span>
                          )}
                        </div>
                        {evidenceMeta || wikipediaLink ? (
                          <div className="evidence-meta-row">
                            {evidenceMeta ? (
                              <span className="source-summary-copy">
                                {evidenceMeta}
                              </span>
                            ) : null}
                            {wikipediaLink ? (
                              <a
                                className="trend-link source-summary-copy"
                                href={wikipediaLink.url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Background: {wikipediaLink.title}
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {trend.breaking && trend.breaking.tweets.length > 0 && (
                        <div className="explorer-breaking-strip">
                          <div className="explorer-breaking-header">
                            <span className="breaking-feed-dot" aria-hidden="true" />
                            <span className="explorer-breaking-label">Breaking</span>
                            <span className="breaking-feed-score">{trend.breaking.breakingScore.toFixed(1)}</span>
                            {trend.breaking.corroborated && (
                              <span className="breaking-feed-corroborated">Corroborated</span>
                            )}
                          </div>
                          <ul className="explorer-breaking-tweets">
                            {trend.breaking.tweets.slice(0, 2).map((tweet) => (
                              <li key={tweet.tweetId}>
                                <a
                                  href={`https://x.com/i/status/${tweet.tweetId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="breaking-feed-tweet-link"
                                >
                                  <span className="breaking-feed-account">@{tweet.account}</span>
                                  <span className="breaking-feed-tweet-text">{tweet.text}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                  </article>
                );
              })
            )}
            {totalPages > 1 && (
              <nav className="explorer-pagination" aria-label="Explorer pagination">
                <button
                  className="explorer-pagination-button"
                  disabled={safePage <= 1}
                  onClick={() => goToPage(1)}
                  type="button"
                  aria-label="First page"
                >
                  &laquo;
                </button>
                <button
                  className="explorer-pagination-button"
                  disabled={safePage <= 1}
                  onClick={() => goToPage(Math.max(1, safePage - 1))}
                  type="button"
                  aria-label="Previous page"
                >
                  &lsaquo;
                </button>
                {(() => {
                  const pages: number[] = [];
                  const windowSize = 2;
                  const start = Math.max(1, safePage - windowSize);
                  const end = Math.min(totalPages, safePage + windowSize);
                  if (start > 1) pages.push(1);
                  if (start > 2) pages.push(-1);
                  for (let i = start; i <= end; i++) pages.push(i);
                  if (end < totalPages - 1) pages.push(-2);
                  if (end < totalPages) pages.push(totalPages);
                  return pages.map((p) =>
                    p < 0 ? (
                      <span className="explorer-pagination-ellipsis" key={p}>
                        &hellip;
                      </span>
                    ) : (
                      <button
                        className={
                          p === safePage
                            ? "explorer-pagination-button explorer-pagination-current"
                            : "explorer-pagination-button"
                        }
                        key={p}
                        onClick={() => goToPage(p)}
                        type="button"
                        aria-current={p === safePage ? "page" : undefined}
                      >
                        {p}
                      </button>
                    ),
                  );
                })()}
                <button
                  className="explorer-pagination-button"
                  disabled={safePage >= totalPages}
                  onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                  type="button"
                  aria-label="Next page"
                >
                  &rsaquo;
                </button>
                <button
                  className="explorer-pagination-button"
                  disabled={safePage >= totalPages}
                  onClick={() => goToPage(totalPages)}
                  type="button"
                  aria-label="Last page"
                >
                  &raquo;
                </button>
              </nav>
            )}
          </div>
        </div>

        <aside className="history-panel">
          <div className="section-heading">
            <h2>Discover</h2>
          </div>

          <details className="sidebar-section" open>
            <summary>
              <div className="section-heading section-heading-spaced">
                <h2>Categories</h2>
              </div>
            </summary>
            <div className="curated-list">
              {overview.sections.metaTrends.slice(0, 6).map((trend) => (
                <Link className="curated-item" href={`/categories/${trend.category}`} key={trend.category}>
                  <span>{formatCategory(trend.category)}</span>
                  <small>{trend.trendCount} trends · avg {trend.averageScore.toFixed(1)}</small>
                </Link>
              ))}
              <Link className="curated-item" href="/meta-trends">
                <span>Browse meta trends</span>
                <small>Open the cross-category trend directory</small>
              </Link>
            </div>
          </details>

          <details className="sidebar-section">
            <summary>
              <div className="section-heading section-heading-spaced">
                <h2>Breakout</h2>
              </div>
            </summary>
            <div className="curated-list">
              {overview.sections.breakoutTrends.slice(0, 4).map((trend) => (
                <Link className="curated-item" href={`/trends/${trend.id}`} key={trend.id}>
                  <span>{trend.name}</span>
                  <strong>#{trend.rank}</strong>
                </Link>
              ))}
            </div>
          </details>

          <details className="sidebar-section">
            <summary>
              <div className="section-heading section-heading-spaced">
                <h2>Rising</h2>
              </div>
            </summary>
            <div className="curated-list">
              {overview.sections.risingTrends.slice(0, 4).map((trend) => (
                <Link className="curated-item" href={`/trends/${trend.id}`} key={trend.id}>
                  <span>{trend.name}</span>
                  <strong>{trend.scoreTotal.toFixed(1)}</strong>
                </Link>
              ))}
            </div>
          </details>

          <details className="sidebar-section">
            <summary>
              <div className="section-heading section-heading-spaced">
                <h2>Experimental</h2>
              </div>
            </summary>
            <div className="curated-list">
              {overview.sections.experimentalTrends.slice(0, 4).map((trend) => (
                <Link className="curated-item" href={`/trends/${trend.id}`} key={trend.id}>
                  <span>{trend.name}</span>
                  <strong>{trend.scoreTotal.toFixed(1)}</strong>
                </Link>
              ))}
            </div>
          </details>


        </aside>
      </section>

      <section className="analytics-strip">
        <article className="analytics-card">
          <div className="section-heading">
            <h2>Top scores</h2>
          </div>
          <div className="mini-bar-list">
            {overview.charts.topTrendScores
              .slice(0, 6)
              .map((datum) => (
                <div className="mini-bar-row" key={datum.label}>
                  <span>{datum.label}</span>
                  <div className="mini-bar-track">
                    <div
                      className="mini-bar-fill"
                      style={{
                        width: `${scaleValue(datum.value, overview.charts.topTrendScores)}%`,
                      }}
                    />
                  </div>
                  <strong>{datum.value.toFixed(1)}</strong>
                </div>
              ))}
          </div>
        </article>

        <article className="analytics-card analytics-card-pie">
          <div className="section-heading">
            <h2>Source share</h2>
          </div>
          <div className="pie-chart-wrap-full">
            <div
              className="pie-chart-large"
              style={{
                background: buildConicGradient(
                  overview.charts.sourceShare,
                ),
              }}
            />
            <div className="pie-chart-legend-grid">
              {overview.charts.sourceShare.map((datum, index) => (
                <div className="pie-legend-item" key={datum.label}>
                  <span
                    className="pie-legend-dot"
                    style={{ background: getSourceColor(index) }}
                  />
                  <span className="pie-legend-label">{datum.label}</span>
                  <span className="pie-legend-pct">
                    {formatPercent(datum.value, overview.charts.sourceShare)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="analytics-card">
          <div className="section-heading">
            <h2>Status mix</h2>
          </div>
          <div className="mini-bar-list">
            {overview.charts.statusBreakdown.map((datum) => (
              <div className="mini-bar-row" key={datum.label}>
                <span>{datum.label}</span>
                <div className="mini-bar-track">
                  <div
                    className="mini-bar-fill mini-bar-fill-muted"
                    style={{
                      width: `${scaleValue(datum.value, overview.charts.statusBreakdown)}%`,
                    }}
                  />
                </div>
                <strong>{datum.value.toFixed(0)}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
      <UpgradeModal open={upgradeModalOpen} onClose={closeUpgradeModal} feature="CSV export" />
    </main>
  );
}

// Re-exports for backwards compatibility — consumers should migrate to @/components/explorer/*
export {
  buildAudienceFilterOptions,
  buildMarketFilterOptions,
  buildLanguageFilterOptions,
  listActiveExplorerFilters,
  isThesisPresetApplied,
  shouldClearActiveThesisPreset,
};
export { trendMatchesAudience, trendMatchesMarket, trendMatchesLanguage } from "@/lib/trend-filters";
export { confidenceBucketForTrend } from "@/lib/trend-filters";
