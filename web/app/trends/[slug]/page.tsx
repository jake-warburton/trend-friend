import Link from "next/link";
import { notFound } from "next/navigation";

import type { TrendDetailRecord } from "@/lib/types";
import { getPrimaryEvidenceLink } from "@/lib/evidence-links";
import { loadTrendDetail } from "@/lib/trends";
import { formatForecastMethod, summarizeForecastWindow } from "@/lib/forecast-ui";
import { getSeasonalityBadge, summarizeSeasonality } from "@/lib/seasonality-ui";
import { getWikipediaLinkFromDetail, loadWikipediaSummary } from "@/lib/wikipedia";
import { TrendScoreChart } from "@/components/trend-score-chart";
import { ScoreBreakdownChart } from "@/components/score-breakdown-chart";
import { GeoMap } from "@/components/geo-map";

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

  const geoSummary = trend.geoSummary ?? [];
  const seasonalityBadge = getSeasonalityBadge(trend.seasonality);
  const primaryEvidenceLink = getPrimaryEvidenceLink(trend);
  const wikipediaLink = getWikipediaLinkFromDetail(trend);
  const wikipediaSummary = wikipediaLink ? await loadWikipediaSummary(wikipediaLink.title) : null;

  return (
    <main className="detail-page">
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/">
            Back to explorer
          </Link>
          <p className="eyebrow">Trend detail</p>
          <div className="detail-pill-row">
            <span className="trend-date-chip">{formatCategory(trend.category)}</span>
            <span className={trendStatusClassName(trend.status)}>{formatTrendStatus(trend.status)}</span>
            <span className={volatilityClassName(trend.volatility)}>{formatVolatility(trend.volatility)}</span>
            {seasonalityBadge ? (
              <span className={`seasonality-badge seasonality-badge-${seasonalityBadge.tone}`}>
                {seasonalityBadge.label}
              </span>
            ) : null}
          </div>
          <h1>{trend.name}</h1>
          <p className="detail-copy">
            Rank #{trend.rank} with {trend.coverage.signalCount} captured signals across{" "}
            {trend.coverage.sourceCount} sources.
          </p>
          {wikipediaLink ? (
            <a className="detail-back-link" href={wikipediaLink.url} rel="noreferrer" target="_blank">
              Open Wikipedia page for {wikipediaLink.title}
            </a>
          ) : null}
          {primaryEvidenceLink?.evidenceUrl ? (
            <a className="detail-back-link" href={primaryEvidenceLink.evidenceUrl} rel="noreferrer" target="_blank">
              Open source item from {formatSourceLabel(primaryEvidenceLink.source)}
            </a>
          ) : null}
          {trend.relatedTrends[0] ? (
            <Link className="detail-back-link" href={`/compare?ids=${trend.id},${trend.relatedTrends[0].id}`}>
              Compare with {trend.relatedTrends[0].name}
            </Link>
          ) : null}
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
        <section className="detail-panel detail-panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">History</p>
              <h2>Score trajectory</h2>
            </div>
          </div>

          <TrendScoreChart history={trend.history} currentScore={trend.score.total} forecast={trend.forecast} />
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Score</p>
              <h2>Component breakdown</h2>
            </div>
          </div>

          <ScoreBreakdownChart score={trend.score} />
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Opportunity</p>
              <h2>What you can do with it</h2>
            </div>
          </div>

          <div className="detail-list">
            <article className="detail-list-item">
              <div>
                <strong>Composite {formatOpportunityScore(trend.opportunity.composite)}</strong>
                <span>
                  Content {formatOpportunityScore(trend.opportunity.content)} · Product{" "}
                  {formatOpportunityScore(trend.opportunity.product)} · Investment{" "}
                  {formatOpportunityScore(trend.opportunity.investment)}
                </span>
              </div>
              <small>{formatPredictionDirection(trend.breakoutPrediction.predictedDirection)}</small>
            </article>
            {trend.opportunity.reasoning.map((reason) => (
              <article className="detail-list-item" key={reason}>
                <div>
                  <strong>{reason}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Prediction</p>
              <h2>Breakout outlook</h2>
            </div>
          </div>

          <div className="detail-list">
            <article className="detail-list-item">
              <div>
                <strong>
                  {formatPredictionDirection(trend.breakoutPrediction.predictedDirection)} ·{" "}
                  {Math.round(trend.breakoutPrediction.confidence * 100)}% confidence
                </strong>
                <span>
                  {trend.breakoutPrediction.signals.length > 0
                    ? trend.breakoutPrediction.signals.join(" · ")
                    : "No strong momentum signals"}
                </span>
              </div>
            </article>
            {trend.forecast ? (
              <article className="detail-list-item">
                <div>
                  <strong>{summarizeForecastWindow(trend.forecast)}</strong>
                  <span>
                    {formatForecastMethod(trend.forecast.method)} · {trend.forecast.mape.toFixed(1)}% backtest error
                  </span>
                </div>
                <small>
                  {trend.forecast.predictedScores[0]?.toFixed(1)} to{" "}
                  {trend.forecast.predictedScores[trend.forecast.predictedScores.length - 1]?.toFixed(1)} projected
                </small>
              </article>
            ) : null}
            {trend.seasonality ? (
              <article className="detail-list-item">
                <div>
                  <strong>{seasonalityBadge?.label ?? "Seasonality"}</strong>
                  <span>{summarizeSeasonality(trend.seasonality)}</span>
                </div>
                <small>{Math.round(trend.seasonality.confidence * 100)}% confidence</small>
              </article>
            ) : null}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sources</p>
              <h2>What is driving this rank</h2>
            </div>
          </div>

          <div className="detail-list">
            {trend.sourceContributions.map((source) => (
              <article className="detail-list-item" key={source.source}>
                <div>
                  <strong>{formatSourceLabel(source.source)}</strong>
                  <span>
                    {source.signalCount} signals · {source.scoreSharePercent.toFixed(1)}% est. score share
                  </span>
                  <span>{formatContributionMix(source)}</span>
                </div>
                <small>
                  {source.estimatedScore.toFixed(1)} pts · {formatTimestamp(source.latestSignalAt)}
                </small>
              </article>
            ))}
          </div>
        </section>

        {wikipediaLink ? (
          <section className="detail-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Wikipedia</p>
                <h2>Knowledge context</h2>
              </div>
            </div>

            <div className="detail-list">
              <article className="detail-list-item">
                <div>
                  <strong>
                    <a className="trend-link" href={wikipediaLink.url} rel="noreferrer" target="_blank">
                      {wikipediaLink.title}
                    </a>
                  </strong>
                  <span>
                    {wikipediaSummary ??
                      "This trend includes a Wikipedia pageview signal. Treat it as context unless other sources also move."}
                  </span>
                </div>
              </article>
            </div>
          </section>
        ) : null}

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Related</p>
              <h2>Adjacent trends</h2>
            </div>
          </div>

          <div className="detail-list">
            {trend.relatedTrends.map((item) => (
              <article className="detail-list-item" key={item.id}>
                <div>
                  <strong>
                    <Link className="trend-link" href={`/trends/${item.id}`}>
                      {item.name}
                    </Link>
                  </strong>
                  <span>{formatTrendStatus(item.status)}</span>
                </div>
                <small>
                  <Link className="trend-link" href={`/compare?ids=${trend.id},${item.id}`}>
                    Compare
                  </Link>{" "}
                  · #{item.rank} · {item.scoreTotal.toFixed(1)}
                </small>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel detail-panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Geo</p>
              <h2>Where it is showing up</h2>
            </div>
          </div>

          {geoSummary.length === 0 ? (
            <p className="chart-empty">No location signals yet.</p>
          ) : (
            <>
              <GeoMap data={geoSummary} />
              <div className="geo-legend">
                {geoSummary.map((item) => (
                  <div className="geo-legend-item" key={`${item.label}-${item.countryCode ?? "none"}`}>
                    <strong>{item.label}</strong>
                    <small>{item.signalCount} signals · {Math.round(item.averageConfidence * 100)}%</small>
                  </div>
                ))}
              </div>
            </>
          )}
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
                  <strong>
                    {item.evidenceUrl ? (
                      <a className="trend-link" href={item.evidenceUrl} rel="noreferrer" target="_blank">
                        {item.evidence}
                      </a>
                    ) : (
                      item.evidence
                    )}
                  </strong>
                  <span>
                    {formatSourceLabel(item.source)} · {formatSignalType(item.signalType)} · Value{" "}
                    {item.value.toFixed(1)}
                  </span>
                  {item.geoDetectionMode !== "unknown" ? (
                    <span>
                      {formatGeoLabel(item)} · {item.geoDetectionMode} · {Math.round(item.geoConfidence * 100)}%
                    </span>
                  ) : null}
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

function formatCategory(category: string) {
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSignalType(signalType: string) {
  return signalType.charAt(0).toUpperCase() + signalType.slice(1);
}

function formatOpportunityScore(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatPredictionDirection(direction: string) {
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

function formatContributionMix(source: TrendDetailRecord["sourceContributions"][number]) {
  const componentScores: Array<[string, number]> = [
    ["Social", source.score.social],
    ["Developer", source.score.developer],
    ["Knowledge", source.score.knowledge],
    ["Search", source.score.search],
    ["Diversity", source.score.diversity],
  ];

  const components = componentScores
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label, value]) => `${label} ${value.toFixed(1)}`);

  if (components.length === 0) {
    return "No attributed score contribution";
  }
  return components.join(" · ");
}

function formatGeoLabel(item: {
  geoCountryCode: string | null;
  geoRegion: string | null;
}) {
  if (item.geoRegion && item.geoCountryCode && item.geoRegion !== item.geoCountryCode) {
    return `${item.geoRegion} (${item.geoCountryCode})`;
  }
  if (item.geoRegion) {
    return item.geoRegion;
  }
  if (item.geoCountryCode) {
    return item.geoCountryCode;
  }
  return "Unknown location";
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
