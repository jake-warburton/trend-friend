import Link from "next/link";
import { notFound } from "next/navigation";

import { classifySourceYield, describeSourceYield, summarizeSourceYield } from "@/lib/source-yield";
import { filterAndSortSourceRuns, normalizeSourceRunFilter, normalizeSourceRunSort } from "@/lib/source-runs";
import { loadSourceSummary } from "@/lib/trends";

type SourcePageProps = {
  params: Promise<{
    source: string;
  }>;
  searchParams?: Promise<{
    filter?: string;
    sort?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function SourcePage({ params, searchParams }: SourcePageProps) {
  const { source } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const summary = await loadSourceSummary(source);

  if (summary === null) {
    notFound();
  }

  const selectedFilter = normalizeSourceRunFilter(resolvedSearchParams?.filter);
  const selectedSort = normalizeSourceRunSort(resolvedSearchParams?.sort);
  const visibleRuns = filterAndSortSourceRuns(summary.runHistory, selectedFilter, selectedSort);
  const maxItemCount = Math.max(...visibleRuns.map((run) => run.itemCount), 1);
  const maxDurationMs = Math.max(...visibleRuns.map((run) => run.durationMs), 1);
  const successfulRuns = visibleRuns.filter((run) => run.success).length;
  const runMix = buildRunMix(visibleRuns);
  const topTrendScore = Math.max(...summary.topTrends.map((trend) => trend.scoreTotal), 1);
  const filterHref = (filter: string, sort: string = selectedSort) =>
    buildSourcePageHref(source, {
      filter: filter === "all" ? null : filter,
      sort: sort === "newest" ? null : sort,
    });
  const sortHref = (sort: string) =>
    buildSourcePageHref(source, {
      filter: selectedFilter === "all" ? null : selectedFilter,
      sort: sort === "newest" ? null : sort,
    });

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/">
            Back to overview
          </Link>
          <p className="eyebrow">Source health</p>
          <h1>{formatSourceLabel(summary.source)}</h1>
          <p className="detail-copy">
            {summary.signalCount} signals across {summary.trendCount} trends. Latest fetch{" "}
            {summary.latestFetchAt ? formatTimestamp(summary.latestFetchAt) : "not recorded"}.
          </p>
        </div>

        <div className="detail-meta-grid">
          <div className="stat-card">
            <span>Status</span>
            <strong>{formatSourceStatus(summary.status)}</strong>
          </div>
          <div className="stat-card">
            <span>Yield</span>
            <strong>{summarizeSourceYield(summary)}</strong>
          </div>
          <div className="stat-card">
            <span>Yield quality</span>
            <strong>{classifySourceYield(summary)}</strong>
          </div>
          <div className="stat-card">
            <span>Duration</span>
            <strong>{formatDuration(summary.durationMs)}</strong>
          </div>
          <div className="stat-card">
            <span>Fallback</span>
            <strong>{summary.usedFallback ? "Used sample data" : "Live data"}</strong>
          </div>
        </div>
      </section>

      <section className="detail-grid">
        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Runs</p>
              <h2>Recent ingestion history</h2>
            </div>
          </div>

          <div className="source-metric-grid">
            <article className="source-metric-card">
              <span>Success rate</span>
              <strong>
                {visibleRuns.length === 0
                  ? "No runs"
                  : `${Math.round((successfulRuns / visibleRuns.length) * 100)}%`}
              </strong>
            </article>
            <article className="source-metric-card">
              <span>Peak kept items</span>
              <strong>{maxItemCount}</strong>
            </article>
            <article className="source-metric-card">
              <span>Latest raw fetch</span>
              <strong>{summary.rawItemCount}</strong>
            </article>
            <article className="source-metric-card">
              <span>Signals per kept item</span>
              <strong>{(summary.signalYieldRatio ?? 0).toFixed(2)}</strong>
            </article>
            <article className="source-metric-card">
              <span>Topic dupes</span>
              <strong>{summary.duplicateTopicRate.toFixed(1)}%</strong>
            </article>
            <article className="source-metric-card">
              <span>Slowest run</span>
              <strong>{formatDuration(maxDurationMs)}</strong>
            </article>
          </div>

          <p className="source-summary-copy">{describeSourceYield(summary)}</p>
          <p className="source-summary-copy">
            {summary.rawTopicCount} raw topics reduced to {summary.mergedTopicCount} merged topics in the latest run.
          </p>
          <div className="source-run-controls">
            <div className="source-run-control-group">
              {[
                ["all", "All runs"],
                ["healthy", "Healthy"],
                ["fallback", "Fallback"],
                ["failed", "Failed"],
              ].map(([value, label]) => (
                <Link
                  className={selectedFilter === value ? "source-run-filter source-run-filter-active" : "source-run-filter"}
                  href={filterHref(value)}
                  key={value}
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="source-run-control-group">
              {[
                ["newest", "Newest"],
                ["oldest", "Oldest"],
                ["slowest", "Slowest"],
                ["lowest_yield", "Lowest yield"],
              ].map(([value, label]) => (
                <Link
                  className={selectedSort === value ? "source-run-filter source-run-filter-active" : "source-run-filter"}
                  href={sortHref(value)}
                  key={value}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <p className="source-summary-copy">
            Showing {visibleRuns.length} of {summary.runHistory.length} runs.
          </p>

          <div className="source-run-chart">
            <div className="source-run-chart-header">
              <strong>Kept item volume</strong>
              <span>After dedupe and caps</span>
            </div>
            <div className="source-run-bars">
              {visibleRuns.map((run, index) => (
                <article className="source-run-bar-card" key={`items-${run.fetchedAt}-${index}`}>
                  <div
                    className={runBarClassName(run)}
                    style={{ height: `${Math.max((run.itemCount / maxItemCount) * 100, 14)}%` }}
                  />
                  <strong>{run.keptItemCount}</strong>
                  <span>{formatShortDate(run.fetchedAt)}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="source-run-chart">
            <div className="source-run-chart-header">
              <strong>Yield rate</strong>
              <span>Kept versus raw fetched</span>
            </div>
            <div className="source-run-bars">
              {visibleRuns.map((run, index) => (
                <article className="source-run-bar-card" key={`yield-${run.fetchedAt}-${index}`}>
                  <div
                    className={runBarClassName(run)}
                    style={{ height: `${Math.max(run.yieldRatePercent, 14)}%` }}
                  />
                  <strong>{formatPercent(run.yieldRatePercent)}</strong>
                  <span>{formatShortDate(run.fetchedAt)}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="source-run-chart">
            <div className="source-run-chart-header">
              <strong>Fetch duration</strong>
              <span>Recent runs</span>
            </div>
            <div className="source-run-bars">
              {visibleRuns.map((run, index) => (
                <article className="source-run-bar-card" key={`duration-${run.fetchedAt}-${index}`}>
                  <div
                    className={runBarClassName(run)}
                    style={{ height: `${Math.max((run.durationMs / maxDurationMs) * 100, 14)}%` }}
                  />
                  <strong>{formatCompactDuration(run.durationMs)}</strong>
                  <span>{formatShortDate(run.fetchedAt)}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="detail-list">
            {visibleRuns.map((run, index) => (
              <article className="detail-list-item" key={`${run.fetchedAt}-${index}`}>
                <div>
                  <strong>{formatTimestamp(run.fetchedAt)}</strong>
                  <span>
                    {run.success ? "Success" : "Failed"} · {run.keptItemCount}/{run.rawItemCount} kept ·{" "}
                    {formatDuration(run.durationMs)}
                  </span>
                </div>
                <small>{run.usedFallback ? "Fallback" : formatPercent(run.yieldRatePercent)}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Contribution</p>
              <h2>Top linked trends</h2>
            </div>
          </div>

          <div className="pie-chart-wrap source-detail-chart-wrap">
            <div className="pie-chart" style={{ background: buildRunMixGradient(runMix) }} />
            <div className="pie-chart-legend">
              {runMix.map((item) => (
                <div className="pie-legend-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="mini-bar-list source-trend-bars">
            {summary.topTrends.map((trend) => (
              <div className="mini-bar-row" key={`bar-${trend.id}`}>
                <span>{trend.name}</span>
                <div className="mini-bar-track">
                  <div
                    className="mini-bar-fill"
                    style={{ width: `${Math.max((trend.scoreTotal / topTrendScore) * 100, 10)}%` }}
                  />
                </div>
                <strong>{trend.scoreTotal.toFixed(1)}</strong>
              </div>
            ))}
          </div>

          <div className="detail-list">
            {summary.topTrends.map((trend) => (
              <article className="detail-list-item" key={trend.id}>
                <div>
                  <strong>
                    <Link className="trend-link" href={`/trends/${trend.id}`}>
                      {trend.name}
                    </Link>
                  </strong>
                  <span>Rank #{trend.rank}</span>
                </div>
                <small>{trend.scoreTotal.toFixed(1)}</small>
              </article>
            ))}
          </div>
        </section>

        {summary.errorMessage ? (
          <section className="detail-panel detail-panel-wide">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Failure context</p>
                <h2>Latest error</h2>
              </div>
            </div>
            <p className="source-error-copy">{summary.errorMessage}</p>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function formatSourceLabel(source: string) {
  const labels: Record<string, string> = {
    devto: "DEV Community",
    google_trends: "Google Trends",
    hacker_news: "Hacker News",
    huggingface: "Hugging Face",
    pypi: "PyPI",
    stackoverflow: "Stack Overflow",
    twitter: "Twitter/X",
    youtube: "YouTube",
  };
  if (labels[source]) {
    return labels[source];
  }
  return source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(durationMs: number) {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${durationMs}ms`;
}

function formatCompactDuration(durationMs: number) {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${durationMs}ms`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function buildSourcePageHref(
  source: string,
  options: { filter: string | null; sort: string | null },
) {
  const params = new URLSearchParams();
  if (options.filter) {
    params.set("filter", options.filter);
  }
  if (options.sort) {
    params.set("sort", options.sort);
  }
  const query = params.toString();
  return query.length > 0 ? `/sources/${encodeURIComponent(source)}?${query}` : `/sources/${encodeURIComponent(source)}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }
  if (Math.abs(value - Math.round(value)) < 0.05) {
    return `${Math.round(value)}%`;
  }
  return `${value.toFixed(1)}%`;
}

function runBarClassName(run: { success: boolean; usedFallback: boolean }) {
  if (!run.success) {
    return "source-run-bar source-run-bar-failed";
  }
  if (run.usedFallback) {
    return "source-run-bar source-run-bar-fallback";
  }
  return "source-run-bar";
}

function buildRunMix(
  runs: Array<{ success: boolean; usedFallback: boolean }>,
): Array<{ label: string; value: number }> {
  const healthy = runs.filter((run) => run.success && !run.usedFallback).length;
  const degraded = runs.filter((run) => run.success && run.usedFallback).length;
  const failed = runs.filter((run) => !run.success).length;
  return [
    { label: "Healthy", value: healthy },
    { label: "Degraded", value: degraded },
    { label: "Failed", value: failed },
  ].filter((item) => item.value > 0);
}

function buildRunMixGradient(dataset: Array<{ label: string; value: number }>) {
  const total = dataset.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return "conic-gradient(#182947 0deg 360deg)";
  }

  const colorByLabel: Record<string, string> = {
    Healthy: "#5e6bff",
    Degraded: "#ffca6e",
    Failed: "#ff8b8b",
  };

  let angle = 0;
  const segments = dataset.map((item) => {
    const nextAngle = angle + (item.value / total) * 360;
    const segment = `${colorByLabel[item.label] ?? "#00c4ff"} ${angle}deg ${nextAngle}deg`;
    angle = nextAngle;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}
