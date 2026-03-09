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

function formatSourceStatus(status: string) {
  if (status === "healthy") {
    return "Healthy";
  }
  if (status === "degraded") {
    return "Degraded";
  }
  return "Stale";
}
