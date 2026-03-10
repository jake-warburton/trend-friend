"use client";

import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { NumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkline } from "@/components/sparkline";
import {
  AUTO_REFRESH_INTERVAL_MS,
  formatAutoRefreshStatus,
  hasOverviewChanged,
} from "@/lib/auto-refresh";
import { summarizeShareUsage, wasOpenedRecently } from "@/lib/share-analytics";

import type {
  AlertEvent,
  AlertEventsResponse,
  AuthStatusResponse,
  DashboardData,
  PublicWatchlistSummary,
  PublicWatchlistsResponse,
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

const SORT_OPTIONS = [
  { label: "Rank", value: "rank" },
  { label: "Score", value: "score" },
  { label: "Biggest mover", value: "mover" },
  { label: "Newest", value: "newest" },
] as const;

export function DashboardShell({ initialData }: DashboardShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [minimumScore, setMinimumScore] = useState<number | null>(0);
  const [sortBy, setSortBy] = useState<string>("rank");
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
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [publicWatchlists, setPublicWatchlists] = useState<PublicWatchlistSummary[]>([]);
  const [autoRefreshState, setAutoRefreshState] = useState<"idle" | "checking" | "refreshing" | "updated" | "error">("idle");
  const [overviewMeta, setOverviewMeta] = useState({
    generatedAt: initialData.overview.generatedAt,
    lastRunAt: initialData.overview.operations.lastRunAt,
  });
  const [lastBackgroundUpdateAt, setLastBackgroundUpdateAt] = useState<number | null>(null);
  const defaultWatchlist = watchlistData?.watchlists[0] ?? null;
  const watchlistsRequireAuth = authStatus.authEnabled && authStatus.user == null;
  const shareActivityById = buildShareActivityMap(defaultWatchlist);
  const deferredKeyword = useDeferredValue(keyword);
  const isPollingRef = useRef(false);
  const hasMountedRef = useRef(false);
  const shareUsageSummary = useMemo(
    () => summarizeShareUsage(defaultWatchlist?.shares ?? []),
    [defaultWatchlist?.shares],
  );

  function showActionNotice(message: string) {
    setActionNotice(message);
    setWatchlistError(null);
    setTimeout(() => setActionNotice(null), 3000);
  }

  const filteredTrends = useMemo(() => {
    const normalizedKeyword = deferredKeyword.trim().toLowerCase();
    const minimum = minimumScore ?? 0;
    const trends = initialData.explorer.trends.filter((trend) => {
      const matchesSource =
        selectedSource === "all" || trend.sources.includes(selectedSource);
      const matchesCategory =
        selectedCategory === "all" || trend.category === selectedCategory;
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        trend.name.toLowerCase().includes(normalizedKeyword) ||
        trend.evidencePreview.some((item) => item.toLowerCase().includes(normalizedKeyword));
      const matchesScore = trend.score.total >= minimum;
      return matchesSource && matchesCategory && matchesKeyword && matchesScore;
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
  }, [deferredKeyword, initialData.explorer.trends, minimumScore, selectedCategory, selectedSource, sortBy]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(initialData.explorer.trends.map((trend) => trend.category))).sort();
    return [
      DEFAULT_CATEGORY_OPTION,
      ...categories.map((category) => ({ label: formatCategory(category), value: category })),
    ];
  }, [initialData.explorer.trends]);

  function handleRefresh() {
    setRefreshError(null);
    startTransition(async () => {
      const response = await fetch("/api/refresh", { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setRefreshError(payload.error ?? "Refresh failed");
        return;
      }
      setAutoRefreshState("refreshing");
      router.refresh();
    });
  }

  useEffect(() => {
    void loadAuthStatus();
    void loadWatchlists();
    void loadAlertEvents();
    void loadPublicWatchlists();
  }, []);

  useEffect(() => {
    const currentOverview = {
      generatedAt: overviewMeta.generatedAt,
      operations: {
        ...initialData.overview.operations,
        lastRunAt: overviewMeta.lastRunAt,
      },
    };
    const changed = hasOverviewChanged(currentOverview, initialData.overview);
    setOverviewMeta({
      generatedAt: initialData.overview.generatedAt,
      lastRunAt: initialData.overview.operations.lastRunAt,
    });
    if (hasMountedRef.current && changed) {
      setAutoRefreshState("updated");
      setLastBackgroundUpdateAt(Date.now());
    } else {
      hasMountedRef.current = true;
    }
  }, [initialData.overview, overviewMeta.generatedAt, overviewMeta.lastRunAt]);

  useEffect(() => {
    async function pollOverview() {
      if (isPollingRef.current || actionPending || isPending || document.hidden) {
        return;
      }

      isPollingRef.current = true;
      setAutoRefreshState((current) => (current === "refreshing" ? current : "checking"));
      try {
        const response = await fetch("/api/dashboard/overview", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Dashboard overview unavailable");
        }
        const nextOverview = (await response.json()) as DashboardData["overview"];
        const currentOverview = {
          generatedAt: overviewMeta.generatedAt,
          operations: {
            ...nextOverview.operations,
            lastRunAt: overviewMeta.lastRunAt,
          },
        };
        if (hasOverviewChanged(currentOverview, nextOverview)) {
          setOverviewMeta({
            generatedAt: nextOverview.generatedAt,
            lastRunAt: nextOverview.operations.lastRunAt,
          });
          setAutoRefreshState("refreshing");
          startTransition(() => {
            router.refresh();
          });
          return;
        }
        setAutoRefreshState((current) => (current === "updated" ? current : "idle"));
      } catch {
        setAutoRefreshState("error");
      } finally {
        isPollingRef.current = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void pollOverview();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [actionPending, isPending, overviewMeta.generatedAt, overviewMeta.lastRunAt, router, startTransition]);

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
            <span className="refresh-status-copy">
              {formatAutoRefreshStatus(autoRefreshState, lastBackgroundUpdateAt)}
            </span>
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
          <div className="hero-action-wrap">
            <Button className="refresh-button" disabled={isPending} onClick={handleRefresh}>
              {isPending ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
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
      </section>

      {refreshError ? <p className="error-banner">{refreshError}</p> : null}

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
            <span className="section-heading-meta">{filteredTrends.length} live</span>
          </div>

          {filteredTrends.length === 0 ? (
            <div className="empty-state">
              <h3>No trends match these filters.</h3>
              <p>Lower the minimum score or broaden the keyword and source filters.</p>
            </div>
          ) : (
            <div className="explorer-list">
              <div className="explorer-legend" aria-hidden="true">
                <span>Trend</span>
                <span>Pos</span>
                <span>Move</span>
                <span>Score</span>
                <span>Signals</span>
              </div>
              {filteredTrends.map((trend) => (
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
                    </div>
                  </div>

                  <div className="explorer-card-bottom">
                    <div className="evidence-preview evidence-preview-inline">
                      <span>{trend.evidencePreview[0] ?? "No evidence available."}</span>
                    </div>

                    <div className="source-row source-row-compact">
                      {trend.sources.map((source) => (
                        <span className="source-badge" key={source}>
                          {formatSourceLabel(source)}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
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
                <span>{watchlistLoading ? "Loading..." : `${defaultWatchlist?.items.length ?? 0} tracked`}</span>
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
              {watchlistError ? <p className="source-error-copy">{watchlistError}</p> : null}
              {actionNotice ? <p className="action-success-notice">{actionNotice}</p> : null}
              {shareNotice ? <p className="source-summary-copy">{shareNotice}</p> : null}
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
          </div>

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

          <div className="section-heading section-heading-spaced">
            <h2>Runs</h2>
          </div>

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

          <div className="section-heading section-heading-spaced">
            <h2>Sources</h2>
          </div>

          <div className="snapshot-list">
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
                {source.usedFallback ? (
                  <p className="source-warning-copy">Latest successful fetch used fallback sample data.</p>
                ) : null}
                {source.errorMessage ? (
                  <p className="source-error-copy">{source.errorMessage}</p>
                ) : null}
              </section>
            ))}
          </div>

          <div className="section-heading section-heading-spaced">
            <h2>Public watchlists</h2>
          </div>

          <div className="snapshot-list">
            {publicWatchlists.length === 0 ? (
              <p className="empty-state-hint">No public watchlists yet. Share a watchlist with a public link to have it listed here.</p>
            ) : (
              publicWatchlists.slice(0, 6).map((watchlist) => (
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
                </section>
              ))
            )}
          </div>
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
  return source
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
