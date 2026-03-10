"use client";

import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { NumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkline } from "@/components/sparkline";

import type {
  AlertEvent,
  AlertEventsResponse,
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
  const [alertThreshold, setAlertThreshold] = useState<number | null>(25);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [publicWatchlists, setPublicWatchlists] = useState<PublicWatchlistSummary[]>([]);
  const deferredKeyword = useDeferredValue(keyword);

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
      router.refresh();
    });
  }

  useEffect(() => {
    void loadWatchlists();
    void loadAlertEvents();
    void loadPublicWatchlists();
  }, []);

  async function loadWatchlists() {
    try {
      const response = await fetch("/api/watchlists");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? `Watchlists unavailable (${response.status})`);
      }
      setWatchlistData((await response.json()) as WatchlistResponse);
      setWatchlistError(null);
    } catch (error) {
      setWatchlistError(error instanceof Error ? error.message : "Watchlists unavailable");
    } finally {
      setWatchlistLoading(false);
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
        body: JSON.stringify({ public: isPublic }),
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

  const defaultWatchlist = watchlistData?.watchlists[0] ?? null;

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
              {initialData.overview.operations.lastRunAt
                ? formatCompactTimestamp(initialData.overview.operations.lastRunAt)
                : "No data"}
            </strong>
            {isDataStale(initialData.overview.operations.lastRunAt) && (
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
                <strong>{defaultWatchlist?.name ?? "Core Watchlist"}</strong>
                <span>{watchlistLoading ? "Loading..." : `${defaultWatchlist?.items.length ?? 0} tracked`}</span>
              </header>
              <div className="watchlist-form">
                <Input
                  className="text-input"
                  placeholder="New watchlist"
                  value={watchlistName}
                  onChange={(event) => setWatchlistName(event.target.value)}
                />
                <Button className="mini-action-button" disabled={actionPending} onClick={() => void handleCreateWatchlist()}>
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
                <Button className="mini-action-button" disabled={actionPending} onClick={() => void handleCreateAlert()}>
                  Alert
                </Button>
              </div>
              {defaultWatchlist ? (
                <div className="watchlist-form">
                  <Button
                    className="mini-action-button"
                    disabled={actionPending}
                    onClick={() => void handleCreateShare(defaultWatchlist, false)}
                  >
                    {actionPending ? "Sharing..." : "Private link"}
                  </Button>
                  <Button
                    className="mini-action-button"
                    disabled={actionPending}
                    onClick={() => void handleCreateShare(defaultWatchlist, true)}
                  >
                    {actionPending ? "Sharing..." : "Public link"}
                  </Button>
                </div>
              ) : null}
              {watchlistError ? <p className="source-error-copy">{watchlistError}</p> : null}
              {actionNotice ? <p className="action-success-notice">{actionNotice}</p> : null}
              {shareNotice ? <p className="source-summary-copy">{shareNotice}</p> : null}
              <div className="watchlist-items">
                {(defaultWatchlist?.items ?? []).slice(0, 5).map((item) => (
                  <Link className="watchlist-item" href={`/trends/${item.trendId}`} key={item.trendId}>
                    <span>{item.trendName}</span>
                  </Link>
                ))}
              </div>
              <div className="watchlist-items">
                {(defaultWatchlist?.shares ?? []).slice(0, 3).map((share) => (
                  <Link className="watchlist-item" href={`/shared/${share.shareToken}`} key={share.id}>
                    <span>{share.public ? "Public share" : "Private share"}</span>
                  </Link>
                ))}
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
                    <span>{watchlist.itemCount} tracked</span>
                  </header>
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
