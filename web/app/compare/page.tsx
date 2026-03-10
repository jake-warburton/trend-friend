import Link from "next/link";

import type { TrendDetailRecord } from "@/lib/types";
import { loadTrendDetails } from "@/lib/trends";

type ComparePageProps = {
  searchParams: Promise<{
    ids?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const ids = Array.isArray(params.ids)
    ? params.ids.flatMap((item) => item.split(","))
    : typeof params.ids === "string"
      ? params.ids.split(",")
      : [];

  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 3);
  const details = await loadTrendDetails();
  const compared = details.trends.filter((trend) => uniqueIds.includes(trend.id));

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/">
            Back to explorer
          </Link>
          <p className="eyebrow">Compare</p>
          <h1>Trend Comparison</h1>
          <p className="detail-copy">
            Compare score, momentum, source mix, and history across up to three tracked trends.
          </p>
        </div>
      </section>

      <section className="compare-grid">
        {compared.map((trend) => {
          const topHistoryScore = Math.max(...trend.history.map((point) => point.scoreTotal), trend.score.total);
          return (
            <article className="detail-panel compare-panel" key={trend.id}>
              <div className="section-heading">
                <div>
                  <h2>{trend.name}</h2>
                </div>
                <span className={trendStatusClassName(trend.status)}>{formatTrendStatus(trend.status)}</span>
              </div>

              <div className="compare-stat-grid">
                <div className="stat-card">
                  <span>Rank</span>
                  <strong>#{trend.rank}</strong>
                </div>
                <div className="stat-card">
                  <span>Score</span>
                  <strong>{trend.score.total.toFixed(1)}</strong>
                </div>
                <div className="stat-card">
                  <span>Move</span>
                  <strong>{formatRankChange(trend.rankChange)}</strong>
                </div>
                <div className="stat-card">
                  <span>Volatility</span>
                  <strong>{formatVolatility(trend.volatility)}</strong>
                </div>
              </div>

              <div className="mini-bar-list">
                {buildScoreMix(trend).map((item) => (
                  <div className="mini-bar-row" key={`${trend.id}-${item.label}`}>
                    <span>{item.label}</span>
                    <div className="mini-bar-track">
                      <div
                        className="mini-bar-fill"
                        style={{ width: `${(item.value / trend.score.total) * 100}%` }}
                      />
                    </div>
                    <strong>{item.value.toFixed(1)}</strong>
                  </div>
                ))}
              </div>

              <div className="history-bars compare-history-bars">
                {trend.history.map((point) => (
                  <article className="history-bar-card" key={`${trend.id}-${point.capturedAt}`}>
                    <header>
                      <strong>{formatDateOnly(point.capturedAt)}</strong>
                      <span>#{point.rank}</span>
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

              <div className="detail-list">
                {trend.sourceBreakdown.map((source) => (
                  <article className="detail-list-item" key={`${trend.id}-${source.source}`}>
                    <div>
                      <strong>{formatSourceLabel(source.source)}</strong>
                      <span>{source.signalCount} signals</span>
                    </div>
                    <small>{formatTimestamp(source.latestSignalAt)}</small>
                  </article>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function buildScoreMix(trend: TrendDetailRecord) {
  return [
    { label: "Social", value: trend.score.social },
    { label: "Developer", value: trend.score.developer },
    { label: "Knowledge", value: trend.score.knowledge },
    { label: "Diversity", value: trend.score.diversity },
    { label: "Search", value: trend.score.search },
  ].filter((item) => item.value > 0);
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
