"use client";

import { Button } from "@base-ui/react/button";
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
  buildSourceWatchlist,
  formatSourceLabel,
  getSourceFreshnessBadge,
  summarizeTopSourceDrivers,
} from "@/lib/source-health";
import {
  maskWebhookDestination,
  summarizeNotificationDelivery,
} from "@/lib/notification-ui";
import { getSeasonalityBadge, isRecurringTrend } from "@/lib/seasonality-ui";
import { summarizeShareUsage, wasOpenedRecently } from "@/lib/share-analytics";
import { describeSourceYield, summarizeSourceYield } from "@/lib/source-yield";
import { getWikipediaLinkFromDetail } from "@/lib/wikipedia";
import { downloadTrendsCsv, downloadWatchlistCsv } from "@/lib/csv-download";
import { UpgradeModal, useUpgradeGate } from "@/components/upgrade-modal";
import {
  confidenceBucketForTrend,
  trendMatchesAudience,
  trendMatchesMarket,
  trendMatchesLanguage,
} from "@/lib/trend-filters";

import type {
  AlertEvent,
  AlertEventsResponse,
  AuthStatusResponse,
  BreakingFeed,
  ExploreDeferredData,
  ExploreInitialData,
  NotificationChannel,
  NotificationChannelsResponse,
  PublicWatchlistSummary,
  PublicWatchlistsResponse,
  SourceSummaryResponse,
  TrendDetailIndexResponse,
  TrendDetailRecord,
  TrendExplorerRecord,
  TrendHistoryResponse,
  TrendThesis,
  TrendThesisMatch,
  Watchlist,
  WatchlistResponse,
} from "@/lib/types";

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

const OVERVIEW_POLL_INTERVAL_MS = 300_000; // 5 minutes
const UPDATED_TRENDS_FLASH_MS = 5_000;
const EMPTY_GENERATED_AT = new Date(0).toISOString();
const EMPTY_HISTORY: TrendHistoryResponse = {
  generatedAt: EMPTY_GENERATED_AT,
  snapshots: [],
};
const EMPTY_DETAIL_INDEX: TrendDetailIndexResponse = {
  generatedAt: EMPTY_GENERATED_AT,
  trends: [],
};
const EMPTY_SOURCE_SUMMARY: SourceSummaryResponse = {
  generatedAt: EMPTY_GENERATED_AT,
  sources: [],
  familyHistory: [],
};

const SOURCE_FILTER_OPTIONS = [
  { label: "All sources", value: "all" },
  { label: "arXiv", value: "arxiv" },
  { label: "Chrome Web Store", value: "chrome_web_store" },
  { label: "Curated Feeds", value: "curated_feeds" },
  { label: "DEV Community", value: "devto" },
  { label: "Hugging Face", value: "huggingface" },
  { label: "Lobsters", value: "lobsters" },
  { label: "npm", value: "npm" },
  { label: "Product Hunt", value: "producthunt" },
  { label: "PyPI", value: "pypi" },
  { label: "Stack Overflow", value: "stackoverflow" },
  { label: "Reddit", value: "reddit" },
  { label: "Hacker News", value: "hacker_news" },
  { label: "GitHub", value: "github" },
  { label: "Wikipedia", value: "wikipedia" },
  { label: "Google Trends", value: "google_trends" },
  { label: "Polymarket", value: "polymarket" },
  { label: "Twitter/X", value: "twitter" },
  { label: "YouTube", value: "youtube" },
] as const;

const DEFAULT_CATEGORY_OPTION = {
  label: "All categories",
  value: "all",
} as const;
const DEFAULT_AUDIENCE_OPTION = {
  label: "All audiences",
  value: "all",
} as const;
const DEFAULT_MARKET_OPTION = { label: "All markets", value: "all" } as const;
const DEFAULT_LANGUAGE_OPTION = {
  label: "All languages",
  value: "all",
} as const;
const DEFAULT_STAGE_OPTION = { label: "All stages", value: "all" } as const;
const DEFAULT_CONFIDENCE_OPTION = {
  label: "All confidence",
  value: "all",
} as const;
const DEFAULT_META_TREND_OPTION = {
  label: "All meta trends",
  value: "all",
} as const;

const STAGE_OPTIONS = [
  DEFAULT_STAGE_OPTION,
  { label: "Nascent", value: "nascent" },
  { label: "Rising", value: "rising" },
  { label: "Breakout", value: "breakout" },
  { label: "Validated", value: "validated" },
  { label: "Cooling", value: "cooling" },
  { label: "Steady", value: "steady" },
] as const;

const CONFIDENCE_OPTIONS = [
  DEFAULT_CONFIDENCE_OPTION,
  { label: "High confidence", value: "high" },
  { label: "Medium confidence", value: "medium" },
  { label: "Low confidence", value: "low" },
] as const;

const LENS_OPTIONS = [
  { label: "All lenses", value: "all" },
  { label: "Discovery", value: "discovery" },
  { label: "SEO", value: "seo" },
  { label: "Content", value: "content" },
  { label: "Product", value: "product" },
  { label: "Investment", value: "investment" },
] as const;

const SORT_OPTIONS = [
  { label: "Rank", value: "rank" },
  { label: "Strength", value: "strength" },
  { label: "Date added", value: "dateAdded" },
  { label: "Latest activity", value: "latestActivity" },
  { label: "Sources", value: "sources" },
  { label: "Momentum", value: "momentum" },
] as const;

const DEFAULT_SORT_DIRECTIONS: Record<string, "asc" | "desc"> = {
  rank: "asc",
  strength: "desc",
  dateAdded: "desc",
  latestActivity: "desc",
  sources: "desc",
  momentum: "desc",
};

const DEFAULT_STATUS_OPTION = {
  label: "All statuses",
  value: "all",
} as const;

const STATUS_OPTIONS = [
  DEFAULT_STATUS_OPTION,
  { label: "New", value: "new" },
  { label: "Breakout", value: "breakout" },
  { label: "Rising", value: "rising" },
  { label: "Cooling", value: "cooling" },
  { label: "Steady", value: "steady" },
] as const;

const WATCHLISTS_ENABLED = false;

type ThesisPreset = {
  key: string;
  label: string;
  description: string;
  lens?: string;
  source?: string;
  stage?: string;
  audience?: string;
  hideRecurring?: boolean;
  minimumScore?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  status?: string;
};

const THESIS_PRESET_ICONS: Record<string, React.ReactNode> = {
  discover: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 2.5v3M10 14.5v3M17.5 10h-3M5.5 10h-3" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  ),
  seo: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.5 12.5L17 17" />
      <path d="M6 8.5h5M8.5 6v5" />
    </svg>
  ),
  content: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 14.5V5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H6.5L3 14.5z" />
      <path d="M7 7h6M7 10h4" />
    </svg>
  ),
  product: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l6-4 6 4v6l-6 4-6-4V7z" />
      <path d="M4 7l6 4m0 0l6-4m-6 4v7" />
    </svg>
  ),
  new: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3v14M5 8l5-5 5 5" />
    </svg>
  ),
};

const THESIS_PRESETS: readonly ThesisPreset[] = [
  {
    key: "discover",
    label: "Early discovery",
    description:
      "Bias toward early, fast-moving topics before they validate everywhere.",
    lens: "discovery",
    stage: "nascent",
    hideRecurring: true,
    minimumScore: 12,
  },
  {
    key: "seo",
    label: "SEO opportunities",
    description:
      "Surface search-backed demand with enough evidence breadth to publish into.",
    lens: "seo",
    hideRecurring: true,
    minimumScore: 18,
  },
  {
    key: "content",
    label: "Social content",
    description:
      "Prioritize trends with public conversation and clear creator angles.",
    lens: "content",
    source: "reddit",
    minimumScore: 16,
  },
  {
    key: "product",
    label: "Build ideas",
    description:
      "Tilt toward builder demand, product fit, and non-recurring opportunity.",
    lens: "product",
    audience: "developer",
    hideRecurring: true,
    minimumScore: 16,
  },
  {
    key: "new",
    label: "New this run",
    description:
      "Trends appearing for the first time in the latest snapshot.",
    status: "new",
    sortBy: "dateAdded",
    sortDirection: "desc",
  },
] as const;

type ExplorerActiveFilter = {
  key:
    | "keyword"
    | "source"
    | "category"
    | "stage"
    | "confidence"
    | "lens"
    | "metaTrend"
    | "audience"
    | "market"
    | "language"
    | "geo"
    | "sort"
    | "status"
    | "seasonality";
  label: string;
  value: string;
};

type ThesisPresetFilterState = {
  keyword: string;
  selectedSource: string;
  selectedCategory: string;
  selectedStage: string;
  selectedConfidence: string;
  selectedLens: string;
  selectedMetaTrend: string;
  selectedAudience: string;
  selectedMarket: string;
  selectedLanguage: string;
  selectedGeoCountry: string;
  minimumScore: number | null;
  sortBy: string;
  sortDirection: "asc" | "desc";
  selectedStatus: string;
  hideRecurring: boolean;
};

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
  const [watchlistData, setWatchlistData] = useState<WatchlistResponse | null>(
    null,
  );
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistName, setWatchlistName] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse>({
    authEnabled: false,
    user: null,
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authPending, setAuthPending] = useState(false);
  const [shareExpiryPreset, setShareExpiryPreset] = useState<string>("none");
  const [alertThreshold, setAlertThreshold] = useState<number | null>(25);
  const [thesisName, setThesisName] = useState("");
  const [notifyOnMatch, setNotifyOnMatch] = useState(true);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [notificationNotice, setNotificationNotice] = useState<string | null>(
    null,
  );
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );
  const [notificationChannels, setNotificationChannels] = useState<
    NotificationChannel[]
  >([]);
  const [notificationDestination, setNotificationDestination] = useState("");
  const [notificationLabel, setNotificationLabel] = useState("");
  const [notificationPending, setNotificationPending] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [publicWatchlists, setPublicWatchlists] = useState<
    PublicWatchlistSummary[]
  >([]);
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
  const EXPLORER_PAGE_SIZE = 20;
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
  const alertsDetailsRef = useRef<HTMLDetailsElement>(null);
  const runsDetailsRef = useRef<HTMLDetailsElement>(null);
  const sourcesDetailsRef = useRef<HTMLDetailsElement>(null);
  const screenshotMode = searchParams.get("screenshot") === "1";
  const screenshotPanel = searchParams.get("panel");
  const screenshotTrendId = searchParams.get("trend");
  const overview = initialData.overview;
  const explorer = initialData.explorer;
  const history = deferredData?.history ?? EMPTY_HISTORY;
  const details = deferredData?.details ?? EMPTY_DETAIL_INDEX;
  const sourceSummary = deferredData?.sourceSummary ?? EMPTY_SOURCE_SUMMARY;
  const hasDeferredData = deferredDataState === "ready";
  const defaultWatchlist = watchlistData?.watchlists[0] ?? null;
  const savedTheses = watchlistData?.theses ?? [];
  const savedThesisMatches = watchlistData?.thesisMatches ?? [];
  const watchlistsRequireAuth =
    authStatus.authEnabled && authStatus.user == null;
  const shareActivityById = buildShareActivityMap(defaultWatchlist);
  const deferredKeyword = useDeferredValue(keyword);

  const shareUsageSummary = useMemo(
    () => summarizeShareUsage(defaultWatchlist?.shares ?? []),
    [defaultWatchlist?.shares],
  );
  const communitySpotlights = useMemo(
    () => buildCommunitySpotlights(publicWatchlists),
    [publicWatchlists],
  );
  const sourceWatchlist = useMemo(
    () =>
      overview.sourceWatch != null && overview.sourceWatch.length > 0
        ? overview.sourceWatch
        : buildSourceWatchlist(overview.sources),
    [overview.sourceWatch, overview.sources],
  );
  const latestPipelineRun = overview.operations.recentRuns[0] ?? null;
  const thesisMatchesById = useMemo(() => {
    const map = new Map<number, TrendThesisMatch[]>();
    for (const match of savedThesisMatches) {
      const matches = map.get(match.thesisId) ?? [];
      matches.push(match);
      map.set(match.thesisId, matches);
    }
    return map;
  }, [savedThesisMatches]);

  function showActionNotice(message: string) {
    setActionNotice(message);
    setWatchlistError(null);
    setTimeout(() => setActionNotice(null), 3000);
  }

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
    if (!WATCHLISTS_ENABLED) {
      setWatchlistLoading(false);
      return;
    }
    void loadAuthStatus();
    void loadWatchlists();
    void loadAlertEvents();
    void loadPublicWatchlists();
    void loadNotificationChannels();
  }, []);

  useEffect(() => {
    if (screenshotTrendId) {
      setExpandedTrendId(screenshotTrendId);
    }
  }, [screenshotTrendId]);

  useEffect(() => {
    if (screenshotPanel === "sources" && sourcesDetailsRef.current) {
      sourcesDetailsRef.current.open = true;
    }
    if (screenshotPanel === "runs" && runsDetailsRef.current) {
      runsDetailsRef.current.open = true;
    }
    if (screenshotPanel === "alerts" && alertsDetailsRef.current) {
      alertsDetailsRef.current.open = true;
    }
  }, [screenshotPanel, deferredDataState]);

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

  useEffect(() => {
    setShareExpiryPreset(defaultShareExpiryPreset(defaultWatchlist));
  }, [defaultWatchlist]);

  async function loadWatchlists() {
    try {
      const response = await fetch("/api/watchlists");
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          payload.error ?? `Watchlists unavailable (${response.status})`,
        );
      }
      const payload = (await response.json()) as WatchlistResponse;
      setWatchlistData(payload);
      setAuthStatus({
        authEnabled: payload.authEnabled ?? false,
        user: payload.currentUser ?? null,
      });
      setWatchlistError(null);
    } catch (error) {
      setWatchlistError(
        error instanceof Error ? error.message : "Watchlists unavailable",
      );
    } finally {
      setWatchlistLoading(false);
    }
  }

  async function loadAuthStatus() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      setAuthStatus((await response.json()) as AuthStatusResponse);
    } catch {
      // ignore auth lookup failures in local mode
    }
  }

  async function handleCreateWatchlist() {
    if (watchlistName.trim().length === 0) {
      return;
    }
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-watchlist",
          name: watchlistName.trim(),
        }),
      });
      if (response.ok) {
        setWatchlistData((await response.json()) as WatchlistResponse);
        setWatchlistName("");
        showActionNotice("Watchlist created");
        return;
      }
      setWatchlistError("Could not create watchlist");
    } finally {
      setActionPending(false);
    }
  }

  async function handleAuthSubmit() {
    if (authUsername.trim().length === 0 || authPassword.length === 0) {
      setAuthError("Username and password are required");
      return;
    }
    setAuthPending(true);
    setAuthError(null);
    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword,
          displayName: authDisplayName.trim() || authUsername.trim(),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setAuthError(
          payload.error ??
            `${authMode === "login" ? "Login" : "Registration"} failed`,
        );
        return;
      }
      const payload = (await response.json()) as AuthStatusResponse;
      setAuthStatus(payload);
      setAuthPassword("");
      setWatchlistError(null);
      await loadWatchlists();
      await loadAlertEvents();
      showActionNotice(authMode === "login" ? "Signed in" : "Account created");
    } finally {
      setAuthPending(false);
    }
  }

  async function handleLogout() {
    setAuthPending(true);
    setAuthError(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthStatus({ authEnabled: authStatus.authEnabled, user: null });
      setWatchlistData(null);
      setAlertEvents([]);
      setAlertCount(0);
      showActionNotice("Signed out");
      await loadWatchlists();
    } finally {
      setAuthPending(false);
    }
  }

  async function handleToggleTracked(trendId: string, trendName: string) {
    if (defaultWatchlist == null) {
      return;
    }
    setActionPending(true);
    setWatchlistError(null);
    try {
      const isTracked = defaultWatchlist.items.some(
        (item) => item.trendId === trendId,
      );
      const payload = isTracked
        ? { action: "remove-item", watchlistId: defaultWatchlist.id, trendId }
        : {
            action: "add-item",
            watchlistId: defaultWatchlist.id,
            trendId,
            trendName,
          };
      const response = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setWatchlistData((await response.json()) as WatchlistResponse);
        showActionNotice(
          isTracked ? "Removed from watchlist" : "Added to watchlist",
        );
        return;
      }
      setWatchlistError("Could not update watchlist");
    } finally {
      setActionPending(false);
    }
  }

  async function handleCreateAlert() {
    if (defaultWatchlist == null || alertThreshold == null) {
      return;
    }
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchlistId: defaultWatchlist.id,
          name: `Score >= ${alertThreshold}`,
          ruleType: "score_above",
          threshold: alertThreshold,
        }),
      });
      if (response.ok) {
        setWatchlistData((await response.json()) as WatchlistResponse);
        showActionNotice("Alert rule created");
        return;
      }
      setWatchlistError("Could not create alert");
    } finally {
      setActionPending(false);
    }
  }

  async function handleSaveThesis() {
    if (defaultWatchlist == null || thesisName.trim().length === 0) {
      return;
    }
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-thesis",
          watchlistId: defaultWatchlist.id,
          name: thesisName.trim(),
          lens: selectedLens,
          keywordQuery: keyword || null,
          source: selectedSource === "all" ? null : selectedSource,
          category: selectedCategory === "all" ? null : selectedCategory,
          stage: selectedStage === "all" ? null : selectedStage,
          confidence: selectedConfidence === "all" ? null : selectedConfidence,
          metaTrend: selectedMetaTrend === "all" ? null : selectedMetaTrend,
          audience: selectedAudience === "all" ? null : selectedAudience,
          market: selectedMarket === "all" ? null : selectedMarket,
          language: selectedLanguage === "all" ? null : selectedLanguage,
          geoCountry: selectedGeoCountry === "all" ? null : selectedGeoCountry,
          minimumScore: minimumScore ?? 0,
          hideRecurring,
          notifyOnMatch,
        }),
      });
      if (!response.ok) {
        setWatchlistError("Could not save thesis");
        return;
      }
      setWatchlistData((await response.json()) as WatchlistResponse);
      setThesisName("");
      showActionNotice("Thesis saved");
    } finally {
      setActionPending(false);
    }
  }

  async function handleDeleteThesis(thesisId: number) {
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-thesis", thesisId }),
      });
      if (!response.ok) {
        setWatchlistError("Could not remove thesis");
        return;
      }
      setWatchlistData((await response.json()) as WatchlistResponse);
      showActionNotice("Thesis removed");
    } finally {
      setActionPending(false);
    }
  }

  async function loadAlertEvents() {
    try {
      const response = await fetch("/api/alerts?unread_only=true");
      if (!response.ok) return;
      const data = (await response.json()) as AlertEventsResponse;
      setAlertEvents(data.alerts ?? []);
      setAlertCount(data.alerts?.length ?? 0);
    } catch {
      // silently ignore — alerts are non-critical
    }
  }

  async function loadPublicWatchlists() {
    try {
      const response = await fetch("/api/community/watchlists");
      if (!response.ok) return;
      const data = (await response.json()) as PublicWatchlistsResponse;
      setPublicWatchlists(data.watchlists ?? []);
    } catch {
      // ignore non-critical public directory failures
    }
  }

  async function loadNotificationChannels() {
    try {
      const response = await fetch("/api/notifications/channels", {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          payload.error ??
            `Notification channels unavailable (${response.status})`,
        );
      }
      const data = (await response.json()) as NotificationChannelsResponse;
      setNotificationChannels(data.channels ?? []);
      setNotificationError(null);
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Notification channels unavailable",
      );
    }
  }

  async function handleCreateNotificationChannel() {
    if (notificationDestination.trim().length === 0) {
      setNotificationError("Webhook URL is required");
      return;
    }
    setNotificationPending(true);
    setNotificationError(null);
    setNotificationNotice(null);
    try {
      const response = await fetch("/api/notifications/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: notificationDestination.trim(),
          label: notificationLabel.trim(),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setNotificationError(payload.error ?? "Could not create webhook");
        return;
      }
      setNotificationDestination("");
      setNotificationLabel("");
      setNotificationNotice("Webhook added");
      await loadNotificationChannels();
    } finally {
      setNotificationPending(false);
    }
  }

  async function handleTestNotificationChannel(channelId: number) {
    setNotificationPending(true);
    setNotificationError(null);
    setNotificationNotice(null);
    try {
      const response = await fetch(
        `/api/notifications/channels/${channelId}/test`,
        {
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        statusCode?: number;
      };
      if (!response.ok) {
        setNotificationError(
          payload.error ?? "Could not send test notification",
        );
        return;
      }
      setNotificationNotice(
        payload.statusCode != null
          ? `Test sent (${payload.statusCode})`
          : "Test sent",
      );
      await loadNotificationChannels();
    } finally {
      setNotificationPending(false);
    }
  }

  async function handleDeleteNotificationChannel(channelId: number) {
    setNotificationPending(true);
    setNotificationError(null);
    setNotificationNotice(null);
    try {
      const response = await fetch(`/api/notifications/channels/${channelId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setNotificationError(payload.error ?? "Could not delete webhook");
        return;
      }
      setNotificationNotice("Webhook removed");
      await loadNotificationChannels();
    } finally {
      setNotificationPending(false);
    }
  }

  async function handleMarkAlertsRead() {
    const unreadIds = alertEvents.filter((e) => !e.read).map((e) => e.id);
    if (unreadIds.length === 0) return;
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-read", eventIds: unreadIds }),
      });
      setAlertEvents([]);
      setAlertCount(0);
    } catch {
      // silently ignore
    }
  }

  async function handleCreateShare(
    targetWatchlist: Watchlist,
    isPublic: boolean,
  ) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(
        `/api/watchlists/${targetWatchlist.id}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public: isPublic,
            showCreator: false,
            expiresAt: resolveShareExpiryIso(shareExpiryPreset),
            useDefaultExpiry: shareExpiryPreset === "default",
          }),
        },
      );

      if (!response.ok) {
        setWatchlistError("Could not create share link");
        return;
      }

      const payload = (await response.json()) as { shareToken: string };
      const shareUrl = `${window.location.origin}/shared/${payload.shareToken}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareNotice(`${isPublic ? "Public" : "Private"} link copied`);
      } catch {
        setShareNotice(shareUrl);
      }
      await loadWatchlists();
      if (isPublic) {
        await loadPublicWatchlists();
      }
    } finally {
      setActionPending(false);
    }
  }

  async function handleSaveDefaultShareExpiry(targetWatchlist: Watchlist) {
    const defaultExpiryDays = resolveDefaultShareExpiryDays(
      shareExpiryPreset,
      targetWatchlist,
    );
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(
        `/api/watchlists/${targetWatchlist.id}/share-defaults`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultExpiryDays }),
        },
      );
      if (!response.ok) {
        setWatchlistError("Could not save default share expiry");
        return;
      }
      setWatchlistData((await response.json()) as WatchlistResponse);
      showActionNotice(
        defaultExpiryDays == null
          ? "Default share expiry cleared"
          : `Default share expiry set to ${formatShareDurationLabel(defaultExpiryDays)}`,
      );
      await loadPublicWatchlists();
    } finally {
      setActionPending(false);
    }
  }

  async function handleRevokeShare(
    targetWatchlist: Watchlist,
    shareId: number,
  ) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(
        `/api/watchlists/${targetWatchlist.id}/shares/${shareId}/revoke`,
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        setWatchlistError("Could not revoke share link");
        return;
      }
      showActionNotice("Share link revoked");
      await loadWatchlists();
      await loadPublicWatchlists();
    } finally {
      setActionPending(false);
    }
  }

  async function handleToggleShareVisibility(
    targetWatchlist: Watchlist,
    shareId: number,
    isPublic: boolean,
  ) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(
        `/api/watchlists/${targetWatchlist.id}/shares/${shareId}/visibility`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public: !isPublic }),
        },
      );
      if (!response.ok) {
        setWatchlistError("Could not update share visibility");
        return;
      }
      showActionNotice(
        !isPublic
          ? "Share is now public"
          : "Share removed from public directory",
      );
      await loadWatchlists();
      await loadPublicWatchlists();
    } finally {
      setActionPending(false);
    }
  }

  async function handleToggleShareAttribution(
    targetWatchlist: Watchlist,
    shareId: number,
    showCreator: boolean,
  ) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(
        `/api/watchlists/${targetWatchlist.id}/shares/${shareId}/attribution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showCreator: !showCreator }),
        },
      );
      if (!response.ok) {
        setWatchlistError("Could not update share attribution");
        return;
      }
      showActionNotice(
        !showCreator ? "Creator name will be shown" : "Creator name hidden",
      );
      await loadWatchlists();
      await loadPublicWatchlists();
    } finally {
      setActionPending(false);
    }
  }

  async function handleSetShareExpiry(
    targetWatchlist: Watchlist,
    shareId: number,
    preset: string,
  ) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(
        `/api/watchlists/${targetWatchlist.id}/shares/${shareId}/expiration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expiresAt: resolveShareExpiryIso(preset),
          }),
        },
      );
      if (!response.ok) {
        setWatchlistError("Could not update share expiry");
        return;
      }
      showActionNotice(
        preset === "none" ? "Share expiry removed" : "Share expiry updated",
      );
      await loadWatchlists();
      await loadPublicWatchlists();
    } finally {
      setActionPending(false);
    }
  }

  async function handleRotateShare(
    targetWatchlist: Watchlist,
    shareId: number,
  ) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(
        `/api/watchlists/${targetWatchlist.id}/shares/${shareId}/rotate`,
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        setWatchlistError("Could not rotate share link");
        return;
      }
      const payload = (await response.json()) as { shareToken: string };
      const shareUrl = `${window.location.origin}/shared/${payload.shareToken}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareNotice("Rotated link copied");
      } catch {
        setShareNotice(shareUrl);
      }
      showActionNotice("Share link rotated");
      await loadWatchlists();
      await loadPublicWatchlists();
    } finally {
      setActionPending(false);
    }
  }

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

              {!watchlistsRequireAuth && defaultWatchlist != null ? (
                <div className="filter-field filter-field-wide thesis-filter-block">
                  <span>Save current thesis</span>
                  <div className="thesis-save-panel">
                    <Input
                      className="text-input"
                      placeholder="Name this thesis"
                      value={thesisName}
                      onChange={(event) => setThesisName(event.target.value)}
                    />
                    <div className="thesis-save-actions">
                      <button
                        className={
                          notifyOnMatch
                            ? "toggle-chip toggle-chip-active"
                            : "toggle-chip"
                        }
                        onClick={() => setNotifyOnMatch((current) => !current)}
                        type="button"
                      >
                        {notifyOnMatch
                          ? "Notify on new matches"
                          : "No notifications"}
                      </button>
                      <Button
                        className="mini-action-button"
                        disabled={actionPending}
                        onClick={() => void handleSaveThesis()}
                      >
                        Save thesis
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
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

          {WATCHLISTS_ENABLED ? (
            <>
              <div className="snapshot-list">
                <section className="snapshot-card">
                  <header>
                    <strong>Identity</strong>
                    <span>
                      {authStatus.authEnabled
                        ? authStatus.user
                          ? "Signed in"
                          : "Required"
                        : "Local mode"}
                    </span>
                  </header>
                  {authStatus.authEnabled ? (
                    authStatus.user ? (
                      <>
                        <p className="source-summary-copy">
                          {authStatus.user.displayName} · @
                          {authStatus.user.username}
                        </p>
                        <Button
                          className="mini-action-button"
                          disabled={authPending}
                          onClick={() => void handleLogout()}
                        >
                          {authPending ? "Signing out..." : "Sign out"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="watchlist-form watchlist-form-stack">
                          <Input
                            className="text-input"
                            placeholder="Username"
                            value={authUsername}
                            onChange={(event) =>
                              setAuthUsername(event.target.value)
                            }
                          />
                          {authMode === "register" ? (
                            <Input
                              className="text-input"
                              placeholder="Display name"
                              value={authDisplayName}
                              onChange={(event) =>
                                setAuthDisplayName(event.target.value)
                              }
                            />
                          ) : null}
                          <Input
                            className="text-input"
                            placeholder="Password"
                            type="password"
                            value={authPassword}
                            onChange={(event) =>
                              setAuthPassword(event.target.value)
                            }
                          />
                        </div>
                        <div className="watchlist-form">
                          <Button
                            className="mini-action-button"
                            disabled={authPending}
                            onClick={() => void handleAuthSubmit()}
                          >
                            {authPending
                              ? authMode === "login"
                                ? "Signing in..."
                                : "Creating..."
                              : authMode === "login"
                                ? "Sign in"
                                : "Register"}
                          </Button>
                          <Button
                            className="mini-action-button"
                            disabled={authPending}
                            onClick={() => {
                              setAuthMode((current) =>
                                current === "login" ? "register" : "login",
                              );
                              setAuthError(null);
                            }}
                          >
                            {authMode === "login"
                              ? "Need account"
                              : "Use login"}
                          </Button>
                        </div>
                        {authError ? (
                          <p className="source-error-copy">{authError}</p>
                        ) : null}
                      </>
                    )
                  ) : (
                    <p className="empty-state-hint">
                      Authentication is disabled in local-first mode. Watchlists
                      stay machine-local.
                    </p>
                  )}
                </section>
              </div>

              <details
                className="sidebar-section"
                ref={alertsDetailsRef}
                open={alertCount > 0 ? true : undefined}
              >
                <summary>
                  <div className="section-heading section-heading-spaced">
                    <h2>
                      Alerts
                      {alertCount > 0 ? (
                        <span className="alert-badge">{alertCount}</span>
                      ) : null}
                    </h2>
                    {alertCount > 0 ? (
                      <button
                        className="mini-action-button"
                        onClick={() => void handleMarkAlertsRead()}
                        type="button"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </summary>

                <div className="snapshot-list">
                  {alertEvents.length === 0 ? (
                    <p className="empty-state-hint">
                      No unread alerts. Create alert rules above to get notified
                      when trends cross score thresholds.
                    </p>
                  ) : (
                    alertEvents.slice(0, 8).map((event) => (
                      <section
                        className="snapshot-card snapshot-card-alert"
                        key={event.id}
                      >
                        <header>
                          <strong>
                            <Link
                              className="trend-link"
                              href={`/trends/${event.trendId}`}
                            >
                              {event.trendName}
                            </Link>
                          </strong>
                          <span className="trend-status-pill trend-status-pill-breakout">
                            {formatAlertRuleType(event.ruleType)}
                          </span>
                        </header>
                        <p className="source-summary-copy">{event.message}</p>
                        <p className="source-summary-copy">
                          {formatCompactTimestamp(event.triggeredAt)}
                        </p>
                      </section>
                    ))
                  )}
                </div>
              </details>

              <details
                className="sidebar-section"
                open={savedTheses.length > 0 ? true : undefined}
              >
                <summary>
                  <div className="section-heading section-heading-spaced">
                    <h2>Saved theses</h2>
                  </div>
                </summary>

                <div className="snapshot-list">
                  {savedTheses.length === 0 ? (
                    <p className="empty-state-hint">
                      Save a thesis from the current explorer filters to track
                      matching trends over time.
                    </p>
                  ) : (
                    savedTheses.map((thesis) => {
                      const matches = thesisMatchesById.get(thesis.id) ?? [];
                      return (
                        <section className="snapshot-card" key={thesis.id}>
                          <header>
                            <strong>{thesis.name}</strong>
                            <span>{thesis.activeMatchCount} matches</span>
                          </header>
                          <p className="source-summary-copy">
                            {summarizeThesisFilters(thesis)}
                          </p>
                          {matches.length > 0 ? (
                            <div className="community-chip-group">
                              {matches.slice(0, 3).map((match) => (
                                <Link
                                  className="community-filter-chip"
                                  href={`/trends/${match.trendId}`}
                                  key={`${thesis.id}-${match.trendId}`}
                                >
                                  {match.trendName} ·{" "}
                                  {match.lensScore.toFixed(1)}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <p className="empty-state-hint">
                              No active matches in the current ranking.
                            </p>
                          )}
                          <div className="watchlist-form">
                            <small className="source-summary-copy">
                              {thesis.notifyOnMatch
                                ? "Notifications on"
                                : "Notifications off"}
                            </small>
                            <Button
                              className="mini-action-button"
                              disabled={actionPending}
                              onClick={() => void handleDeleteThesis(thesis.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </section>
                      );
                    })
                  )}
                </div>
              </details>
            </>
          ) : null}

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

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildTrendCardKey(trend: TrendExplorerRecord, index: number) {
  return `${trend.id}-${trend.rank}-${trend.latestSignalAt}-${index}`;
}

function formatCompactTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function buildShareActivityMap(watchlist: Watchlist | null) {
  const shareActivityById = new Map<number, string>();
  for (const event of watchlist?.shareEvents ?? []) {
    if (event.shareId == null || shareActivityById.has(event.shareId)) {
      continue;
    }
    shareActivityById.set(event.shareId, event.createdAt);
  }
  return shareActivityById;
}

function formatRankChange(value: number | null | undefined) {
  if (value == null) {
    return "New";
  }
  if (value > 0) {
    return `+${value}`;
  }
  if (value < 0) {
    return `${value}`;
  }
  return "0";
}

function formatMomentum(value: number | null | undefined) {
  if (value == null) {
    return "No prior run";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatMomentumHeadline(trend: TrendExplorerRecord) {
  if (trend.rankChange == null) {
    return "New signal";
  }
  const percentDelta = trend.momentum.percentDelta;
  if (percentDelta == null) {
    if (trend.rankChange === 0) {
      return "Flat";
    }
    return `${trend.rankChange > 0 ? "Up" : "Down"} ${Math.abs(trend.rankChange)}`;
  }
  return `${percentDelta > 0 ? "+" : ""}${percentDelta.toFixed(1)}%`;
}

function formatMomentumDetail(trend: TrendExplorerRecord) {
  if (trend.rankChange == null) {
    return "First appearance in the current ranking";
  }
  if (trend.rankChange === 0) {
    return "Holding the same rank as the previous run";
  }
  const direction = trend.rankChange > 0 ? "up" : "down";
  const magnitude = Math.abs(trend.rankChange);
  return `Rank ${direction} ${magnitude} place${magnitude === 1 ? "" : "s"} vs previous run`;
}

function formatScoreMix(score: TrendExplorerRecord["score"]) {
  const mix = (
    [
      ["Social", score.social],
      ["Developer", score.developer],
      ["Knowledge", score.knowledge],
      ["Search", score.search],
      ["Advertising", score.advertising ?? 0],
    ] as Array<[string, number]>
  )
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label, value]) => `${label} ${value.toFixed(1)}`);

  if (mix.length === 0) {
    return `Driven by cross-source diversity ${score.diversity.toFixed(1)}`;
  }
  return `Led by ${mix.join(" · ")}`;
}

function formatCollapsedSourceDriverSummary(
  insights: Array<{ title: string; scoreSharePercent: number }>,
) {
  if (insights.length === 0) {
    return null;
  }
  return `Source drivers: ${insights
    .map(
      (insight) => `${insight.title} ${insight.scoreSharePercent.toFixed(0)}%`,
    )
    .join(" · ")}`;
}

function formatCollapsedCorroborationSummary(
  detail: TrendDetailRecord | undefined,
  trend: TrendExplorerRecord,
) {
  if (!detail) {
    return `Corroborated by ${trend.coverage.sourceCount} source${trend.coverage.sourceCount === 1 ? "" : "s"}`;
  }

  const supportingSources = detail.sourceContributions.filter(
    (contribution) => contribution.scoreSharePercent >= 5,
  ).length;
  if (supportingSources >= 2) {
    return `Corroborated by ${supportingSources} contributing sources`;
  }
  if (detail.sourceContributions.length === 1) {
    return `Driven mainly by ${formatSourceLabel(detail.sourceContributions[0].source)}`;
  }
  return `Backed by ${trend.coverage.signalCount} signal${trend.coverage.signalCount === 1 ? "" : "s"} across ${trend.coverage.sourceCount} sources`;
}

function movementClassName(rankChange: number | null | undefined) {
  if (rankChange == null) {
    return "movement-pill movement-pill-new";
  }
  if (rankChange > 0) {
    return "movement-pill movement-pill-up";
  }
  if (rankChange < 0) {
    return "movement-pill movement-pill-down";
  }
  return "movement-pill";
}

function compareDates(left: string | null, right: string | null) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return -1;
  }
  if (right === null) {
    return 1;
  }
  return new Date(left).getTime() - new Date(right).getTime();
}

function formatSourceStatus(status: string) {
  if (status === "healthy") {
    return "Healthy";
  }
  if (status === "degraded") {
    return "Degraded";
  }
  return "Stale";
}

function formatCategory(category: string) {
  return formatCategoryLabel(category);
}

function sourceHealthClassName(status: string) {
  if (status === "healthy") {
    return "source-health-pill source-health-pill-healthy";
  }
  if (status === "degraded") {
    return "source-health-pill source-health-pill-degraded";
  }
  return "source-health-pill source-health-pill-stale";
}

function contributionHealthClassName(status: string | null) {
  if (status === "healthy") {
    return "source-health-pill source-health-pill-healthy";
  }
  if (status === "degraded") {
    return "source-health-pill source-health-pill-degraded";
  }
  if (status === "stale") {
    return "source-health-pill source-health-pill-stale";
  }
  return "source-health-pill";
}

function formatWatchSeverity(severity: "critical" | "warning" | "info") {
  if (severity === "critical") {
    return "Critical";
  }
  if (severity === "warning") {
    return "Warning";
  }
  return "Watch";
}

function formatDuration(durationMs: number) {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${durationMs}ms`;
}

function formatShareTokenLabel(shareToken: string) {
  return `${shareToken.slice(0, 8)}...`;
}

function formatShareActivityTimestamp(value: string | null) {
  if (value == null) {
    return "No changes yet";
  }
  return formatCompactTimestamp(value);
}

function formatTrendStatus(status: string) {
  if (status === "breakout") {
    return "Breakout";
  }
  if (status === "rising") {
    return "Rising";
  }
  if (status === "cooling") {
    return "Cooling";
  }
  if (status === "new") {
    return "New";
  }
  return "Steady";
}

function trendStatusClassName(status: string) {
  if (status === "breakout") {
    return "trend-status-pill trend-status-pill-breakout";
  }
  if (status === "rising") {
    return "trend-status-pill trend-status-pill-rising";
  }
  if (status === "cooling") {
    return "trend-status-pill trend-status-pill-cooling";
  }
  if (status === "new") {
    return "trend-status-pill trend-status-pill-new";
  }
  return "trend-status-pill";
}

function formatVolatility(volatility: string) {
  if (volatility === "spiking") {
    return "Spiking";
  }
  if (volatility === "volatile") {
    return "Volatile";
  }
  if (volatility === "emerging") {
    return "Emerging";
  }
  return "Stable";
}

function volatilityClassName(volatility: string) {
  if (volatility === "spiking") {
    return "volatility-pill volatility-pill-spiking";
  }
  if (volatility === "volatile") {
    return "volatility-pill volatility-pill-volatile";
  }
  if (volatility === "emerging") {
    return "volatility-pill volatility-pill-emerging";
  }
  return "volatility-pill";
}

function scaleValue(value: number, dataset: { value: number }[]) {
  const maxValue = dataset.reduce(
    (currentMax, item) => Math.max(currentMax, item.value),
    0,
  );
  if (maxValue <= 0) {
    return 0;
  }
  return Math.max((value / maxValue) * 100, 8);
}

function formatPercent(value: number, dataset: { value: number }[]) {
  const total = dataset.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return "0%";
  }
  return `${Math.round((value / total) * 100)}%`;
}

function formatAlertRuleType(ruleType: string) {
  const labels: Record<string, string> = {
    score_above: "Score",
    rank_change: "Rank",
    new_breakout: "Breakout",
    new_trend: "New",
  };
  return labels[ruleType] ?? ruleType;
}

function formatSourceContributionSummary(
  source: NonNullable<PublicWatchlistSummary["sourceContributions"]>[number],
) {
  const components: Array<[string, number]> = [
    ["Social", source.score.social],
    ["Developer", source.score.developer],
    ["Knowledge", source.score.knowledge],
    ["Search", source.score.search],
    ["Advertising", source.score.advertising ?? 0],
    ["Diversity", source.score.diversity],
  ];
  const topComponents = components
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label, value]) => `${label} ${value.toFixed(1)}`);

  if (topComponents.length === 0) {
    return `${formatSourceLabel(source.source)} drove ${source.scoreSharePercent.toFixed(1)}%`;
  }
  return `${formatSourceLabel(source.source)} drove ${source.scoreSharePercent.toFixed(1)}% · ${topComponents.join(" · ")}`;
}

function formatAudienceSummary(
  summary: NonNullable<PublicWatchlistSummary["audienceSummary"]>,
) {
  return summary
    .slice(0, 2)
    .map(
      (item) =>
        `${formatAudiencePrefix(item.segmentType)} ${formatAudienceLabel(item.label)}`,
    )
    .join(" · ");
}

function formatAudiencePrefix(segmentType: string) {
  if (segmentType === "audience") {
    return "Audience:";
  }
  if (segmentType === "market") {
    return "Market:";
  }
  return "Language:";
}

function formatAudienceLabel(label: string) {
  return label
    .split("-")
    .map((part) =>
      part.length <= 3 || /\d/.test(part)
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

export function buildCommunitySpotlights(watchlists: PublicWatchlistSummary[]) {
  const spotlights: Array<{
    title: string;
    description: string;
    href: string;
    watchlist: PublicWatchlistSummary;
  }> = [];

  const popular = watchlists.find((watchlist) => watchlist.popularThisWeek);
  if (popular) {
    spotlights.push({
      title: "Popular this week",
      description: "The most-opened public watchlist right now.",
      href: "/community?popular=true",
      watchlist: popular,
    });
  }

  const searchDriven = watchlists.find((watchlist) =>
    (watchlist.sourceContributions ?? []).some(
      (contribution) => contribution.source === "google_trends",
    ),
  );
  if (searchDriven) {
    spotlights.push({
      title: "Search-driven",
      description: "Led by search demand and Google Trends signals.",
      href: "/community?source=google_trends",
      watchlist: searchDriven,
    });
  }

  const global = watchlists.find(
    (watchlist) => (watchlist.geoSummary?.length ?? 0) >= 2,
  );
  if (global) {
    spotlights.push({
      title: "Global interest",
      description: "Showing up across multiple regions at once.",
      href: "/community",
      watchlist: global,
    });
  }

  const developerAudience = watchlists.find((watchlist) =>
    (watchlist.audienceSummary ?? []).some(
      (segment) => segment.label === "developer",
    ),
  );
  if (developerAudience) {
    spotlights.push({
      title: "Developer audience",
      description: "Strongest with developers and technical builders.",
      href: "/community?audience=developer",
      watchlist: developerAudience,
    });
  }

  const businessAudience = watchlists.find((watchlist) =>
    (watchlist.audienceSummary ?? []).some(
      (segment) => segment.label === "b2b",
    ),
  );
  if (businessAudience) {
    spotlights.push({
      title: "B2B signal",
      description: "Leaning toward enterprise and business demand.",
      href: "/community?audience=b2b",
      watchlist: businessAudience,
    });
  }

  return spotlights;
}

export function buildCommunityExportHref() {
  return "/api/export/community";
}

export function buildSharedWatchlistExportHref(shareToken: string) {
  return `/api/export/shared/${encodeURIComponent(shareToken)}`;
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

// Re-exported for backwards compatibility — canonical source is @/lib/trend-filters
export { trendMatchesAudience, trendMatchesMarket, trendMatchesLanguage };

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

// Re-exported for backwards compatibility — canonical source is @/lib/trend-filters
export { confidenceBucketForTrend };

function formatConfidenceLabel(confidence: number) {
  return `${formatConfidenceBucketLabel(confidenceBucketForTrend(confidence))} confidence`;
}

function formatConfidenceBucketLabel(confidence: string | undefined) {
  if (confidence === "high") {
    return "High";
  }
  if (confidence === "medium") {
    return "Medium";
  }
  return "Low";
}

function formatStageLabel(stage: string | undefined) {
  return (stage ?? "steady")
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}


function buildTrendAudienceBadge(
  summary: TrendDetailRecord["audienceSummary"],
) {
  const lead = summary[0];
  if (!lead) {
    return null;
  }
  if (lead.segmentType === "audience") {
    return formatAudienceLabel(lead.label);
  }
  if (lead.segmentType === "market") {
    return formatAudienceLabel(lead.label);
  }
  return `${formatAudienceLabel(lead.label)} language`;
}

function summarizeTrendAudience(summary: TrendDetailRecord["audienceSummary"]) {
  if (summary.length === 0) {
    return null;
  }
  return summary
    .slice(0, 2)
    .map(
      (item) =>
        `${formatAudiencePrefix(item.segmentType)} ${formatAudienceLabel(item.label)}`,
    )
    .join(" · ");
}

function formatLanguageLabel(code: string) {
  const labels: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    it: "Italian",
    nl: "Dutch",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
  };
  return labels[code] ?? code.toUpperCase();
}

function formatExplorerSortLabel(sortBy: string) {
  const labels: Record<string, string> = {
    rank: "Rank",
    strength: "Strength",
    dateAdded: "Date added",
    latestActivity: "Latest activity",
    sources: "Sources",
    momentum: "Momentum",
  };
  return labels[sortBy] ?? sortBy;
}

function formatStatusLabel(status: string | undefined) {
  if (!status || status === "all") return "All statuses";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getOpportunityScoreForLens(
  detail: TrendDetailRecord | undefined,
  lens: string,
) {
  if (!detail) {
    return 0;
  }
  if (lens === "discovery") {
    return detail.opportunity.discovery;
  }
  if (lens === "seo") {
    return detail.opportunity.seo;
  }
  if (lens === "content") {
    return detail.opportunity.content;
  }
  if (lens === "product") {
    return detail.opportunity.product;
  }
  if (lens === "investment") {
    return detail.opportunity.investment;
  }
  return detail.opportunity.composite;
}

function formatLensLabel(lens: string) {
  const labels: Record<string, string> = {
    all: "All lenses",
    discovery: "Discovery",
    seo: "SEO",
    content: "Content",
    product: "Product",
    investment: "Investment",
  };
  return labels[lens] ?? lens;
}

function summarizeThesisFilters(thesis: TrendThesis) {
  const filters = [
    formatLensLabel(thesis.lens),
    thesis.keywordQuery ? `keyword: ${thesis.keywordQuery}` : null,
    thesis.source ? formatSourceLabel(thesis.source) : null,
    thesis.category ? formatCategory(thesis.category) : null,
    thesis.stage ? formatStageLabel(thesis.stage) : null,
    thesis.metaTrend,
    thesis.audience ? formatAudienceLabel(thesis.audience) : null,
    thesis.market ? formatAudienceLabel(thesis.market) : null,
    thesis.language ? thesis.language.toUpperCase() : null,
    thesis.geoCountry ? thesis.geoCountry.toUpperCase() : null,
    thesis.minimumScore > 0 ? `min ${thesis.minimumScore}` : null,
    thesis.hideRecurring ? "non-recurring" : null,
  ].filter(Boolean);
  return filters.join(" · ");
}

function getOptionLabel<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string,
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function formatGeoCountryLabel(countryCode: string) {
  return formatCountryLabel(
    countryCode,
    getRegionName(countryCode) ?? countryCode,
  );
}

function buildShareExpiryIso(preset: string) {
  const now = new Date();
  const next = new Date(now);
  if (preset === "24h") {
    next.setHours(next.getHours() + 24);
  } else if (preset === "7d") {
    next.setDate(next.getDate() + 7);
  } else if (preset === "30d") {
    next.setDate(next.getDate() + 30);
  }
  return next.toISOString();
}

function defaultShareExpiryPreset(watchlist: Watchlist | null) {
  if (watchlist?.defaultShareExpiryDays != null) {
    return "default";
  }
  return "none";
}

function resolveShareExpiryIso(preset: string) {
  if (preset === "none" || preset === "default") {
    return null;
  }
  return buildShareExpiryIso(preset);
}

function resolveDefaultShareExpiryDays(preset: string, watchlist: Watchlist) {
  if (preset === "default") {
    return watchlist.defaultShareExpiryDays;
  }
  if (preset === "none") {
    return null;
  }
  return sharePresetToDays(preset);
}

function sharePresetToDays(preset: string) {
  if (preset === "24h") {
    return 1;
  }
  if (preset === "7d") {
    return 7;
  }
  if (preset === "30d") {
    return 30;
  }
  return null;
}

function formatShareDurationLabel(days: number) {
  if (days === 1) {
    return "24 hours";
  }
  return `${days} days`;
}

function formatWatchlistDefaultShareExpiry(days: number | null) {
  if (days == null) {
    return "No default expiry";
  }
  return `${formatShareDurationLabel(days)} for new links`;
}

function formatShareDefaultOptionLabel(days: number | null) {
  if (days == null) {
    return "Watchlist default (none)";
  }
  return `Watchlist default (${formatShareDurationLabel(days)})`;
}

function fillShareHistory(history: Array<{ date: string; count: number }>) {
  const byDate = new Map(history.map((point) => [point.date, point.count]));
  const points: Array<{ date: string; count: number }> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    points.push({
      date: key,
      count: byDate.get(key) ?? 0,
    });
  }
  return points;
}

function formatShareExpirySummary(value: string | null) {
  if (value == null) {
    return "No expiry";
  }
  const timestamp = new Date(value);
  if (timestamp.getTime() <= Date.now()) {
    return "Expired";
  }
  return `Expires ${formatCompactTimestamp(value)}`;
}

function isDataStale(lastRunAt: string | null): boolean {
  if (!lastRunAt) return false;
  const twoHoursMs = 2 * 60 * 60 * 1000;
  return Date.now() - new Date(lastRunAt).getTime() > twoHoursMs;
}

const SOURCE_PALETTE = [
  "#5e6bff", "#00c4ff", "#7fe0a7", "#ffca6e", "#ff8b8b",
  "#9b8cff", "#ff6eb4", "#4ecdc4", "#f7dc6f", "#a29bfe",
  "#fd79a8", "#00b894", "#e17055", "#74b9ff", "#dfe6e9",
  "#b8e994", "#f8c291", "#6c5ce7", "#81ecec", "#fab1a0",
  "#55efc4", "#636e72",
];

function getSourceColor(index: number) {
  return SOURCE_PALETTE[index % SOURCE_PALETTE.length];
}

function BreakingFeedSection({ feed }: { feed: BreakingFeed | null }) {
  const ITEMS_PER_PAGE = 4;
  const [page, setPage] = useState(0);

  if (feed == null) {
    return (
      <section className="breaking-feed-section breaking-feed-skeleton">
        <div className="breaking-feed-header">
          <div className="breaking-feed-header-left">
            <span className="breaking-feed-dot" aria-hidden="true" />
            <h2 className="breaking-feed-title">Breaking</h2>
          </div>
        </div>
        <div className="breaking-feed-items">
          {Array.from({ length: 4 }, (_, i) => (
            <article className="breaking-feed-item skeleton-pulse" key={i}>
              <div className="breaking-feed-item-header">
                <span className="skeleton-line" style={{ width: "40%" }} />
                <span className="skeleton-line" style={{ width: "15%" }} />
              </div>
              <div className="skeleton-line" style={{ width: "90%" }} />
              <div className="skeleton-line" style={{ width: "70%" }} />
            </article>
          ))}
        </div>
      </section>
    );
  }
  if (feed.items.length === 0) {
    return null;
  }
  const sorted = [...feed.items].sort((a, b) => b.breakingScore - a.breakingScore);
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const visible = sorted.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const updatedLabel = feed.updatedAt
    ? new Date(feed.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <section className="breaking-feed-section">
      <div className="breaking-feed-header">
        <div className="breaking-feed-header-left">
          <span className="breaking-feed-dot" aria-hidden="true" />
          <h2 className="breaking-feed-title">Breaking</h2>
          <span className="breaking-feed-count">{sorted.length}</span>
        </div>
        <div className="breaking-feed-header-right">
          {updatedLabel && (
            <span className="breaking-feed-updated">{updatedLabel}</span>
          )}
          {totalPages > 1 && (
            <div className="breaking-feed-pager">
              <button
                className="breaking-feed-pager-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
              >
                ‹
              </button>
              <span className="breaking-feed-pager-label">
                {page + 1}/{totalPages}
              </span>
              <button
                className="breaking-feed-pager-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="breaking-feed-items">
        {visible.map((item) => (
          <article className="breaking-feed-item" key={item.topic}>
            <div className="breaking-feed-item-header">
              <strong className="breaking-feed-topic">{item.topic}</strong>
              <span className="breaking-feed-meta">
                <span className="breaking-feed-score">{item.breakingScore.toFixed(1)}</span>
                {item.corroborated && (
                  <span className="breaking-feed-corroborated">Corroborated</span>
                )}
                {item.accountCount > 1 && (
                  <span className="breaking-feed-accounts">{item.accountCount} accounts</span>
                )}
              </span>
            </div>
            <ul className="breaking-feed-tweets">
              {item.tweets.slice(0, 3).map((tweet) => (
                <li className="breaking-feed-tweet" key={tweet.tweetId}>
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
          </article>
        ))}
      </div>
    </section>
  );
}

function buildConicGradient(dataset: { value: number }[]) {
  const total = dataset.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return "conic-gradient(#182947 0deg 360deg)";
  }

  let currentAngle = 0;
  const segments = dataset.map((item, index) => {
    const segmentAngle = (item.value / total) * 360;
    const color = getSourceColor(index);
    const segment = `${color} ${currentAngle}deg ${currentAngle + segmentAngle}deg`;
    currentAngle += segmentAngle;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}
