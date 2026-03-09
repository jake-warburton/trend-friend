import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTrendDetail } from "@/lib/trends";

type TrendDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TrendDetailPage({ params }: TrendDetailPageProps) {
  const { slug } = await params;
  const trend = await loadTrendDetail(slug);

  if (trend === null) {
    notFound();
  }

  const topHistoryScore = Math.max(...trend.history.map((point) => point.scoreTotal), trend.score.total);

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/">
            Back to explorer
          </Link>
          <p className="eyebrow">Trend detail</p>
          <span className={trendStatusClassName(trend.status)}>{formatTrendStatus(trend.status)}</span>
          <h1>{trend.name}</h1>
          <p className="detail-copy">
            Rank #{trend.rank} with {trend.coverage.signalCount} captured signals across{" "}
            {trend.coverage.sourceCount} sources.
          </p>
        </div>

        <div className="detail-meta-grid">
          <div className="stat-card">
            <span>Total score</span>
            <strong>{trend.score.total.toFixed(1)}</strong>
          </div>
          <div className="stat-card">
            <span>Movement</span>
            <strong>{formatRankChange(trend.rankChange)}</strong>
          </div>
          <div className="stat-card">
            <span>Momentum</span>
            <strong>{formatMomentum(trend.momentum.percentDelta)}</strong>
          </div>
          <div className="stat-card">
            <span>First seen</span>
            <strong>{trend.firstSeenAt ? formatDateOnly(trend.firstSeenAt) : "This run"}</strong>
          </div>
        </div>
      </section>

      <section className="detail-grid">
        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">History</p>
              <h2>Score and rank progression</h2>
            </div>
          </div>

          <div className="history-bars">
            {trend.history.map((point) => (
              <article className="history-bar-card" key={point.capturedAt}>
                <header>
                  <strong>{formatDateOnly(point.capturedAt)}</strong>
                  <span>Rank #{point.rank}</span>
                </header>
                <div className="history-bar-track">
                  <div
                    className="history-bar-fill"
                    style={{ width: `${(point.scoreTotal / topHistoryScore) * 100}%` }}
                  />
                </div>
                <strong>{point.scoreTotal.toFixed(1)}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Coverage</p>
              <h2>Source breakdown</h2>
            </div>
          </div>

          <div className="detail-list">
            {trend.sourceBreakdown.map((source) => (
              <article className="detail-list-item" key={source.source}>
                <div>
                  <strong>{formatSourceLabel(source.source)}</strong>
                  <span>{source.signalCount} signals</span>
                </div>
                <small>{formatTimestamp(source.latestSignalAt)}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel detail-panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Evidence</p>
              <h2>Recent signals</h2>
            </div>
          </div>

          <div className="detail-list">
            {trend.evidenceItems.map((item, index) => (
              <article className="detail-list-item detail-evidence-item" key={`${item.timestamp}-${index}`}>
                <div>
                  <strong>{item.evidence}</strong>
                  <span>
                    {formatSourceLabel(item.source)} · {formatSignalType(item.signalType)} · Value{" "}
                    {item.value.toFixed(1)}
                  </span>
                </div>
                <small>{formatTimestamp(item.timestamp)}</small>
              </article>
            ))}
          </div>
        </section>
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

function formatSignalType(signalType: string) {
  return signalType.charAt(0).toUpperCase() + signalType.slice(1);
}

function formatRankChange(value: number | null) {
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

function formatMomentum(value: number | null) {
  if (value == null) {
    return "No prior run";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
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
