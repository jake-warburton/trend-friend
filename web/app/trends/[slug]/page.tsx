import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import type { TrendDetailRecord, TrendHistoryPoint, TrendRecord } from "@/lib/types";
import { formatCategoryLabel } from "@/lib/category-labels";
import { getPrimaryEvidenceLink } from "@/lib/evidence-links";
import { ESTIMATED_METRICS_COOKIE, readEstimatedMetricsPreference } from "@/lib/settings";
import { slugifyBrowseValue } from "@/lib/trend-browse";
import { loadSourceSummaries, loadTrendDetail, loadTrendHistory } from "@/lib/trends";
import { formatForecastMethod, summarizeForecastWindow } from "@/lib/forecast-ui";
import { getSeasonalityBadge, summarizeSeasonality } from "@/lib/seasonality-ui";
import {
  buildSourceContributionInsights,
  formatSourceLabel,
  getSourceFreshnessBadge,
  summarizeTopSourceDrivers,
} from "@/lib/source-health";
import { getWikipediaLinkFromDetail, loadWikipediaSummary } from "@/lib/wikipedia";
import { TrendScoreChart } from "@/components/trend-score-chart";
import { ScoreBreakdownChart } from "@/components/score-breakdown-chart";
import { GeoMapClient } from "@/components/geo-map-client";

type TrendDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TrendDetailPage({ params }: TrendDetailPageProps) {
  const { slug } = await params;
  let showEstimatedMetrics = true;
  try {
    const cookieStore = await cookies();
    showEstimatedMetrics = readEstimatedMetricsPreference(cookieStore.get(ESTIMATED_METRICS_COOKIE)?.value);
  } catch {
    showEstimatedMetrics = true;
  }
  const [trend, history, sourceSummary] = await Promise.all([
    loadTrendDetail(slug),
    loadTrendHistory(),
    loadSourceSummaries(),
  ]);

  if (trend === null) {
    const recentTrend = findRecentTrendSnapshot(history, slug);
    if (recentTrend != null) {
      const historyPoints = buildRecentTrendHistory(history, slug);
      return (
        <main className="detail-page">
          <section className="detail-hero">
            <div>
              <Link className="detail-back-link" href="/">
                Back to explorer
              </Link>
              <p className="eyebrow">Trend detail</p>
              <div className="detail-pill-row">
                <span className="trend-date-chip">Recent snapshot</span>
                <span className="trend-date-chip">No longer in the live ranking</span>
              </div>
              <h1>{recentTrend.record.name}</h1>
              <p className="detail-copy">
                Last seen at rank #{recentTrend.rank} on {formatTimestamp(recentTrend.capturedAt)} across{" "}
                {recentTrend.record.sources.length} source{recentTrend.record.sources.length === 1 ? "" : "s"}.
              </p>
            </div>

            <div className="detail-meta-grid">
              <div className="detail-stat-item">
                <span>Total score</span>
                <strong>{recentTrend.record.score.total.toFixed(1)}</strong>
              </div>
              <div className="detail-stat-item">
                <span>Last rank</span>
                <strong>#{recentTrend.rank}</strong>
              </div>
              <div className="detail-stat-item">
                <span>Sources</span>
                <strong>{recentTrend.record.sources.length}</strong>
              </div>
              <div className="detail-stat-item">
                <span>Last signal</span>
                <strong>{formatDateOnly(recentTrend.record.latestSignalAt)}</strong>
              </div>
            </div>
          </section>

          <section className="detail-grid">
            <section className="detail-panel detail-panel-wide">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">History</p>
                  <h2>Recent score trajectory</h2>
                </div>
              </div>
              <TrendScoreChart history={historyPoints} currentScore={recentTrend.record.score.total} />
            </section>

            <section className="detail-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Score</p>
                  <h2>Component breakdown</h2>
                </div>
              </div>
              <ScoreBreakdownChart score={recentTrend.record.score} />
            </section>

            <section className="detail-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Sources</p>
                  <h2>Last known drivers</h2>
                </div>
              </div>
              <div className="detail-list">
                {recentTrend.record.sources.map((source) => (
                  <article className="detail-list-item" key={source}>
                    <div>
                      <strong>{formatSourceLabel(source)}</strong>
                      <span>Present in the latest recent snapshot for this trend</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="detail-panel detail-panel-wide">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Evidence</p>
                  <h2>Last captured signals</h2>
                </div>
              </div>
              <div className="detail-list">
                {recentTrend.record.evidence.map((item, index) => (
                  <article className="detail-list-item detail-evidence-item" key={`${recentTrend.capturedAt}-${index}`}>
                    <div>
                      <strong>{item}</strong>
                      <span>{formatTimestamp(recentTrend.record.latestSignalAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </main>
      );
    }
    notFound();
  }

  const geoSummary = trend.geoSummary ?? [];
  const audienceSummary = trend.audienceSummary ?? [];
  const seasonalityBadge = getSeasonalityBadge(trend.seasonality);
  const primaryEvidenceLink = getPrimaryEvidenceLink(trend);
  const wikipediaLink = getWikipediaLinkFromDetail(trend);
  const wikipediaSummary = wikipediaLink ? await loadWikipediaSummary(wikipediaLink.title) : null;
  const sourceInsights = buildSourceContributionInsights(trend.sourceContributions, sourceSummary.sources);
  const visibleMarketFootprint = showEstimatedMetrics
    ? trend.marketFootprint
    : trend.marketFootprint.filter((metric) => !metric.isEstimated);

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
            <span className="trend-date-chip">{trend.metaTrend}</span>
            <span className="trend-date-chip">{formatLabel(trend.stage)}</span>
            <span className="trend-date-chip">{Math.round(trend.confidence * 100)}% confidence</span>
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
          {trend.summary ? <p className="detail-copy">{trend.summary}</p> : null}
          {wikipediaLink || primaryEvidenceLink?.evidenceUrl || trend.relatedTrends[0] ? (
            <div className="detail-action-links">
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
              <Link className="detail-back-link" href={`/meta-trends/${slugifyBrowseValue(trend.metaTrend)}`}>
                Browse {trend.metaTrend}
              </Link>
              <Link className="detail-back-link" href={`/categories/${trend.category}`}>
                Browse {formatCategory(trend.category)}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="detail-meta-grid">
          <div className="detail-stat-item">
            <span>Total score</span>
            <strong>{trend.score.total.toFixed(1)}</strong>
          </div>
          <div className="detail-stat-item">
            <span>Movement</span>
            <strong>{formatRankChange(trend.rankChange)}</strong>
          </div>
          <div className="detail-stat-item">
            <span>Momentum</span>
            <strong>{formatMomentum(trend.momentum.percentDelta)}</strong>
          </div>
          <div className="detail-stat-item">
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

        <section className="detail-panel detail-panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Market footprint</p>
              <h2>Platform signals</h2>
            </div>
          </div>

          {visibleMarketFootprint.length > 0 ? (
            <div className="market-footprint-grid">
              {visibleMarketFootprint.map((metric) => {
                const freshness = formatDateOnly(metric.capturedAt);
                return (
                  <article className="market-footprint-card" key={`${metric.source}-${metric.metricKey}`}>
                    <div className="market-footprint-card-header">
                      <span>{formatSourceLabel(metric.source)}</span>
                      {metric.isEstimated ? <small>Estimated</small> : null}
                    </div>
                    <strong>{metric.valueDisplay}</strong>
                    <p>{metric.label}</p>
                    <small>
                      {metric.period} · {Math.round(metric.confidence * 100)}% confidence · Updated {freshness}
                    </small>
                    {metric.provenanceUrl ? (
                      <a className="detail-back-link market-footprint-link" href={metric.provenanceUrl} rel="noreferrer" target="_blank">
                        Open source
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : trend.marketFootprint.length > 0 && !showEstimatedMetrics ? (
            <p className="detail-copy">
              Estimated market metrics are currently hidden. Change this in <Link className="trend-link" href="/settings">Settings</Link>.
            </p>
          ) : (
            <p className="detail-copy">
              Market footprint enrichment is still sparse for this trend. Source-level metrics will appear here as
              more platform evidence is captured.
            </p>
          )}
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Why now</p>
              <h2>Current rationale</h2>
            </div>
          </div>

          <div className="detail-list">
            {trend.whyNow.map((reason, index) => (
              <article className="detail-list-item" key={`${trend.id}-why-now-${index}`}>
                <div>
                  <strong>Signal {index + 1}</strong>
                  <span>{reason}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Canonicalization</p>
              <h2>Tracked aliases</h2>
            </div>
          </div>

          <div className="detail-list">
            {(trend.aliases.length > 0 ? trend.aliases : [trend.name]).map((alias) => (
              <article className="detail-list-item" key={`${trend.id}-alias-${alias}`}>
                <div>
                  <strong>{alias}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quality</p>
              <h2>Potential duplicates</h2>
            </div>
          </div>

          <div className="detail-list">
            {(trend.duplicateCandidates.length > 0 ? trend.duplicateCandidates : []).map((candidate) => (
              <article className="detail-list-item" key={`${trend.id}-duplicate-${candidate.id}`}>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.reason}</span>
                </div>
                <small>{Math.round(candidate.similarity * 100)}% overlap</small>
              </article>
            ))}
            {trend.duplicateCandidates.length === 0 ? (
              <article className="detail-list-item">
                <div>
                  <strong>No close duplicates flagged</strong>
                  <span>This trend currently looks distinct from the rest of the published set.</span>
                </div>
              </article>
            ) : null}
          </div>
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
                  Discovery {formatOpportunityScore(trend.opportunity.discovery)} · SEO{" "}
                  {formatOpportunityScore(trend.opportunity.seo)} · Content {formatOpportunityScore(trend.opportunity.content)} · Product{" "}
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

          <p className="source-summary-copy detail-source-summary">
            {summarizeTopSourceDrivers(trend.sourceContributions)}
          </p>
          <div className="detail-list">
            {sourceInsights.map((source) => (
              <article className="detail-list-item detail-list-item-source" key={source.source}>
                <div>
                  <strong>{source.title}</strong>
                  <span>
                    {source.signalCount} signals · {source.scoreSharePercent.toFixed(1)}% est. score share
                  </span>
                  <span>{source.mixSummary}</span>
                  <span>{source.fetchSummary}</span>
                  {source.warning ? <span className="source-warning-copy">{source.warning}</span> : null}
                </div>
                <small>
                  <span className={contributionHealthClassName(source.status)}>{source.statusLabel}</span>
                  {(() => {
                    const freshness = getSourceFreshnessBadge(source.fetchedAt);
                    return freshness ? (
                      <span className={`source-freshness-badge source-freshness-badge-${freshness.tone}`}>
                        {freshness.label}
                      </span>
                    ) : null;
                  })()}
                  {source.fetchedAt ? ` · ${formatTimestamp(source.fetchedAt)}` : ""}
                  {` · ${source.estimatedScore.toFixed(1)} pts · ${formatTimestamp(source.latestSignalAt)}`}
                </small>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Audience</p>
              <h2>Who and where this seems relevant</h2>
            </div>
          </div>

          <div className="detail-list">
            {audienceSummary.length === 0 ? (
              <article className="detail-list-item">
                <div>
                  <strong>No audience or market signals yet</strong>
                  <span>We only show conservative non-sensitive segments like developer, founder, B2B, or region-led demand.</span>
                </div>
              </article>
            ) : (
              audienceSummary.map((item) => (
                <article className="detail-list-item" key={`${item.segmentType}-${item.label}`}>
                  <div>
                    <strong>{formatAudienceSegment(item)}</strong>
                    <span>{formatAudienceSegmentType(item.segmentType)}</span>
                  </div>
                  <small>{item.signalCount} signals</small>
                </article>
              ))
            )}
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
                  <span>{formatTrendStatus(item.status)} · {Math.round(item.relationshipStrength * 100)}% related</span>
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
              <GeoMapClient data={geoSummary} />
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
                  {(item.audienceFlags?.length ?? 0) > 0 || (item.marketFlags?.length ?? 0) > 0 || item.languageCode ? (
                    <span>{formatEvidenceAudience(item)}</span>
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

function findRecentTrendSnapshot(
  history: Awaited<ReturnType<typeof loadTrendHistory>>,
  slug: string,
): { capturedAt: string; rank: number; record: TrendRecord } | null {
  for (const snapshot of history.snapshots) {
    const record = snapshot.trends.find((trend) => trend.id === slug);
    if (record != null) {
      return {
        capturedAt: snapshot.capturedAt,
        rank: record.rank,
        record,
      };
    }
  }
  return null;
}

function buildRecentTrendHistory(
  history: Awaited<ReturnType<typeof loadTrendHistory>>,
  slug: string,
): TrendHistoryPoint[] {
  const points: TrendHistoryPoint[] = [];
  for (const snapshot of history.snapshots) {
    const record = snapshot.trends.find((trend) => trend.id === slug);
    if (record != null) {
      points.push({
        rank: record.rank,
        capturedAt: snapshot.capturedAt,
        scoreTotal: record.score.total,
      });
    }
  }
  return points;
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatCategory(category: string) {
  return formatCategoryLabel(category);
}

function formatLabel(value: string) {
  return value
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function formatSignalType(signalType: string) {
  return signalType.charAt(0).toUpperCase() + signalType.slice(1);
}

function formatOpportunityScore(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatPredictionDirection(direction: string) {
  if (direction === "experimental") {
    return "Experimental";
  }
  return direction.charAt(0).toUpperCase() + direction.slice(1);
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

function formatAudienceSegment(item: TrendDetailRecord["audienceSummary"][number]) {
  if (item.segmentType === "language") {
    return `Language: ${item.label}`;
  }
  return formatCategory(item.label);
}

function formatAudienceSegmentType(segmentType: string) {
  if (segmentType === "audience") {
    return "Audience segment";
  }
  if (segmentType === "market") {
    return "Market segment";
  }
  return "Language";
}

function formatEvidenceAudience(item: TrendDetailRecord["evidenceItems"][number]) {
  const parts: string[] = [];
  const audienceFlags = item.audienceFlags ?? [];
  const marketFlags = item.marketFlags ?? [];
  if (item.languageCode) {
    parts.push(`Language ${item.languageCode.toUpperCase()}`);
  }
  if (audienceFlags.length > 0) {
    parts.push(audienceFlags.slice(0, 2).map(formatCategory).join(" · "));
  }
  if (marketFlags.length > 0) {
    parts.push(marketFlags.slice(0, 2).map(formatCategory).join(" · "));
  }
  return parts.join(" · ");
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
  if (status === "experimental") {
    return "Experimental";
  }
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
  if (status === "experimental") {
    return "trend-status-pill";
  }
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

function contributionHealthClassName(status: string | null) {
  if (status === "healthy") {
    return "source-health-pill source-health-pill-healthy";
  }
  if (status === "degraded") {
    return "source-health-pill source-health-pill-degraded";
  }
  if (status === "stale") {
    return "source-health-pill source-health-pill-stale";
  }
  return "source-health-pill";
}
