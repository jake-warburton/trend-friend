"use client";

import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { NumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GeoMapClient } from "@/components/geo-map-client";
import { Sparkline } from "@/components/sparkline";
import { TrendTrajectoryChart } from "@/components/trend-trajectory-chart";
import { detectChangedTrendIds, hasOverviewChanged } from "@/lib/auto-refresh";
import { formatCategoryLabel } from "@/lib/category-labels";
import type { OverviewRefreshMeta } from "@/lib/auto-refresh";
import { buildExplorerGeoMapData, trendMatchesGeo } from "@/lib/explorer-geo";
import { formatForecastConfidence, getExplorerForecastBadge } from "@/lib/forecast-ui";
import { getPrimaryEvidenceLink } from "@/lib/evidence-links";
import { formatCountryLabel, getRegionName } from "@/lib/geo-map-data";
import {
  buildSourceContributionInsights,
  buildSourceWatchlist,
  formatSourceLabel,
  getSourceFreshnessBadge,
  summarizeTopSourceDrivers,
} from "@/lib/source-health";
import { maskWebhookDestination, summarizeNotificationDelivery } from "@/lib/notification-ui";
import { getSeasonalityBadge, isRecurringTrend } from "@/lib/seasonality-ui";
import { summarizeShareUsage, wasOpenedRecently } from "@/lib/share-analytics";
import { describeSourceYield, summarizeSourceYield } from "@/lib/source-yield";
import { getWikipediaLinkFromDetail } from "@/lib/wikipedia";
import { downloadTrendsCsv, downloadWatchlistCsv } from "@/lib/csv-download";

import type {
  AlertEvent,
  AlertEventsResponse,
  AuthStatusResponse,
  DashboardData,
  NotificationChannel,
  NotificationChannelsResponse,
  PublicWatchlistSummary,
  PublicWatchlistsResponse,
  TrendDetailRecord,
  Watchlist,
  WatchlistResponse,
} from "@/lib/types";

type DashboardShellProps = {
  initialData: DashboardData;
  canManualRefresh: boolean;
};

const LazyGeoMapCompact = dynamic(
  () => import("@/components/geo-map-compact").then((mod) => mod.GeoMapCompact),
  { ssr: false, loading: () => null },
);

const OVERVIEW_POLL_INTERVAL_MS = 60_000;
const UPDATED_TRENDS_FLASH_MS = 5_000;

const SOURCE_FILTER_OPTIONS = [
  { label: "All sources", value: "all" },
  { label: "Reddit", value: "reddit" },
  { label: "Hacker News", value: "hacker_news" },
  { label: "GitHub", value: "github" },
  { label: "Wikipedia", value: "wikipedia" },
  { label: "Google Trends", value: "google_trends" },
  { label: "Twitter/X", value: "twitter" },
] as const;

const DEFAULT_CATEGORY_OPTION = { label: "All categories", value: "all" } as const;
const DEFAULT_AUDIENCE_OPTION = { label: "All audiences", value: "all" } as const;
const DEFAULT_MARKET_OPTION = { label: "All markets", value: "all" } as const;
const DEFAULT_LANGUAGE_OPTION = { label: "All languages", value: "all" } as const;

const SORT_OPTIONS = [
  { label: "Rank", value: "rank" },
  { label: "Score", value: "score" },
  { label: "Biggest mover", value: "mover" },
  { label: "Newest", value: "newest" },
] as const;
const WATCHLISTS_ENABLED = false;

type ExplorerActiveFilter = {
  key: "keyword" | "source" | "category" | "audience" | "market" | "language" | "geo" | "sort" | "seasonality";
  label: string;
  value: string;
};

export function DashboardShell({ initialData, canManualRefresh }: DashboardShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAudience, setSelectedAudience] = useState<string>("all");
  const [selectedMarket, setSelectedMarket] = useState<string>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [selectedGeoCountry, setSelectedGeoCountry] = useState<string>("all");
  const [minimumScore, setMinimumScore] = useState<number | null>(0);
  const [sortBy, setSortBy] = useState<string>("rank");
  const [hideRecurring, setHideRecurring] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [watchlistData, setWatchlistData] = useState<WatchlistResponse | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistName, setWatchlistName] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse>({ authEnabled: false, user: null });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authPending, setAuthPending] = useState(false);
  const [shareExpiryPreset, setShareExpiryPreset] = useState<string>("none");
  const [alertThreshold, setAlertThreshold] = useState<number | null>(25);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([]);
  const [notificationDestination, setNotificationDestination] = useState("");
  const [notificationLabel, setNotificationLabel] = useState("");
  const [notificationPending, setNotificationPending] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [publicWatchlists, setPublicWatchlists] = useState<PublicWatchlistSummary[]>([]);
  const [overviewMeta, setOverviewMeta] = useState({
    generatedAt: initialData.overview.generatedAt,
    lastRunAt: initialData.overview.operations.lastRunAt,
  });
  const [liveUpdateState, setLiveUpdateState] = useState<"idle" | "checking" | "updating" | "updated">("idle");
  const [changedTrendIds, setChangedTrendIds] = useState<string[]>([]);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [, startAutoRefresh] = useTransition();
  const overviewMetaRef = useRef<OverviewRefreshMeta>({
    generatedAt: initialData.overview.generatedAt,
    operations: { lastRunAt: initialData.overview.operations.lastRunAt },
  });
  const explorerTrendRef = useRef(
    initialData.explorer.trends.map((trend) => ({ id: trend.id, rank: trend.rank, score: { total: trend.score.total } })),
  );
  const initialRenderRef = useRef(true);
  const updatedBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertsDetailsRef = useRef<HTMLDetailsElement>(null);
  const runsDetailsRef = useRef<HTMLDetailsElement>(null);
  const sourcesDetailsRef = useRef<HTMLDetailsElement>(null);
  const defaultWatchlist = watchlistData?.watchlists[0] ?? null;
  const watchlistsRequireAuth = authStatus.authEnabled && authStatus.user == null;
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
      (initialData.overview.sourceWatch != null && initialData.overview.sourceWatch.length > 0)
        ? initialData.overview.sourceWatch
        : buildSourceWatchlist(initialData.overview.sources),
    [initialData.overview.sourceWatch, initialData.overview.sources],
  );

  function showActionNotice(message: string) {
    setActionNotice(message);
    setWatchlistError(null);
    setTimeout(() => setActionNotice(null), 3000);
  }

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(initialData.explorer.trends.map((trend) => trend.category))).sort();
    return [
      DEFAULT_CATEGORY_OPTION,
      ...categories.map((category) => ({ label: formatCategory(category), value: category })),
    ];
  }, [initialData.explorer.trends]);

  const audienceOptions = useMemo(
    () => buildAudienceFilterOptions(initialData.details.trends),
    [initialData.details.trends],
  );
  const marketOptions = useMemo(
    () => buildMarketFilterOptions(initialData.details.trends),
    [initialData.details.trends],
  );
  const languageOptions = useMemo(
    () => buildLanguageFilterOptions(initialData.details.trends),
    [initialData.details.trends],
  );

  const detailsByTrendId = useMemo(() => {
    const map = new Map<string, TrendDetailRecord>();
    for (const detail of initialData.details.trends) {
      map.set(detail.id, detail);
    }
    return map;
  }, [initialData.details.trends]);

  const activeExplorerFilters = useMemo(
    () =>
      listActiveExplorerFilters({
        keyword,
        selectedSource,
        selectedCategory,
        selectedAudience,
        selectedMarket,
        selectedLanguage,
        selectedGeoCountry,
        sortBy,
        hideRecurring,
      }),
    [hideRecurring, keyword, selectedAudience, selectedCategory, selectedGeoCountry, selectedLanguage, selectedMarket, selectedSource, sortBy],
  );
  const selectedSourceLabel = getOptionLabel(SOURCE_FILTER_OPTIONS, selectedSource, "All sources");
  const selectedCategoryLabel = getOptionLabel(categoryOptions, selectedCategory, "All categories");
  const selectedAudienceLabel = getOptionLabel(audienceOptions, selectedAudience, "All audiences");
  const selectedMarketLabel = getOptionLabel(marketOptions, selectedMarket, "All markets");
  const selectedLanguageLabel = getOptionLabel(languageOptions, selectedLanguage, "All languages");
  const selectedSortLabel = getOptionLabel(SORT_OPTIONS, sortBy, "Rank");

  const baseFilteredTrends = useMemo(() => {
    const normalizedKeyword = deferredKeyword.trim().toLowerCase();
    const minimum = minimumScore ?? 0;
    const trends = initialData.explorer.trends.filter((trend) => {
      const detail = detailsByTrendId.get(trend.id);
      const matchesSource =
        selectedSource === "all" || trend.sources.includes(selectedSource);
      const matchesCategory =
        selectedCategory === "all" || trend.category === selectedCategory;
      const matchesAudience = trendMatchesAudience(detail, selectedAudience);
      const matchesMarket = trendMatchesMarket(detail, selectedMarket);
      const matchesLanguage = trendMatchesLanguage(detail, selectedLanguage);
      const matchesGeo = trendMatchesGeo(detail, selectedGeoCountry);
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        trend.name.toLowerCase().includes(normalizedKeyword) ||
        trend.evidencePreview.some((item) => item.toLowerCase().includes(normalizedKeyword));
      const matchesScore = trend.score.total >= minimum;
      const matchesSeasonality = !hideRecurring || !isRecurringTrend(trend.seasonality);
      return (
        matchesSource &&
        matchesCategory &&
        matchesAudience &&
        matchesMarket &&
        matchesLanguage &&
        matchesGeo &&
        matchesKeyword &&
        matchesScore &&
        matchesSeasonality
      );
    });

    return [...trends].sort((left, right) => {
      if (sortBy === "score") {
        return right.score.total - left.score.total || left.rank - right.rank;
      }
      if (sortBy === "mover") {
        return (right.rankChange ?? Number.NEGATIVE_INFINITY) - (left.rankChange ?? Number.NEGATIVE_INFINITY) || left.rank - right.rank;
      }
      if (sortBy === "newest") {
        return compareDates(right.firstSeenAt, left.firstSeenAt) || left.rank - right.rank;
      }
      return left.rank - right.rank;
    });
  }, [deferredKeyword, detailsByTrendId, hideRecurring, initialData.explorer.trends, minimumScore, selectedAudience, selectedCategory, selectedGeoCountry, selectedLanguage, selectedMarket, selectedSource, sortBy]);

  const explorerGeoMapData = useMemo(
    () => buildExplorerGeoMapData(baseFilteredTrends, detailsByTrendId),
    [baseFilteredTrends, detailsByTrendId],
  );

  const filteredTrends = baseFilteredTrends;

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedAudience !== "all") params.set("audience", selectedAudience);
    if (selectedMarket !== "all") params.set("market", selectedMarket);
    if (selectedLanguage !== "all") params.set("language", selectedLanguage);
    if (selectedGeoCountry !== "all") params.set("geo", selectedGeoCountry);
    if (keyword) params.set("q", keyword);
    if (minimumScore && minimumScore > 0) params.set("min", String(minimumScore));
    if (hideRecurring) params.set("hideRecurring", "1");
    params.set("sort", sortBy);
    return `/api/export?${params.toString()}`;
  }, [selectedSource, selectedCategory, selectedAudience, selectedMarket, selectedLanguage, selectedGeoCountry, keyword, minimumScore, hideRecurring, sortBy]);

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
      return;
    }
    setHideRecurring(false);
  }

  function clearAllExplorerFilters() {
    setKeyword("");
    setSelectedSource("all");
    setSelectedCategory("all");
    setSelectedAudience("all");
    setSelectedMarket("all");
    setSelectedLanguage("all");
    setSelectedGeoCountry("all");
    setSortBy("rank");
    setMinimumScore(0);
    setHideRecurring(false);
  }

  function handleRefresh() {
    setRefreshError(null);
    startTransition(async () => {
      const response = await fetch("/api/refresh", { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setRefreshError(payload.error ?? "Refresh failed");
        return;
      }
      router.refresh();
    });
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
    if (expandedTrendId != null && !filteredTrends.some((t) => t.id === expandedTrendId)) {
      setExpandedTrendId(null);
    }
  }, [filteredTrends, expandedTrendId]);

  useEffect(() => {
    const nextOverviewMeta = {
      generatedAt: initialData.overview.generatedAt,
      operations: { lastRunAt: initialData.overview.operations.lastRunAt },
    };
    const nextExplorerTrends = initialData.explorer.trends.map((trend) => ({
      id: trend.id,
      rank: trend.rank,
      score: { total: trend.score.total },
    }));

    const overviewChanged = hasOverviewChanged(overviewMetaRef.current, nextOverviewMeta);
    const changedIds = detectChangedTrendIds(explorerTrendRef.current, nextExplorerTrends);

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
  }, [initialData.overview, initialData.explorer.trends]);

  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      setLiveUpdateState((current) => (current === "updating" ? current : "checking"));
      try {
        const response = await fetch("/api/dashboard/overview", { cache: "no-store" });
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
  }, [router, startAutoRefresh]);

  useEffect(() => {
    setShareExpiryPreset(defaultShareExpiryPreset(defaultWatchlist));
  }, [defaultWatchlist]);

  async function loadWatchlists() {
    try {
      const response = await fetch("/api/watchlists");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? `Watchlists unavailable (${response.status})`);
      }
      const payload = (await response.json()) as WatchlistResponse;
      setWatchlistData(payload);
      setAuthStatus({
        authEnabled: payload.authEnabled ?? false,
        user: payload.currentUser ?? null,
      });
      setWatchlistError(null);
    } catch (error) {
      setWatchlistError(error instanceof Error ? error.message : "Watchlists unavailable");
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
        body: JSON.stringify({ action: "create-watchlist", name: watchlistName.trim() }),
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
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setAuthError(payload.error ?? `${authMode === "login" ? "Login" : "Registration"} failed`);
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
      const isTracked = defaultWatchlist.items.some((item) => item.trendId === trendId);
      const payload = isTracked
        ? { action: "remove-item", watchlistId: defaultWatchlist.id, trendId }
        : { action: "add-item", watchlistId: defaultWatchlist.id, trendId, trendName };
      const response = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setWatchlistData((await response.json()) as WatchlistResponse);
        showActionNotice(isTracked ? "Removed from watchlist" : "Added to watchlist");
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
      const response = await fetch("/api/notifications/channels", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? `Notification channels unavailable (${response.status})`);
      }
      const data = (await response.json()) as NotificationChannelsResponse;
      setNotificationChannels(data.channels ?? []);
      setNotificationError(null);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Notification channels unavailable");
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
        const payload = await response.json().catch(() => ({})) as { error?: string };
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
      const response = await fetch(`/api/notifications/channels/${channelId}/test`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; statusCode?: number };
      if (!response.ok) {
        setNotificationError(payload.error ?? "Could not send test notification");
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
      const payload = await response.json().catch(() => ({})) as { error?: string };
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

  async function handleCreateShare(targetWatchlist: Watchlist, isPublic: boolean) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(`/api/watchlists/${targetWatchlist.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public: isPublic,
          showCreator: false,
          expiresAt: resolveShareExpiryIso(shareExpiryPreset),
          useDefaultExpiry: shareExpiryPreset === "default",
        }),
      });

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
    const defaultExpiryDays = resolveDefaultShareExpiryDays(shareExpiryPreset, targetWatchlist);
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(`/api/watchlists/${targetWatchlist.id}/share-defaults`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultExpiryDays }),
      });
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

  async function handleRevokeShare(targetWatchlist: Watchlist, shareId: number) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(`/api/watchlists/${targetWatchlist.id}/shares/${shareId}/revoke`, {
        method: "POST",
      });
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

  async function handleToggleShareVisibility(targetWatchlist: Watchlist, shareId: number, isPublic: boolean) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(`/api/watchlists/${targetWatchlist.id}/shares/${shareId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: !isPublic }),
      });
      if (!response.ok) {
        setWatchlistError("Could not update share visibility");
        return;
      }
      showActionNotice(!isPublic ? "Share is now public" : "Share removed from public directory");
      await loadWatchlists();
      await loadPublicWatchlists();
    } finally {
      setActionPending(false);
    }
  }

  async function handleToggleShareAttribution(targetWatchlist: Watchlist, shareId: number, showCreator: boolean) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(`/api/watchlists/${targetWatchlist.id}/shares/${shareId}/attribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showCreator: !showCreator }),
      });
      if (!response.ok) {
        setWatchlistError("Could not update share attribution");
        return;
      }
      showActionNotice(!showCreator ? "Creator name will be shown" : "Creator name hidden");
      await loadWatchlists();
      await loadPublicWatchlists();
    } finally {
      setActionPending(false);
    }
  }

  async function handleSetShareExpiry(targetWatchlist: Watchlist, shareId: number, preset: string) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(`/api/watchlists/${targetWatchlist.id}/shares/${shareId}/expiration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresAt: resolveShareExpiryIso(preset),
        }),
      });
      if (!response.ok) {
        setWatchlistError("Could not update share expiry");
        return;
      }
      showActionNotice(preset === "none" ? "Share expiry removed" : "Share expiry updated");
      await loadWatchlists();
      await loadPublicWatchlists();
    } finally {
      setActionPending(false);
    }
  }

  async function handleRotateShare(targetWatchlist: Watchlist, shareId: number) {
    setShareNotice(null);
    setActionPending(true);
    setWatchlistError(null);
    try {
      const response = await fetch(`/api/watchlists/${targetWatchlist.id}/shares/${shareId}/rotate`, {
        method: "POST",
      });
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
    <main className="dashboard-page">
      <section className="hero-panel">
        <div className="hero-rail">
          <article className="hero-summary-card">
            <span>Top</span>
            <strong>{initialData.overview.highlights.topTrendName ?? "No data"}</strong>
          </article>
          <article className="hero-summary-card">
            <span>Newest</span>
            <strong>{initialData.overview.highlights.newestTrendName ?? "No data"}</strong>
          </article>
          <article className="hero-summary-card">
            <span>Last run</span>
            <strong>
              {overviewMeta.lastRunAt
                ? formatCompactTimestamp(overviewMeta.lastRunAt)
                : "No data"}
            </strong>
            {isDataStale(overviewMeta.lastRunAt) && (
              <span className="stale-warning">Data may be stale</span>
            )}
            {liveUpdateState === "checking" ? <span className="live-update-note">Checking for updates…</span> : null}
            {liveUpdateState === "updating" ? <span className="live-update-note pulse-text">Applying live update…</span> : null}
            {liveUpdateState === "updated" ? (
              <span className="live-update-note live-update-note-success">
                {changedTrendIds.length > 0 ? `${changedTrendIds.length} trends updated` : "Updated just now"}
              </span>
            ) : null}
          </article>
          <div className="stat-card">
            <span>Tracked</span>
            <strong>{initialData.overview.summary.trackedTrends}</strong>
          </div>
          <div className="stat-card">
            <span>Signals</span>
            <strong>{initialData.overview.summary.totalSignals}</strong>
          </div>
          <div className="stat-card">
            <span>Health</span>
            <strong>{initialData.overview.operations.successRate.toFixed(1)}%</strong>
          </div>
          <div className="stat-card">
            <span>Avg score</span>
            <strong>{initialData.overview.summary.averageScore.toFixed(1)}</strong>
          </div>
          {canManualRefresh ? (
            <Button className="refresh-button" disabled={isPending} onClick={handleRefresh} aria-label={isPending ? "Refreshing" : "Refresh data"}>
              <svg className={isPending ? "refresh-icon refresh-icon-spin" : "refresh-icon"} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </Button>
          ) : null}
        </div>
      </section>

      {refreshError ? <p className="error-banner" role="alert">{refreshError}</p> : null}

      <section className="analytics-strip">
        <article className="analytics-card">
          <div className="section-heading">
            <h2>Top scores</h2>
          </div>
          <div className="mini-bar-list">
            {initialData.overview.charts.topTrendScores.slice(0, 6).map((datum) => (
              <div className="mini-bar-row" key={datum.label}>
                <span>{datum.label}</span>
                <div className="mini-bar-track">
                  <div
                    className="mini-bar-fill"
                    style={{ width: `${scaleValue(datum.value, initialData.overview.charts.topTrendScores)}%` }}
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
          <div className="pie-chart-wrap">
            <div
              className="pie-chart"
              style={{ background: buildConicGradient(initialData.overview.charts.sourceShare) }}
            />
            <div className="pie-chart-legend">
              {initialData.overview.charts.sourceShare.slice(0, 5).map((datum) => (
                <div className="pie-legend-row" key={datum.label}>
                  <span>{datum.label}</span>
                  <strong>{formatPercent(datum.value, initialData.overview.charts.sourceShare)}</strong>
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
            {initialData.overview.charts.statusBreakdown.map((datum) => (
              <div className="mini-bar-row" key={datum.label}>
                <span>{datum.label}</span>
                <div className="mini-bar-track">
                  <div
                    className="mini-bar-fill mini-bar-fill-muted"
                    style={{ width: `${scaleValue(datum.value, initialData.overview.charts.statusBreakdown)}%` }}
                  />
                </div>
                <strong>{datum.value.toFixed(0)}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="trajectory-strip">
        <article className="analytics-card">
          <div className="section-heading">
            <h2>Top trends over time</h2>
          </div>
          <TrendTrajectoryChart history={initialData.history} trends={initialData.details.trends} />
        </article>
      </section>

      <section className="curated-strip">
        <article className="analytics-card">
          <div className="section-heading">
            <h2>Meta trends</h2>
          </div>
          <div className="curated-list">
            {initialData.overview.sections.metaTrends.slice(0, 6).map((trend) => (
              <button
                className="curated-item curated-item-button"
                key={trend.category}
                onClick={() => setSelectedCategory(trend.category)}
                type="button"
              >
                <span>{formatCategory(trend.category)}</span>
                <small>{trend.trendCount} trends · avg {trend.averageScore.toFixed(1)}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="analytics-card">
          <div className="section-heading">
            <h2>Breakout</h2>
          </div>
          <div className="curated-list">
            {initialData.overview.sections.breakoutTrends.slice(0, 4).map((trend) => (
              <Link className="curated-item" href={`/trends/${trend.id}`} key={trend.id}>
                <span>{trend.name}</span>
                <strong>#{trend.rank}</strong>
              </Link>
            ))}
          </div>
        </article>

        <article className="analytics-card">
          <div className="section-heading">
            <h2>Rising</h2>
          </div>
          <div className="curated-list">
            {initialData.overview.sections.risingTrends.slice(0, 4).map((trend) => (
              <Link className="curated-item" href={`/trends/${trend.id}`} key={trend.id}>
                <span>{trend.name}</span>
                <strong>{trend.scoreTotal.toFixed(1)}</strong>
              </Link>
            ))}
          </div>
        </article>

      </section>

      {explorerGeoMapData.length > 0 ? (
        <section className="explorer-geo-strip">
          <div className="explorer-geo-panel">
            <div className="explorer-geo-panel-head">
              <div>
                <strong>Geographic footprint</strong>
                <p className="source-summary-copy">
                  {explorerGeoMapData.length} countr{explorerGeoMapData.length === 1 ? "y" : "ies"} across{" "}
                  {filteredTrends.length} visible trend{filteredTrends.length === 1 ? "" : "s"}
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
                <span className="section-heading-meta">Click a country to filter</span>
              )}
            </div>
            <GeoMapClient
              height={320}
              mapData={explorerGeoMapData}
              onCountrySelect={(countryCode) =>
                setSelectedGeoCountry((current) => (current === countryCode ? "all" : countryCode))
              }
              selectedCountryCode={selectedGeoCountry !== "all" ? selectedGeoCountry : null}
            />
          </div>
        </section>
      ) : null}

      <section className="content-grid">
        <div className="ranking-panel">
          <div className="section-heading">
            <h2>Explorer</h2>
            <div className="section-heading-actions">
              <a className="mini-action-button export-button" href={exportHref} download>
                Export CSV
              </a>
              <span className="section-heading-meta">{filteredTrends.length} live</span>
            </div>
          </div>

          {filteredTrends.length === 0 ? (
            <div className="empty-state">
              <h3>No trends match these filters.</h3>
              <p>Lower the minimum score or broaden the keyword and source filters.</p>
            </div>
          ) : (
            <div className={isPending ? "explorer-list explorer-list-pending" : "explorer-list"} aria-busy={isPending}>
              <section className="filters-panel filters-panel-wide">
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
                  <Select.Root value={selectedSource} onValueChange={(value) => setSelectedSource(value ?? "all")}>
                    <Select.Trigger className="select-trigger">
                      <span>{selectedSourceLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner className="select-positioner" sideOffset={8}>
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {SOURCE_FILTER_OPTIONS.map((option) => (
                              <Select.Item className="select-item" key={option.value} value={option.value}>
                                <Select.ItemText>{option.label}</Select.ItemText>
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
                  <Select.Root value={selectedCategory} onValueChange={(value) => setSelectedCategory(value ?? "all")}>
                    <Select.Trigger className="select-trigger">
                      <span>{selectedCategoryLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner className="select-positioner" sideOffset={8}>
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {categoryOptions.map((option) => (
                              <Select.Item className="select-item" key={option.value} value={option.value}>
                                <Select.ItemText>{option.label}</Select.ItemText>
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
                  <Select.Root value={selectedAudience} onValueChange={(value) => setSelectedAudience(value ?? "all")}>
                    <Select.Trigger className="select-trigger">
                      <span>{selectedAudienceLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner className="select-positioner" sideOffset={8}>
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {audienceOptions.map((option) => (
                              <Select.Item className="select-item" key={option.value} value={option.value}>
                                <Select.ItemText>{option.label}</Select.ItemText>
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
                  <Select.Root value={selectedMarket} onValueChange={(value) => setSelectedMarket(value ?? "all")}>
                    <Select.Trigger className="select-trigger">
                      <span>{selectedMarketLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner className="select-positioner" sideOffset={8}>
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {marketOptions.map((option) => (
                              <Select.Item className="select-item" key={option.value} value={option.value}>
                                <Select.ItemText>{option.label}</Select.ItemText>
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
                  <Select.Root value={selectedLanguage} onValueChange={(value) => setSelectedLanguage(value ?? "all")}>
                    <Select.Trigger className="select-trigger">
                      <span>{selectedLanguageLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner className="select-positioner" sideOffset={8}>
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {languageOptions.map((option) => (
                              <Select.Item className="select-item" key={option.value} value={option.value}>
                                <Select.ItemText>{option.label}</Select.ItemText>
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
                  <Select.Root value={sortBy} onValueChange={(value) => setSortBy(value ?? "rank")}>
                    <Select.Trigger className="select-trigger">
                      <span>{selectedSortLabel}</span>
                      <Select.Icon className="select-icon">▼</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner className="select-positioner" sideOffset={8}>
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            {SORT_OPTIONS.map((option) => (
                              <Select.Item className="select-item" key={option.value} value={option.value}>
                                <Select.ItemText>{option.label}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
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
                      <NumberField.Decrement className="number-button">-</NumberField.Decrement>
                      <NumberField.Input className="number-input" />
                      <NumberField.Increment className="number-button">+</NumberField.Increment>
                    </NumberField.Group>
                  </NumberField.Root>
                </label>

                <label className="filter-field filter-checkbox-field">
                  <span>Seasonality</span>
                  <button
                    className={hideRecurring ? "toggle-chip toggle-chip-active" : "toggle-chip"}
                    onClick={() => setHideRecurring((current) => !current)}
                    type="button"
                  >
                    {hideRecurring ? "Hiding recurring" : "Hide recurring"}
                  </button>
                </label>
              </section>

              {activeExplorerFilters.length > 0 ? (
                <section className="explorer-active-filters" aria-label="Active explorer filters">
                  <div className="community-chip-group">
                    {activeExplorerFilters.map((filter) => (
                      <button
                        className="community-filter-chip"
                        key={filter.key}
                        onClick={() => clearExplorerFilter(filter.key)}
                        type="button"
                      >
                        {filter.label}: {filter.value} <span aria-hidden="true">x</span>
                      </button>
                    ))}
                  </div>
                  <button className="source-summary-copy detail-button-link" onClick={clearAllExplorerFilters} type="button">
                    Clear all
                  </button>
                </section>
              ) : null}

              <div className="explorer-legend" aria-hidden="true">
                <span>Trend</span>
                <span>Metrics</span>
              </div>
              {filteredTrends.map((trend) => {
                const forecastBadge = getExplorerForecastBadge(trend.forecastDirection);
                const seasonalityBadge = getSeasonalityBadge(trend.seasonality);
                const detail = detailsByTrendId.get(trend.id);
                const primaryEvidenceLink = getPrimaryEvidenceLink(detail);
                const wikipediaLink = getWikipediaLinkFromDetail(detail);
                const audienceBadge = buildTrendAudienceBadge(detail?.audienceSummary ?? []);
                const audienceSummary = summarizeTrendAudience(detail?.audienceSummary ?? []);
                const evidenceMeta = [
                  primaryEvidenceLink ? `Source: ${formatSourceLabel(primaryEvidenceLink.source)}` : null,
                  audienceSummary,
                ]
                  .filter((item): item is string => Boolean(item))
                  .join(" · ");
                const compactSummaryParts = [
                  formatTrendStatus(trend.status),
                  formatVolatility(trend.volatility),
                  forecastBadge?.label ?? null,
                  seasonalityBadge?.label ?? null,
                  audienceBadge ?? null,
                  formatCategory(trend.category),
                ].filter((item): item is string => Boolean(item));
                return (
                <article
                  className={changedTrendIds.includes(trend.id) ? "explorer-card explorer-card-updated" : "explorer-card"}
                  data-status={trend.status}
                  key={trend.id}
                >
                  <div className="explorer-card-top">
                    <div className="trend-cell explorer-card-head">
                      <div className="explorer-card-kicker">
                        <span className="explorer-rank-chip">#{trend.rank}</span>
                        <span className={movementClassName(trend.rankChange)}>
                          {formatRankChange(trend.rankChange)} rank
                        </span>
                        <span className="trend-date-chip">
                          {trend.firstSeenAt ? `Since ${formatDateOnly(trend.firstSeenAt)}` : "This run"}
                        </span>
                      </div>
                      <div className="trend-title-row">
                        <strong>
                          <Link className="trend-link" href={`/trends/${trend.id}`}>
                            {trend.name}
                          </Link>
                        </strong>
                        <span className="trend-date-chip">Sources: {trend.sources.length}</span>
                      </div>
                      <div className="explorer-badge-row">
                        <span className="trend-summary-chip">{compactSummaryParts.join(" / ")}</span>
                      </div>
                    </div>

                    <div className="explorer-metrics-row">
                      <div className="explorer-metrics-panel">
                        <div className="explorer-metric explorer-metric-panel-item explorer-metric-compact">
                          <span>Momentum</span>
                          <div className="movement-inline">
                            <strong className={movementClassName(trend.rankChange)}>
                              {formatRankChange(trend.rankChange)}
                            </strong>
                            <small>{formatMomentum(trend.momentum.percentDelta)}</small>
                          </div>
                        </div>

                        <div className="explorer-metric explorer-metric-panel-item explorer-metric-score">
                          <span>Total score</span>
                          <div className="score-inline">
                            <strong>{trend.score.total.toFixed(1)}</strong>
                            <small>
                              S {trend.score.social.toFixed(1)} / D {trend.score.developer.toFixed(1)} / K{" "}
                              {trend.score.knowledge.toFixed(1)}
                            </small>
                          </div>
                        </div>

                        <div className="explorer-metric explorer-metric-panel-item explorer-metric-compact">
                          <span>Signals</span>
                          <strong>{trend.coverage.signalCount}</strong>
                        </div>
                      </div>

                      <button
                        className={
                          expandedTrendId === trend.id
                            ? "explorer-expand-toggle explorer-expand-toggle-open"
                            : "explorer-expand-toggle"
                        }
                        onClick={() => handleToggleExpand(trend.id)}
                        aria-expanded={expandedTrendId === trend.id}
                        aria-label={expandedTrendId === trend.id ? "Collapse detail" : "Expand detail"}
                        type="button"
                      >
                        {expandedTrendId === trend.id ? "\u2212" : "+"}
                      </button>
                    </div>
                  </div>

                  <div className="explorer-card-bottom">
                    <div className="evidence-preview evidence-preview-inline">
                      <div className="evidence-main-row">
                        <span className="explorer-evidence-label">Signal brief</span>
                        {primaryEvidenceLink?.evidenceUrl ? (
                          <a
                            className="trend-link"
                            href={primaryEvidenceLink.evidenceUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {primaryEvidenceLink.evidence}
                          </a>
                        ) : (
                          <span>{trend.evidencePreview[0] ?? "No evidence available."}</span>
                        )}
                      </div>
                      {(evidenceMeta || wikipediaLink) ? (
                        <div className="evidence-meta-row">
                          {evidenceMeta ? <span className="source-summary-copy">{evidenceMeta}</span> : null}
                          {wikipediaLink ? (
                            <a
                              className="trend-link source-summary-copy"
                              href={wikipediaLink.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Wikipedia: {wikipediaLink.title}
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className={
                      expandedTrendId === trend.id
                        ? "explorer-expand-wrap explorer-expand-wrap-open"
                        : "explorer-expand-wrap"
                    }
                  >
                    <div className="explorer-expand-panel">
                      {expandedTrendId === trend.id && (() => {
                        if (!detail) return null;
                        const maxScore = Math.max(
                          detail.score.social,
                          detail.score.developer,
                          detail.score.knowledge,
                          detail.score.search,
                          detail.score.diversity,
                          1,
                        );
                        const topContribs = buildSourceContributionInsights(
                          detail.sourceContributions,
                          initialData.overview.sources,
                        ).slice(0, 5);
                        const maxContrib = Math.max(...topContribs.map((c) => c.scoreSharePercent), 1);
                        const firstRelated = detail.relatedTrends[0] ?? null;
                        return (
                          <>
                            <div className="explorer-expand-grid">
                              <div className="explorer-expand-section">
                                <strong>Score mix</strong>
                                <div className="mini-bar-list">
                                  {(
                                    [
                                      ["Social", detail.score.social],
                                      ["Developer", detail.score.developer],
                                      ["Knowledge", detail.score.knowledge],
                                      ["Search", detail.score.search],
                                      ["Diversity", detail.score.diversity],
                                    ] as const
                                  ).map(([label, value]) => (
                                    <div className="mini-bar-row" key={label}>
                                      <span>{label}</span>
                                      <div className="mini-bar-track">
                                        <div
                                          className="mini-bar-fill"
                                          style={{ width: `${(value / maxScore) * 100}%` }}
                                        />
                                      </div>
                                      <strong>{value.toFixed(1)}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="explorer-expand-section">
                                <strong>Why this ranks here</strong>
                                <p className="explorer-expand-reason">
                                  {summarizeTopSourceDrivers(detail.sourceContributions)}
                                </p>
                                <div className="source-row explorer-expand-source-row">
                                  {trend.sources.map((source) => (
                                    <span className="source-badge" key={source}>
                                      {formatSourceLabel(source)}
                                    </span>
                                  ))}
                                </div>
                                <div className="mini-bar-list">
                                  {topContribs.map((contrib) => (
                                    <div className="source-contribution-item" key={contrib.source}>
                                      <div className="mini-bar-row">
                                        <span>{contrib.title}</span>
                                        <div className="mini-bar-track">
                                          <div
                                            className="mini-bar-fill mini-bar-fill-muted"
                                            style={{ width: `${(contrib.scoreSharePercent / maxContrib) * 100}%` }}
                                          />
                                        </div>
                                        <strong>{contrib.scoreSharePercent.toFixed(1)}%</strong>
                                      </div>
                                      <div className="source-contribution-meta">
                                        <span>{contrib.signalCount} signals</span>
                                        <span>{contrib.mixSummary}</span>
                                      </div>
                                      <div className="source-contribution-meta">
                                        <span className={contributionHealthClassName(contrib.status)}>
                                          {contrib.statusLabel}
                                        </span>
                                        {(() => {
                                          const freshness = getSourceFreshnessBadge(contrib.fetchedAt);
                                          return freshness ? (
                                            <span className={`source-freshness-badge source-freshness-badge-${freshness.tone}`}>
                                              {freshness.label}
                                            </span>
                                          ) : null;
                                        })()}
                                        <span>{contrib.fetchSummary}</span>
                                        {contrib.fetchedAt ? <span>{formatCompactTimestamp(contrib.fetchedAt)}</span> : null}
                                      </div>
                                      {contrib.warning ? (
                                        <p className="source-warning-copy source-contribution-warning">{contrib.warning}</p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="explorer-expand-section">
                                <strong>Outlook</strong>
                                <div className="explorer-expand-outlook">
                                  <div>
                                    <small>Breakout</small>
                                    <strong>{detail.breakoutPrediction.predictedDirection}</strong>
                                    <small>{(detail.breakoutPrediction.confidence * 100).toFixed(0)}% confidence</small>
                                  </div>
                                  <div>
                                    <small>Opportunity</small>
                                    <strong>{detail.opportunity.composite.toFixed(1)}</strong>
                                  </div>
                                  {detail.forecast && detail.forecast.predictedScores.length > 0 && (
                                    <div>
                                      <small>Forecast</small>
                                      <strong>
                                        {detail.forecast.predictedScores[detail.forecast.predictedScores.length - 1] >=
                                        trend.score.total
                                          ? "\u2191 Up"
                                          : "\u2193 Down"}
                                      </strong>
                                      <small>{formatForecastConfidence(detail.forecast.confidence)} confidence</small>
                                    </div>
                                  )}
                                </div>
                                {detail.opportunity.reasoning[0] && (
                                  <p className="explorer-expand-reason">{detail.opportunity.reasoning[0]}</p>
                                )}
                                {wikipediaLink ? (
                                  <p className="explorer-expand-reason">
                                    Wikipedia pageviews are concentrated on{" "}
                                    <a
                                      className="trend-link"
                                      href={wikipediaLink.url}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {wikipediaLink.title}
                                    </a>
                                    . Treat Wikipedia-only movement as context until another source corroborates it.
                                  </p>
                                ) : null}
                              </div>

                            </div>

                            {detail.geoSummary.length > 0 && (
                              <div className="explorer-expand-geo-wrap">
                                <div className="explorer-expand-geo">
                                  <LazyGeoMapCompact data={detail.geoSummary} />
                                </div>
                              </div>
                            )}

                            <div className="explorer-expand-actions">
                              <Link className="mini-action-button" href={`/trends/${trend.id}`}>
                                Full detail
                              </Link>
                              {firstRelated && (
                                <Link className="mini-action-button" href={`/trends/${firstRelated.id}`}>
                                  Compare: {firstRelated.name}
                                </Link>
                              )}
                              {primaryEvidenceLink?.evidenceUrl && (
                                <a
                                  className="mini-action-button"
                                  href={primaryEvidenceLink.evidenceUrl}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  Open source
                                </a>
                              )}
                              {wikipediaLink && (
                                <a
                                  className="mini-action-button"
                                  href={wikipediaLink.url}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  Open wiki
                                </a>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="history-panel">
          <div className="section-heading">
            <h2>{WATCHLISTS_ENABLED ? "Watchlists" : "Operations"}</h2>
          </div>

          {WATCHLISTS_ENABLED ? (
            <>
              <div className="snapshot-list">
                <section className="snapshot-card">
                  <header>
                    <strong>Identity</strong>
                    <span>{authStatus.authEnabled ? (authStatus.user ? "Signed in" : "Required") : "Local mode"}</span>
                  </header>
                  {authStatus.authEnabled ? (
                    authStatus.user ? (
                      <>
                        <p className="source-summary-copy">
                          {authStatus.user.displayName} · @{authStatus.user.username}
                        </p>
                        <Button className="mini-action-button" disabled={authPending} onClick={() => void handleLogout()}>
                          {authPending ? "Signing out..." : "Sign out"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="watchlist-form watchlist-form-stack">
                          <Input className="text-input" placeholder="Username" value={authUsername} onChange={(event) => setAuthUsername(event.target.value)} />
                          {authMode === "register" ? (
                            <Input className="text-input" placeholder="Display name" value={authDisplayName} onChange={(event) => setAuthDisplayName(event.target.value)} />
                          ) : null}
                          <Input className="text-input" placeholder="Password" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
                        </div>
                        <div className="watchlist-form">
                          <Button className="mini-action-button" disabled={authPending} onClick={() => void handleAuthSubmit()}>
                            {authPending ? (authMode === "login" ? "Signing in..." : "Creating...") : authMode === "login" ? "Sign in" : "Register"}
                          </Button>
                          <Button
                            className="mini-action-button"
                            disabled={authPending}
                            onClick={() => {
                              setAuthMode((current) => (current === "login" ? "register" : "login"));
                              setAuthError(null);
                            }}
                          >
                            {authMode === "login" ? "Need account" : "Use login"}
                          </Button>
                        </div>
                        {authError ? <p className="source-error-copy">{authError}</p> : null}
                      </>
                    )
                  ) : (
                    <p className="empty-state-hint">Authentication is disabled in local-first mode. Watchlists stay machine-local.</p>
                  )}
                </section>
              </div>

              <details className="sidebar-section" ref={alertsDetailsRef} open={alertCount > 0 ? true : undefined}>
                <summary>
                  <div className="section-heading section-heading-spaced">
                    <h2>
                      Alerts
                      {alertCount > 0 ? (
                        <span className="alert-badge">{alertCount}</span>
                      ) : null}
                    </h2>
                    {alertCount > 0 ? (
                      <button className="mini-action-button" onClick={() => void handleMarkAlertsRead()} type="button">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </summary>

                <div className="snapshot-list">
                  {alertEvents.length === 0 ? (
                    <p className="empty-state-hint">No unread alerts. Create alert rules above to get notified when trends cross score thresholds.</p>
                  ) : (
                    alertEvents.slice(0, 8).map((event) => (
                      <section className="snapshot-card snapshot-card-alert" key={event.id}>
                        <header>
                          <strong>
                            <Link className="trend-link" href={`/trends/${event.trendId}`}>
                              {event.trendName}
                            </Link>
                          </strong>
                          <span className="trend-status-pill trend-status-pill-breakout">
                            {formatAlertRuleType(event.ruleType)}
                          </span>
                        </header>
                        <p className="source-summary-copy">{event.message}</p>
                        <p className="source-summary-copy">{formatCompactTimestamp(event.triggeredAt)}</p>
                      </section>
                    ))
                  )}
                </div>
              </details>
            </>
          ) : null}

          <details className="sidebar-section" ref={runsDetailsRef}>
            <summary>
              <div className="section-heading section-heading-spaced">
                <h2>Runs</h2>
              </div>
            </summary>

            <div className="snapshot-list">
              {initialData.overview.operations.recentRuns.map((run) => (
                <section className="snapshot-card" key={run.capturedAt}>
                  <header>
                    <strong>{formatTimestamp(run.capturedAt)}</strong>
                    <span className={sourceHealthClassName(run.status)}>
                      {run.failedSourceCount === 0 ? "Healthy run" : "Degraded run"}
                    </span>
                  </header>
                  <p className="source-summary-copy">
                    {run.signalCount} sig · {run.rankedTrendCount} trends · {run.successfulSourceCount}/
                    {run.sourceCount} healthy
                  </p>
                  <p className="source-summary-copy">
                    {formatDuration(run.durationMs)} ·{" "}
                    {run.topTrendId && run.topTrendName ? (
                      <>
                        <Link className="trend-link" href={`/trends/${run.topTrendId}`}>
                          {run.topTrendName}
                        </Link>
                        {run.topScore != null ? ` ${run.topScore.toFixed(1)}` : ""}
                      </>
                    ) : (
                      "No top trend"
                    )}
                  </p>
                </section>
              ))}
            </div>
          </details>

          <details className="sidebar-section" ref={sourcesDetailsRef}>
            <summary>
              <div className="section-heading section-heading-spaced">
                <h2>Sources</h2>
              </div>
            </summary>

            <div className="snapshot-list">
              {sourceWatchlist.length > 0 ? (
                <section className="snapshot-card">
                  <header>
                    <strong>Source watch</strong>
                    <span className="source-health-pill source-health-pill-degraded">Needs attention</span>
                  </header>
                  <div className="detail-list">
                    {sourceWatchlist.map((item) => (
                      <article className="detail-list-item" key={item.source}>
                        <div>
                          <strong>
                            <Link className="trend-link" href={`/sources/${item.source}`}>
                              {item.title}
                            </Link>
                          </strong>
                          <span>{item.detail}</span>
                        </div>
                        <small>{formatWatchSeverity(item.severity)}</small>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
              {initialData.overview.sources.map((source) => (
                <section className="snapshot-card" key={source.source}>
                  <header>
                    <strong>
                      <Link className="trend-link" href={`/sources/${source.source}`}>
                        {formatSourceLabel(source.source)}
                      </Link>
                    </strong>
                    <span className={sourceHealthClassName(source.status)}>
                      {formatSourceStatus(source.status)}
                    </span>
                  </header>
                  <p className="source-summary-copy">
                    {source.signalCount} sig · {source.trendCount} trends
                  </p>
                  <p className="source-summary-copy">
                    {source.latestFetchAt ? formatCompactTimestamp(source.latestFetchAt) : "No fetch"} ·{" "}
                    {source.latestItemCount} items · {formatDuration(source.durationMs)}
                  </p>
                  <p className="source-summary-copy">{summarizeSourceYield(source)}</p>
                  {source.usedFallback ? (
                    <p className="source-warning-copy">Latest successful fetch used fallback sample data.</p>
                  ) : (
                    <p className="source-summary-copy">{describeSourceYield(source)}</p>
                  )}
                  {source.errorMessage ? (
                    <p className="source-error-copy">{source.errorMessage}</p>
                  ) : null}
                </section>
              ))}
            </div>
          </details>

          {WATCHLISTS_ENABLED ? (
            <details className="sidebar-section">
              <summary>
                <div className="section-heading section-heading-spaced">
                  <h2>Public watchlists</h2>
                </div>
              </summary>
            </details>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  const maxValue = dataset.reduce((currentMax, item) => Math.max(currentMax, item.value), 0);
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

function formatSourceContributionSummary(source: NonNullable<PublicWatchlistSummary["sourceContributions"]>[number]) {
  const components: Array<[string, number]> = [
    ["Social", source.score.social],
    ["Developer", source.score.developer],
    ["Knowledge", source.score.knowledge],
    ["Search", source.score.search],
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

function formatAudienceSummary(summary: NonNullable<PublicWatchlistSummary["audienceSummary"]>) {
  return summary
    .slice(0, 2)
    .map((item) => `${formatAudiencePrefix(item.segmentType)} ${formatAudienceLabel(item.label)}`)
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
    .map((part) => (part.length <= 3 || /\d/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
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
    (watchlist.sourceContributions ?? []).some((contribution) => contribution.source === "google_trends"),
  );
  if (searchDriven) {
    spotlights.push({
      title: "Search-driven",
      description: "Led by search demand and Google Trends signals.",
      href: "/community?source=google_trends",
      watchlist: searchDriven,
    });
  }

  const global = watchlists.find((watchlist) => (watchlist.geoSummary?.length ?? 0) >= 2);
  if (global) {
    spotlights.push({
      title: "Global interest",
      description: "Showing up across multiple regions at once.",
      href: "/community",
      watchlist: global,
    });
  }

  const developerAudience = watchlists.find((watchlist) =>
    (watchlist.audienceSummary ?? []).some((segment) => segment.label === "developer"),
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
    (watchlist.audienceSummary ?? []).some((segment) => segment.label === "b2b"),
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
  return buildSegmentFilterOptions(details, "audience", DEFAULT_AUDIENCE_OPTION);
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

export function trendMatchesAudience(detail: TrendDetailRecord | undefined, selectedAudience: string) {
  return trendMatchesSegment(detail, selectedAudience, "audience");
}

export function trendMatchesMarket(detail: TrendDetailRecord | undefined, selectedMarket: string) {
  return trendMatchesSegment(detail, selectedMarket, "market");
}

export function trendMatchesLanguage(detail: TrendDetailRecord | undefined, selectedLanguage: string) {
  if (selectedLanguage === "all") {
    return true;
  }
  return (detail?.evidenceItems ?? []).some((item) => item.languageCode?.toLowerCase() === selectedLanguage);
}

export function listActiveExplorerFilters(filters: {
  keyword: string;
  selectedSource: string;
  selectedCategory: string;
  selectedAudience: string;
  selectedMarket: string;
  selectedLanguage: string;
  selectedGeoCountry: string;
  sortBy: string;
  hideRecurring: boolean;
}): ExplorerActiveFilter[] {
  const result: ExplorerActiveFilter[] = [];
  if (filters.keyword.trim().length > 0) {
    result.push({ key: "keyword", label: "Keyword", value: filters.keyword.trim() });
  }
  if (filters.selectedSource !== "all") {
    result.push({ key: "source", label: "Source", value: formatSourceLabel(filters.selectedSource) });
  }
  if (filters.selectedCategory !== "all") {
    result.push({ key: "category", label: "Category", value: formatCategory(filters.selectedCategory) });
  }
  if (filters.selectedAudience !== "all") {
    result.push({ key: "audience", label: "Audience", value: formatAudienceLabel(filters.selectedAudience) });
  }
  if (filters.selectedMarket !== "all") {
    result.push({ key: "market", label: "Market", value: formatAudienceLabel(filters.selectedMarket) });
  }
  if (filters.selectedLanguage !== "all") {
    result.push({ key: "language", label: "Language", value: formatLanguageLabel(filters.selectedLanguage) });
  }
  if (filters.selectedGeoCountry !== "all") {
    result.push({ key: "geo", label: "Geo", value: formatGeoCountryLabel(filters.selectedGeoCountry) });
  }
  if (filters.sortBy !== "rank") {
    result.push({ key: "sort", label: "Sort", value: formatExplorerSortLabel(filters.sortBy) });
  }
  if (filters.hideRecurring) {
    result.push({ key: "seasonality", label: "Seasonality", value: "Hide recurring" });
  }
  return result;
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

function trendMatchesSegment(detail: TrendDetailRecord | undefined, selectedValue: string, segmentType: string) {
  if (selectedValue === "all") {
    return true;
  }
  return (detail?.audienceSummary ?? []).some((item) => item.segmentType === segmentType && item.label === selectedValue);
}

function buildTrendAudienceBadge(summary: TrendDetailRecord["audienceSummary"]) {
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
    .map((item) => `${formatAudiencePrefix(item.segmentType)} ${formatAudienceLabel(item.label)}`)
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
    score: "Score",
    mover: "Biggest mover",
    newest: "Newest",
  };
  return labels[sortBy] ?? sortBy;
}

function getOptionLabel<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string,
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function formatGeoCountryLabel(countryCode: string) {
  return formatCountryLabel(countryCode, getRegionName(countryCode) ?? countryCode);
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

function buildConicGradient(dataset: { value: number }[]) {
  const total = dataset.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return "conic-gradient(#182947 0deg 360deg)";
  }

  const palette = ["#5e6bff", "#00c4ff", "#7fe0a7", "#ffca6e", "#ff8b8b", "#9b8cff"];
  let currentAngle = 0;
  const segments = dataset.slice(0, 6).map((item, index) => {
    const segmentAngle = (item.value / total) * 360;
    const color = palette[index % palette.length];
    const segment = `${color} ${currentAngle}deg ${currentAngle + segmentAngle}deg`;
    currentAngle += segmentAngle;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}
