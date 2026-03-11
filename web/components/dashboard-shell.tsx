"use client";

import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { NumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkline } from "@/components/sparkline";
import { TrendTrajectoryChart } from "@/components/trend-trajectory-chart";
import { hasOverviewChanged } from "@/lib/auto-refresh";
import { formatForecastConfidence, getExplorerForecastBadge } from "@/lib/forecast-ui";
import { getPrimaryEvidenceLink } from "@/lib/evidence-links";
import { buildSourceWatchlist } from "@/lib/source-health";
import { maskWebhookDestination, summarizeNotificationDelivery } from "@/lib/notification-ui";
import { getSeasonalityBadge, isRecurringTrend } from "@/lib/seasonality-ui";
import { summarizeShareUsage, wasOpenedRecently } from "@/lib/share-analytics";
import { describeSourceYield, summarizeSourceYield } from "@/lib/source-yield";
import { getWikipediaLinkFromDetail } from "@/lib/wikipedia";
import { downloadTrendsCsv, downloadWatchlistCsv } from "@/lib/csv-download";
import { GeoMapCompact } from "@/components/geo-map-compact";

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
};

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

type ExplorerActiveFilter = {
  key: "keyword" | "source" | "category" | "audience" | "market" | "language" | "sort" | "seasonality";
  label: string;
  value: string;
};

export function DashboardShell({ initialData }: DashboardShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAudience, setSelectedAudience] = useState<string>("all");
  const [selectedMarket, setSelectedMarket] = useState<string>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
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
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
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
        sortBy,
        hideRecurring,
      }),
    [hideRecurring, keyword, selectedAudience, selectedCategory, selectedLanguage, selectedMarket, selectedSource, sortBy],
  );

  const filteredTrends = useMemo(() => {
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
  }, [deferredKeyword, detailsByTrendId, hideRecurring, initialData.explorer.trends, minimumScore, selectedAudience, selectedCategory, selectedLanguage, selectedMarket, selectedSource, sortBy]);

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
    setOverviewMeta({
      generatedAt: initialData.overview.generatedAt,
      lastRunAt: initialData.overview.operations.lastRunAt,
    });
  }, [initialData.overview]);

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
          <Button className="refresh-button" disabled={isPending} onClick={handleRefresh} aria-label={isPending ? "Refreshing" : "Refresh data"}>
            <svg className={isPending ? "refresh-icon refresh-icon-spin" : "refresh-icon"} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </Button>
        </div>
      </section>

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
              <Select.Value />
              <Select.Icon className="select-icon">+</Select.Icon>
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
              <Select.Value />
              <Select.Icon className="select-icon">+</Select.Icon>
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
              <Select.Value />
              <Select.Icon className="select-icon">+</Select.Icon>
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
              <Select.Value />
              <Select.Icon className="select-icon">+</Select.Icon>
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
              <Select.Value />
              <Select.Icon className="select-icon">+</Select.Icon>
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
              <Select.Value />
              <Select.Icon className="select-icon">+</Select.Icon>
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
          <TrendTrajectoryChart trends={initialData.details.trends} />
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

      <section className="content-grid">
        <div className="ranking-panel">
          <div className="section-heading">
            <h2>Explorer</h2>
            <div className="section-heading-actions">
              <a className="mini-action-button export-button" href="/api/export" download>
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
              <div className="explorer-legend" aria-hidden="true">
                <span>Trend</span>
                <span>Pos</span>
                <span>Move</span>
                <span>Score</span>
                <span>Signals</span>
              </div>
              {filteredTrends.map((trend) => {
                const forecastBadge = getExplorerForecastBadge(trend.forecastDirection);
                const seasonalityBadge = getSeasonalityBadge(trend.seasonality);
                const detail = detailsByTrendId.get(trend.id);
                const primaryEvidenceLink = getPrimaryEvidenceLink(detail);
                const wikipediaLink = getWikipediaLinkFromDetail(detail);
                const audienceBadge = buildTrendAudienceBadge(detail?.audienceSummary ?? []);
                const audienceSummary = summarizeTrendAudience(detail?.audienceSummary ?? []);
                return (
                <article className="explorer-card" key={trend.id}>
                  <div className="explorer-card-top">
                    <div className="trend-cell">
                      <div className="trend-title-row">
                        <strong>
                          <Link className="trend-link" href={`/trends/${trend.id}`}>
                            {trend.name}
                          </Link>
                        </strong>
                        <button
                          className={
                            defaultWatchlist?.items.some((item) => item.trendId === trend.id)
                              ? "watch-toggle watch-toggle-active"
                              : "watch-toggle"
                          }
                          onClick={() => void handleToggleTracked(trend.id, trend.name)}
                          type="button"
                        >
                          {defaultWatchlist?.items.some((item) => item.trendId === trend.id) ? "Tracked" : "Track"}
                        </button>
                        <span className={trendStatusClassName(trend.status)}>
                          {formatTrendStatus(trend.status)}
                        </span>
                        <span className={volatilityClassName(trend.volatility)}>
                          {formatVolatility(trend.volatility)}
                        </span>
                        {forecastBadge ? (
                          <span className={`forecast-badge forecast-badge-${forecastBadge.tone}`}>
                            {forecastBadge.label}
                          </span>
                        ) : null}
                        {seasonalityBadge ? (
                          <span className={`seasonality-badge seasonality-badge-${seasonalityBadge.tone}`}>
                            {seasonalityBadge.label}
                          </span>
                        ) : null}
                        {audienceBadge ? (
                          <span className="trend-date-chip">{audienceBadge}</span>
                        ) : null}
                        <span className="trend-date-chip">{formatCategory(trend.category)}</span>
                        <span className="trend-date-chip">
                          {trend.firstSeenAt ? formatDateOnly(trend.firstSeenAt) : "This run"}
                        </span>
                      </div>
                    </div>

                    <div className="explorer-metrics-row">
                      <div className="explorer-metric explorer-metric-inline">
                        <strong>#{trend.rank}</strong>
                      </div>

                      <div className="explorer-metric explorer-metric-inline">
                        <div className="movement-inline">
                          <strong className={movementClassName(trend.rankChange)}>
                            {formatRankChange(trend.rankChange)}
                          </strong>
                          <small>{formatMomentum(trend.momentum.percentDelta)}</small>
                        </div>
                      </div>

                      <div className="explorer-metric explorer-metric-inline">
                        <div className="score-inline">
                          <strong>{trend.score.total.toFixed(1)}</strong>
                          <small>
                            S {trend.score.social.toFixed(1)} / D {trend.score.developer.toFixed(1)} / K{" "}
                            {trend.score.knowledge.toFixed(1)}
                          </small>
                        </div>
                      </div>

                      <div className="explorer-metric explorer-metric-inline">
                        <strong>{trend.coverage.signalCount}</strong>
                      </div>

                      <div className="explorer-metric explorer-metric-inline">
                        <Sparkline data={(trend.recentHistory ?? []).map((p) => p.scoreTotal)} />
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
                      {primaryEvidenceLink ? (
                        <span className="source-summary-copy">
                          Source: {formatSourceLabel(primaryEvidenceLink.source)}
                        </span>
                      ) : null}
                      {audienceSummary ? <span className="source-summary-copy">{audienceSummary}</span> : null}
                      {wikipediaLink ? (
                        <a
                          className="trend-link"
                          href={wikipediaLink.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Wikipedia: {wikipediaLink.title}
                        </a>
                      ) : null}
                    </div>

                    <div className="source-row source-row-compact">
                      {trend.sources.map((source) => (
                        <span className="source-badge" key={source}>
                          {formatSourceLabel(source)}
                        </span>
                      ))}
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
                        const topContribs = detail.sourceContributions.slice(0, 5);
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
                                <strong>Sources</strong>
                                <div className="mini-bar-list">
                                  {topContribs.map((contrib) => (
                                    <div className="mini-bar-row" key={contrib.source}>
                                      <span>{formatSourceLabel(contrib.source)}</span>
                                      <div className="mini-bar-track">
                                        <div
                                          className="mini-bar-fill mini-bar-fill-muted"
                                          style={{ width: `${(contrib.scoreSharePercent / maxContrib) * 100}%` }}
                                        />
                                      </div>
                                      <strong>{contrib.scoreSharePercent.toFixed(1)}%</strong>
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
                              <div className="explorer-expand-geo">
                                <GeoMapCompact data={detail.geoSummary} />
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
                              <button
                                className={
                                  defaultWatchlist?.items.some((item) => item.trendId === trend.id)
                                    ? "watch-toggle watch-toggle-active"
                                    : "watch-toggle"
                                }
                                onClick={() => void handleToggleTracked(trend.id, trend.name)}
                                type="button"
                              >
                                {defaultWatchlist?.items.some((item) => item.trendId === trend.id) ? "Untrack" : "Track"}
                              </button>
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
            <h2>Watchlists</h2>
          </div>

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
                      <Input
                        className="text-input"
                        placeholder="Username"
                        value={authUsername}
                        onChange={(event) => setAuthUsername(event.target.value)}
                      />
                      {authMode === "register" ? (
                        <Input
                          className="text-input"
                          placeholder="Display name"
                          value={authDisplayName}
                          onChange={(event) => setAuthDisplayName(event.target.value)}
                        />
                      ) : null}
                      <Input
                        className="text-input"
                        placeholder="Password"
                        type="password"
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                      />
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

            <section className="snapshot-card">
              <header>
                <strong>{defaultWatchlist?.name ?? "Core Watchlist"}</strong>
                <span>{watchlistLoading ? <span className="pulse-text">Loading\u2026</span> : `${defaultWatchlist?.items.length ?? 0} tracked`}</span>
              </header>
              {watchlistsRequireAuth ? (
                <p className="empty-state-hint">Sign in to create watchlists, alerts, and share links.</p>
              ) : null}
              <div className="watchlist-form">
                <Input
                  className="text-input"
                  placeholder="New watchlist"
                  value={watchlistName}
                  onChange={(event) => setWatchlistName(event.target.value)}
                  disabled={watchlistsRequireAuth}
                />
                <Button className="mini-action-button" disabled={actionPending || watchlistsRequireAuth} onClick={() => void handleCreateWatchlist()}>
                  Add
                </Button>
                {defaultWatchlist ? (
                  <button className="export-button export-button-small" onClick={() => downloadWatchlistCsv(defaultWatchlist.id)} type="button">
                    Export
                  </button>
                ) : null}
              </div>
              <div className="watchlist-form">
                <NumberField.Root min={1} value={alertThreshold} onValueChange={setAlertThreshold}>
                  <NumberField.Group className="number-group">
                    <NumberField.Decrement className="number-button">-</NumberField.Decrement>
                    <NumberField.Input className="number-input" />
                    <NumberField.Increment className="number-button">+</NumberField.Increment>
                  </NumberField.Group>
                </NumberField.Root>
                <Button className="mini-action-button" disabled={actionPending || watchlistsRequireAuth} onClick={() => void handleCreateAlert()}>
                  Alert
                </Button>
              </div>
              {defaultWatchlist ? (
                <>
                <div className="watchlist-form">
                  <Select.Root value={shareExpiryPreset} onValueChange={(value) => setShareExpiryPreset(value ?? "none")}>
                    <Select.Trigger className="select-trigger">
                      <Select.Value />
                      <Select.Icon className="select-icon">+</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner className="select-positioner" sideOffset={8}>
                        <Select.Popup className="select-popup">
                          <Select.List className="select-list">
                            <Select.Item className="select-item" value="default"><Select.ItemText>{formatShareDefaultOptionLabel(defaultWatchlist.defaultShareExpiryDays)}</Select.ItemText></Select.Item>
                            <Select.Item className="select-item" value="none"><Select.ItemText>No expiry</Select.ItemText></Select.Item>
                            <Select.Item className="select-item" value="24h"><Select.ItemText>24 hours</Select.ItemText></Select.Item>
                            <Select.Item className="select-item" value="7d"><Select.ItemText>7 days</Select.ItemText></Select.Item>
                            <Select.Item className="select-item" value="30d"><Select.ItemText>30 days</Select.ItemText></Select.Item>
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                  <Button
                    className="mini-action-button"
                    disabled={actionPending || watchlistsRequireAuth || shareExpiryPreset === "default"}
                    onClick={() => void handleSaveDefaultShareExpiry(defaultWatchlist)}
                  >
                    Save default
                  </Button>
                </div>
                <p className="source-summary-copy">
                  Default for new links: {formatWatchlistDefaultShareExpiry(defaultWatchlist.defaultShareExpiryDays)}
                </p>
                <div className="watchlist-form">
                  <Button
                    className="mini-action-button"
                    disabled={actionPending || watchlistsRequireAuth}
                    onClick={() => void handleCreateShare(defaultWatchlist, false)}
                  >
                    {actionPending ? "Sharing..." : "Private link"}
                  </Button>
                  <Button
                    className="mini-action-button"
                    disabled={actionPending || watchlistsRequireAuth}
                    onClick={() => void handleCreateShare(defaultWatchlist, true)}
                  >
                    {actionPending ? "Sharing..." : "Public link"}
                  </Button>
                </div>
                </>
              ) : null}
              <div aria-live="polite">
                {watchlistError ? <p className="source-error-copy">{watchlistError}</p> : null}
                {actionNotice ? <p className="action-success-notice">{actionNotice}</p> : null}
                {shareNotice ? <p className="source-summary-copy">{shareNotice}</p> : null}
              </div>
              {defaultWatchlist && defaultWatchlist.shares.length > 0 ? (
                <div className="watchlist-share-analytics">
                  <article className="watchlist-share-analytics-card">
                    <span className="watchlist-share-label">Total opens</span>
                    <strong>{shareUsageSummary.totalOpens}</strong>
                  </article>
                  <article className="watchlist-share-analytics-card">
                    <span className="watchlist-share-label">Last 7 days</span>
                    <strong>{shareUsageSummary.recentOpens}</strong>
                  </article>
                  <article className="watchlist-share-analytics-card">
                    <span className="watchlist-share-label">Active in 7d</span>
                    <strong>{shareUsageSummary.activeShares}</strong>
                  </article>
                  <article className="watchlist-share-analytics-card">
                    <span className="watchlist-share-label">Top link</span>
                    <strong>
                      {shareUsageSummary.topShare
                        ? `${formatShareTokenLabel(shareUsageSummary.topShare.shareToken)} · ${shareUsageSummary.topShare.accessCount} opens`
                        : "No link usage yet"}
                    </strong>
                  </article>
                  <article className="watchlist-share-analytics-card">
                    <span className="watchlist-share-label">Dormant</span>
                    <strong>{shareUsageSummary.dormantShares}</strong>
                  </article>
                </div>
              ) : null}
              <div className="watchlist-items">
                {(defaultWatchlist?.items ?? []).slice(0, 5).map((item) => (
                  <Link className="watchlist-item" href={`/trends/${item.trendId}`} key={item.trendId}>
                    <span>{item.trendName}</span>
                  </Link>
                ))}
              </div>
              <div className="watchlist-items">
                {defaultWatchlist
                  ? defaultWatchlist.shares.slice(0, 3).map((share) => (
                    <section className="watchlist-item watchlist-item-share" key={share.id}>
                      <div className="watchlist-share-grid">
                        <div className="watchlist-share-cell">
                          <span className="watchlist-share-label">Link</span>
                          <Link className="watchlist-item-share-link" href={`/shared/${share.shareToken}`}>
                            <span>{share.public ? "Public share" : "Private share"}</span>
                          </Link>
                          <small className="source-summary-copy">{formatShareTokenLabel(share.shareToken)}</small>
                        </div>
                        <div className="watchlist-share-cell">
                          <span className="watchlist-share-label">Visibility</span>
                          <strong>{share.public ? "Public directory" : "Direct link only"}</strong>
                        </div>
                        <div className="watchlist-share-cell">
                          <span className="watchlist-share-label">Attribution</span>
                          <strong>{share.showCreator ? "Shows your name" : "Anonymous"}</strong>
                        </div>
                        <div className="watchlist-share-cell">
                          <span className="watchlist-share-label">Expiry</span>
                          <strong>{formatShareExpirySummary(share.expiresAt)}</strong>
                        </div>
                        <div className="watchlist-share-cell">
                          <span className="watchlist-share-label">Created</span>
                          <strong>{formatCompactTimestamp(share.createdAt)}</strong>
                        </div>
                        <div className="watchlist-share-cell">
                          <span className="watchlist-share-label">Opens</span>
                          <strong>{share.accessCount}</strong>
                        </div>
                        <div className="watchlist-share-cell">
                          <span className="watchlist-share-label">7 day trend</span>
                          <Sparkline
                            data={fillShareHistory(share.accessHistory).map((point) => point.count)}
                            color={wasOpenedRecently(share.lastAccessedAt) ? "#7fe0a7" : "#ffca6e"}
                            width={96}
                            height={28}
                          />
                        </div>
                        <div className="watchlist-share-cell">
                          <span className="watchlist-share-label">Last opened</span>
                          <strong>{formatShareActivityTimestamp(share.lastAccessedAt)}</strong>
                          {wasOpenedRecently(share.lastAccessedAt) ? (
                            <small className="source-summary-copy">Active this week</small>
                          ) : null}
                        </div>
                        <div className="watchlist-share-cell">
                          <span className="watchlist-share-label">Last activity</span>
                          <strong>{formatShareActivityTimestamp(shareActivityById.get(share.id) ?? null)}</strong>
                        </div>
                      </div>
                      <div className="watchlist-item-share-actions">
                        <button
                          className="mini-action-button"
                          disabled={actionPending || watchlistsRequireAuth}
                          onClick={() => void handleToggleShareVisibility(defaultWatchlist, share.id, share.public)}
                          type="button"
                        >
                          {share.public ? "Make private" : "Make public"}
                        </button>
                        <button
                          className="mini-action-button"
                          disabled={actionPending || watchlistsRequireAuth}
                          onClick={() => void handleToggleShareAttribution(defaultWatchlist, share.id, share.showCreator)}
                          type="button"
                        >
                          {share.showCreator ? "Hide name" : "Show name"}
                        </button>
                        <button
                          className="mini-action-button"
                          disabled={actionPending || watchlistsRequireAuth}
                          onClick={() => void handleRotateShare(defaultWatchlist, share.id)}
                          type="button"
                        >
                          Rotate
                        </button>
                        <button
                          className="mini-action-button"
                          disabled={actionPending || watchlistsRequireAuth}
                          onClick={() => void handleSetShareExpiry(defaultWatchlist, share.id, share.expiresAt ? "none" : "7d")}
                          type="button"
                        >
                          {share.expiresAt ? "Clear expiry" : "Expire in 7d"}
                        </button>
                        <button
                          className="mini-action-button"
                          disabled={actionPending || watchlistsRequireAuth}
                          onClick={() => void handleRevokeShare(defaultWatchlist, share.id)}
                          type="button"
                        >
                          Revoke
                        </button>
                      </div>
                    </section>
                  ))
                  : null}
              </div>
              <div className="watchlist-items">
                {(watchlistData?.matches ?? []).slice(0, 3).map((match) => (
                  <div className="watchlist-item watchlist-item-alert" key={`${match.alertId}-${match.trendId}`}>
                    <span>
                      {match.trendName} {match.currentValue.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
              {defaultWatchlist && defaultWatchlist.shareEvents.length > 0 ? (
                <div className="watchlist-share-history">
                  <p className="source-summary-copy">Share activity</p>
                  <div className="watchlist-items">
                    {defaultWatchlist.shareEvents.slice(0, 5).map((event) => (
                      <div className="watchlist-item watchlist-item-share-event" key={event.id}>
                        <span>{event.detail}</span>
                        <small className="source-summary-copy">{formatCompactTimestamp(event.createdAt)}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="snapshot-card">
              <header>
                <strong>Notifications</strong>
                <span>
                  {notificationChannels.length > 0
                    ? `${notificationChannels.length} webhook${notificationChannels.length === 1 ? "" : "s"}`
                    : "None"}
                </span>
              </header>
              <p className="empty-state-hint">
                Send post-run alerts and digest summaries to Slack, Discord, or your own webhook endpoint.
              </p>
              <div className="watchlist-form watchlist-form-stack">
                <Input
                  className="text-input"
                  placeholder="https://hooks.example.com/..."
                  value={notificationDestination}
                  onChange={(event) => setNotificationDestination(event.target.value)}
                  disabled={watchlistsRequireAuth || notificationPending}
                />
                <Input
                  className="text-input"
                  placeholder="Optional label"
                  value={notificationLabel}
                  onChange={(event) => setNotificationLabel(event.target.value)}
                  disabled={watchlistsRequireAuth || notificationPending}
                />
              </div>
              <div className="watchlist-form">
                <Button
                  className="mini-action-button"
                  disabled={watchlistsRequireAuth || notificationPending}
                  onClick={() => void handleCreateNotificationChannel()}
                >
                  {notificationPending ? "Saving..." : "Add webhook"}
                </Button>
              </div>
              {watchlistsRequireAuth ? (
                <p className="empty-state-hint">Sign in to manage webhook notifications.</p>
              ) : null}
              <div aria-live="polite">
                {notificationError ? <p className="source-error-copy">{notificationError}</p> : null}
                {notificationNotice ? <p className="action-success-notice">{notificationNotice}</p> : null}
              </div>
              {notificationChannels.length === 0 ? (
                <p className="empty-state-hint">No webhooks configured yet.</p>
              ) : (
                <div className="watchlist-items">
                  {notificationChannels.map((channel) => (
                    <section className="watchlist-item watchlist-item-notification" key={channel.id}>
                      <div className="notification-channel-row">
                        <div>
                          <strong>{channel.label || "Webhook"}</strong>
                          <small className="source-summary-copy">{maskWebhookDestination(channel.destination)}</small>
                        </div>
                        <div className="notification-channel-actions">
                          <button
                            className="mini-action-button"
                            disabled={watchlistsRequireAuth || notificationPending}
                            onClick={() => void handleTestNotificationChannel(channel.id)}
                            type="button"
                          >
                            Test
                          </button>
                          <button
                            className="mini-action-button"
                            disabled={watchlistsRequireAuth || notificationPending}
                            onClick={() => void handleDeleteNotificationChannel(channel.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <small className="source-summary-copy">
                        Created {formatCompactTimestamp(channel.createdAt)}
                      </small>
                      <div className="notification-log-list">
                        {channel.recentLogs.length === 0 ? (
                          <small className="source-summary-copy">No deliveries yet</small>
                        ) : (
                          channel.recentLogs.slice(0, 5).map((log) => (
                            <div className="notification-log-row" key={log.id}>
                              <span>{summarizeNotificationDelivery(log)}</span>
                              <small className="source-summary-copy">{formatCompactTimestamp(log.sentAt)}</small>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>
          </div>

          <details className="sidebar-section" open={alertCount > 0 ? true : undefined}>
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

          <details className="sidebar-section">
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

          <details className="sidebar-section">
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

          <details className="sidebar-section">
            <summary>
              <div className="section-heading section-heading-spaced">
                <h2>Public watchlists</h2>
              </div>
            </summary>
            <div className="community-entry-links">
              <Link className="mini-action-button community-link-button" href="/community?popular=true">
                Popular this week
              </Link>
              <Link className="mini-action-button community-link-button" href="/community?category=ai-machine-learning">
                AI
              </Link>
              <Link className="mini-action-button community-link-button" href="/community">
                Browse all
              </Link>
              <a className="mini-action-button community-link-button" download href={buildCommunityExportHref()}>
                Export CSV
              </a>
            </div>

          <div className="snapshot-list">
            {publicWatchlists.length === 0 ? (
              <p className="empty-state-hint">No public watchlists yet. Share a watchlist with a public link to have it listed here.</p>
            ) : (
              <>
                {communitySpotlights.length > 0 ? (
                  <div className="community-spotlight-grid">
                    {communitySpotlights.map((spotlight) => (
                      <section className="snapshot-card community-spotlight-card" key={spotlight.title}>
                        <header>
                          <strong>{spotlight.title}</strong>
                          <div className="community-entry-links">
                            <Link className="mini-action-button community-link-button" href={spotlight.href}>
                              Open
                            </Link>
                            <a
                              className="mini-action-button community-link-button"
                              download
                              href={buildSharedWatchlistExportHref(spotlight.watchlist.shareToken)}
                            >
                              CSV
                            </a>
                          </div>
                        </header>
                        <p className="source-summary-copy">{spotlight.description}</p>
                        <p className="source-summary-copy">
                          <Link className="trend-link" href={`/shared/${spotlight.watchlist.shareToken}`}>
                            {spotlight.watchlist.name}
                          </Link>
                        </p>
                        {spotlight.watchlist.sourceContributions?.[0] ? (
                          <p className="source-summary-copy">
                            {formatSourceContributionSummary(spotlight.watchlist.sourceContributions[0])}
                          </p>
                        ) : null}
                      </section>
                    ))}
                  </div>
                ) : null}

                {publicWatchlists.slice(0, 6).map((watchlist) => (
                  <section className="snapshot-card" key={watchlist.shareToken}>
                    <header>
                      <strong>
                        <Link className="trend-link" href={`/shared/${watchlist.shareToken}`}>
                          {watchlist.name}
                        </Link>
                      </strong>
                      <span>{watchlist.popularThisWeek ? "Popular this week" : `${watchlist.itemCount} tracked`}</span>
                    </header>
                    {watchlist.recentOpenCount != null ? (
                      <p className="source-summary-copy">
                        {watchlist.recentOpenCount} opens in the last 7 days
                        {watchlist.accessCount != null ? ` · ${watchlist.accessCount} total` : ""}
                      </p>
                    ) : null}
                    {watchlist.sourceContributions?.[0] ? (
                      <p className="source-summary-copy">
                        {formatSourceContributionSummary(watchlist.sourceContributions[0])}
                      </p>
                    ) : null}
                    {watchlist.audienceSummary?.length ? (
                      <p className="source-summary-copy">{formatAudienceSummary(watchlist.audienceSummary)}</p>
                    ) : null}
                    {watchlist.ownerDisplayName ? (
                      <p className="source-summary-copy">Shared by {watchlist.ownerDisplayName}</p>
                    ) : null}
                    <p className="source-summary-copy">{formatShareExpirySummary(watchlist.expiresAt ?? null)}</p>
                    {watchlist.geoSummary?.length ? (
                      <p className="source-summary-copy">
                        {watchlist.geoSummary.map((geo) => geo.label).join(", ")}
                      </p>
                    ) : null}
                    {watchlist.lastAccessedAt ? (
                      <p className="source-summary-copy">Last opened {formatCompactTimestamp(watchlist.lastAccessedAt)}</p>
                    ) : null}
                    <p className="source-summary-copy">{formatCompactTimestamp(watchlist.createdAt)}</p>
                    <div className="community-entry-links">
                      <Link className="mini-action-button community-link-button" href={`/shared/${watchlist.shareToken}`}>
                        Open
                      </Link>
                      <a
                        className="mini-action-button community-link-button"
                        download
                        href={buildSharedWatchlistExportHref(watchlist.shareToken)}
                      >
                        Export CSV
                      </a>
                    </div>
                  </section>
                ))}
              </>
            )}
          </div>
          </details>
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

function formatSourceLabel(source: string) {
  const labels: Record<string, string> = {
    reddit: "Reddit",
    hacker_news: "Hacker News",
    github: "GitHub",
    wikipedia: "Wikipedia",
    google_trends: "Google Trends",
    twitter: "Twitter/X",
  };
  return labels[source] ?? source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
