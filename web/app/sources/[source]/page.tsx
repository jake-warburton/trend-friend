import Link from "next/link";
import { notFound } from "next/navigation";

import { loadSourceSummary } from "@/lib/trends";

type SourcePageProps = {
  params: Promise<{
    source: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function SourcePage({ params }: SourcePageProps) {
  const { source } = await params;
  const summary = await loadSourceSummary(source);

  if (summary === null) {
    notFound();
  }

  const maxItemCount = Math.max(...summary.runHistory.map((run) => run.itemCount), 1);
  const maxDurationMs = Math.max(...summary.runHistory.map((run) => run.durationMs), 1);
  const successfulRuns = summary.runHistory.filter((run) => run.success).length;

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
            <span>Latest item count</span>
            <strong>{summary.latestItemCount}</strong>
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
                {summary.runHistory.length === 0
                  ? "No runs"
                  : `${Math.round((successfulRuns / summary.runHistory.length) * 100)}%`}
              </strong>
            </article>
            <article className="source-metric-card">
              <span>Peak items</span>
              <strong>{maxItemCount}</strong>
            </article>
            <article className="source-metric-card">
              <span>Slowest run</span>
              <strong>{formatDuration(maxDurationMs)}</strong>
            </article>
          </div>

          <div className="source-run-chart">
            <div className="source-run-chart-header">
              <strong>Item volume</strong>
              <span>Recent runs</span>
            </div>
            <div className="source-run-bars">
              {summary.runHistory.map((run, index) => (
                <article className="source-run-bar-card" key={`items-${run.fetchedAt}-${index}`}>
                  <div
                    className={runBarClassName(run)}
                    style={{ height: `${Math.max((run.itemCount / maxItemCount) * 100, 14)}%` }}
                  />
                  <strong>{run.itemCount}</strong>
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
              {summary.runHistory.map((run, index) => (
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
            {summary.runHistory.map((run, index) => (
              <article className="detail-list-item" key={`${run.fetchedAt}-${index}`}>
                <div>
                  <strong>{formatTimestamp(run.fetchedAt)}</strong>
                  <span>
                    {run.success ? "Success" : "Failed"} · {run.itemCount} items ·{" "}
                    {formatDuration(run.durationMs)}
                  </span>
                </div>
                <small>{run.usedFallback ? "Fallback" : "Live"}</small>
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

function runBarClassName(run: { success: boolean; usedFallback: boolean }) {
  if (!run.success) {
    return "source-run-bar source-run-bar-failed";
  }
  if (run.usedFallback) {
    return "source-run-bar source-run-bar-fallback";
  }
  return "source-run-bar";
}
