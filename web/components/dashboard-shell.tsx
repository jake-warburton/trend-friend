"use client";

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
import { detectChangedTrendIds, hasOverviewChanged } from "@/lib/auto-refresh";
import type { OverviewRefreshMeta } from "@/lib/auto-refresh";
import { buildExplorerGeoMapData, trendMatchesGeo } from "@/lib/explorer-geo";
import { buildSourceImpactRows } from "@/lib/source-impact";
import {
  buildSourceFamilyHistoryInsightsFromSnapshots,
  buildSourceFamilyHistoryInsights,
  buildSourceFamilyInsights,
} from "@/lib/source-health";
import { isRecurringTrend } from "@/lib/seasonality-ui";
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
  TrendDetailRecord,
} from "@/lib/types";
import type { ThesisPreset } from "@/components/explorer/types";
import {
  OVERVIEW_POLL_INTERVAL_MS,
  UPDATED_TRENDS_FLASH_MS,
  EMPTY_HISTORY,
  EMPTY_DETAIL_INDEX,
  EMPTY_SOURCE_SUMMARY,
  DEFAULT_CATEGORY_OPTION,
  DEFAULT_META_TREND_OPTION,
  DEFAULT_SORT_DIRECTIONS,
  EXPLORER_PAGE_SIZE,
} from "@/components/explorer/constants";
import { THESIS_PRESETS, THESIS_PRESET_ICONS } from "@/components/explorer/thesis-presets";
import {
  buildTrendCardKey, compareDates,
  formatCategory,
  getOpportunityScoreForLens,
} from "@/components/explorer/format";
import {
  listActiveExplorerFilters, isThesisPresetApplied, shouldClearActiveThesisPreset,
  buildAudienceFilterOptions, buildMarketFilterOptions, buildLanguageFilterOptions,
} from "@/components/explorer/filters";
import { BreakingFeedSection } from "@/components/explorer/breaking-feed-section";
import { ExplorerCard } from "@/components/explorer/explorer-card";
import { ExplorerFilters } from "@/components/explorer/explorer-filters";
import { ExplorerPagination } from "@/components/explorer/explorer-pagination";
import { ExplorerSidebar } from "@/components/explorer/explorer-sidebar";
import { AnalyticsStrip } from "@/components/explorer/analytics-strip";
import { GeoFootprint } from "@/components/explorer/geo-footprint";

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

  function clearExplorerFilter(filterKey: string) {
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

      <GeoFootprint
        geoMapData={explorerGeoMapData}
        filteredTrendCount={filteredTrends.length}
        selectedGeoCountry={selectedGeoCountry}
        onGeoCountryChange={setSelectedGeoCountry}
        isLoading={deferredDataState === "loading"}
        isReady={hasDeferredData && explorerGeoMapData.length > 0}
      />

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

            <ExplorerFilters
              keyword={keyword}
              onKeywordChange={setKeyword}
              selectedSource={selectedSource}
              onSourceChange={(v) => setSelectedSource(v ?? "all")}
              selectedCategory={selectedCategory}
              onCategoryChange={(v) => setSelectedCategory(v ?? "all")}
              selectedStage={selectedStage}
              onStageChange={(v) => setSelectedStage(v ?? "all")}
              selectedStatus={selectedStatus}
              onStatusChange={(v) => setSelectedStatus(v ?? "all")}
              selectedConfidence={selectedConfidence}
              onConfidenceChange={(v) => setSelectedConfidence(v ?? "all")}
              selectedLens={selectedLens}
              onLensChange={(v) => setSelectedLens(v ?? "all")}
              selectedMetaTrend={selectedMetaTrend}
              onMetaTrendChange={(v) => setSelectedMetaTrend(v ?? "all")}
              selectedAudience={selectedAudience}
              onAudienceChange={(v) => setSelectedAudience(v ?? "all")}
              selectedMarket={selectedMarket}
              onMarketChange={(v) => setSelectedMarket(v ?? "all")}
              selectedLanguage={selectedLanguage}
              onLanguageChange={(v) => setSelectedLanguage(v ?? "all")}
              sortBy={sortBy}
              onSortChange={(v) => handleSortChange(v ?? "rank")}
              sortDirection={sortDirection}
              onSortDirectionToggle={() => setSortDirection((d) => d === "asc" ? "desc" : "asc")}
              minimumScore={minimumScore}
              onMinimumScoreChange={setMinimumScore}
              hideRecurring={hideRecurring}
              onHideRecurringToggle={() => setHideRecurring((c) => !c)}
              categoryOptions={categoryOptions}
              metaTrendOptions={metaTrendOptions}
              audienceOptions={audienceOptions}
              marketOptions={marketOptions}
              languageOptions={languageOptions}
              activeFilters={activeExplorerFilters}
              onClearFilter={clearExplorerFilter}
              onClearAllFilters={clearAllExplorerFilters}
            />

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
              paginatedTrends.map((trend, index) => (
                <ExplorerCard
                  key={buildTrendCardKey(trend, index)}
                  trend={trend}
                  index={index}
                  detail={detailsByTrendId.get(trend.id)}
                  sources={overview.sources}
                  isUpdated={changedTrendIds.includes(trend.id)}
                />
              ))
            )}
            <ExplorerPagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          </div>
        </div>

        <ExplorerSidebar
          metaTrends={overview.sections.metaTrends}
          breakoutTrends={overview.sections.breakoutTrends}
          risingTrends={overview.sections.risingTrends}
          experimentalTrends={overview.sections.experimentalTrends}
        />
      </section>

      <AnalyticsStrip
        topTrendScores={overview.charts.topTrendScores}
        sourceShare={overview.charts.sourceShare}
        statusBreakdown={overview.charts.statusBreakdown}
      />
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
