import Link from "next/link";

import type { TrendDetailRecord } from "@/lib/types";
import { loadTrendDetails, loadTrendHistory } from "@/lib/trends";
import { TrendTrajectoryChart } from "@/components/trend-trajectory-chart";
import { buildComparisonSuggestions, slugifyBrowseValue } from "@/lib/trend-browse";
import { formatCategoryLabel } from "@/lib/category-labels";

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
  const [details, history] = await Promise.all([
    loadTrendDetails(),
    loadTrendHistory(),
  ]);
  const compared = details.trends.filter((trend) => uniqueIds.includes(trend.id));
  const suggestions = buildComparisonSuggestions(uniqueIds, details.trends);

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <p className="eyebrow">Compare</p>
          <h1>Trend Comparison</h1>
          <p className="detail-copy">
            Compare score, momentum, source mix, and history across up to three tracked trends.
          </p>
          {suggestions.length > 0 ? (
            <div className="detail-action-links">
              {suggestions.map((trend) => (
                <Link className="detail-back-link" href={`/compare?ids=${[...uniqueIds, trend.id].slice(0, 3).join(",")}`} key={trend.id}>
                  Add {trend.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {compared.length > 0 ? (
        <section className="compare-chart-section">
          <article className="detail-panel">
            <div className="section-heading">
              <h2>Score trajectories</h2>
            </div>
            <TrendTrajectoryChart
              trends={compared}
              history={history}
              limit={3}
            />
          </article>
        </section>
      ) : null}

      <section className="compare-grid">
        {compared.length === 0 ? (
          <article className="detail-panel compare-panel">
            <div className="section-heading">
              <div>
                <h2>Select trends to compare</h2>
              </div>
            </div>
            <p className="detail-copy">
              Start from any trend detail page or use one of the suggested compare links above.
            </p>
          </article>
        ) : null}
        {compared.map((trend) => {
          const topHistoryScore = Math.max(...trend.history.map((point) => point.scoreTotal), trend.score.total);
          return (
            <article className="detail-panel compare-panel" key={trend.id}>
              <div className="section-heading">
                <div>
                  <h2>{trend.name}</h2>
                  <p className="eyebrow">
                    {trend.metaTrend} · {formatCategoryLabel(trend.category)} · {Math.round(trend.confidence * 100)}% confidence
                  </p>
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
                {trend.duplicateCandidates.map((candidate) => (
                  <article className="detail-list-item" key={`${trend.id}-duplicate-${candidate.id}`}>
                    <div>
                      <strong>Possible duplicate: {candidate.name}</strong>
                      <span>{candidate.reason}</span>
                    </div>
                    <small>{Math.round(candidate.similarity * 100)}% overlap</small>
                  </article>
                ))}
                {trend.sourceBreakdown.map((source) => (
                  <article className="detail-list-item" key={`${trend.id}-${source.source}`}>
                    <div>
                      <strong>{formatSourceLabel(source.source)}</strong>
                      <span>{source.signalCount} signals</span>
                    </div>
                    <small>{formatTimestamp(source.latestSignalAt)}</small>
                  </article>
                ))}
                <article className="detail-list-item">
                  <div>
                    <strong>Browse from here</strong>
                    <span>
                      <Link href={`/meta-trends/${slugifyBrowseValue(trend.metaTrend)}`}>{trend.metaTrend}</Link>
                      {" · "}
                      <Link href={`/categories/${trend.category}`}>{formatCategoryLabel(trend.category)}</Link>
                    </span>
                  </div>
                </article>
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
  const labels: Record<string, string> = {
    chrome_web_store: "Chrome Web Store",
    curated_feeds: "Curated Feeds",
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
