import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import type { TrendDetailRecord, TrendHistoryPoint, TrendRecord } from "@/lib/types";
import { formatCategoryLabel } from "@/lib/category-labels";
import { getPrimaryEvidenceLink, normalizeEvidenceUrl } from "@/lib/evidence-links";
import {
  buildTrendChartHistory,
  compressTrendChartHistory,
  determineTrendHistoryGranularity,
} from "@/lib/trend-history";
import { forecastTrendFromHistory } from "@/lib/trend-forecast";
import { slugifyBrowseValue } from "@/lib/trend-browse";
import {
  loadSourceSummaries,
  loadTrendDetail,
  loadTrendDetailHistory,
  loadTrendHistory,
} from "@/lib/trends";
import { formatForecastMethod, summarizeForecastWindow } from "@/lib/forecast-ui";
import { getSeasonalityBadge, summarizeSeasonality } from "@/lib/seasonality-ui";
import {
  buildSourceContributionInsights,
  formatSourceLabel,
  getSourceFreshnessBadge,
  summarizeTopSourceDrivers,
} from "@/lib/source-health";
import Image from "next/image";
import { getWikipediaLinkFromDetail } from "@/lib/wikipedia";
import { TrendScoreChart } from "@/components/trend-score-chart";
import { ScoreBreakdownChart } from "@/components/score-breakdown-chart";
import { GeoMapClient } from "@/components/geo-map-client";
import { PlatformIntelligence } from "@/components/platform-intelligence";
import { JsonLd, buildArticleJsonLd, buildBreadcrumbJsonLd } from "@/components/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

type TrendDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate = 172800;

export async function generateMetadata({ params }: TrendDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const trend = await loadTrendDetail(slug);

  if (!trend) {
    return {
      title: "Trend Not Found",
      description: "This trend is no longer in the live ranking.",
    };
  }

  const displayName = trend.name;
  const category = formatCategoryLabel(trend.category);
  const score = trend.score.total.toFixed(1);
  const sourceCount = trend.sources.length;
  const status = trend.status.charAt(0).toUpperCase() + trend.status.slice(1);

  const description = trend.wikipediaDescription
    ? `${displayName}: ${trend.wikipediaDescription}. Currently ranked #${trend.rank} with a score of ${score} across ${sourceCount} sources. Status: ${status}.`
    : trend.summary
      ? `${trend.summary} Ranked #${trend.rank} with a score of ${score} across ${sourceCount} sources.`
      : `${displayName} is trending at rank #${trend.rank} with a score of ${score} across ${sourceCount} data sources. Track momentum, breakout predictions, and platform signals.`;

  const keywords = [
    displayName,
    `${displayName} trend`,
    `${displayName} trending`,
    `is ${displayName} trending`,
    category,
    trend.metaTrend,
    "trend analysis",
    "trend data",
    ...trend.aliases.slice(0, 3),
  ].filter(Boolean);

  const ogImages = trend.wikipediaThumbnailUrl
    ? [{ url: trend.wikipediaThumbnailUrl, alt: displayName }]
    : [];

  return {
    title: `${displayName} — Trend Intelligence`,
    description,
    keywords,
    alternates: {
      canonical: `${SITE_URL}/trends/${slug}`,
    },
    openGraph: {
      title: `${displayName} — Trend Intelligence | Signal Eye`,
      description,
      type: "article",
      ...(ogImages.length > 0 ? { images: ogImages } : {}),
    },
    twitter: {
      card: ogImages.length > 0 ? "summary_large_image" : "summary",
      title: `${displayName} — Trend Intelligence`,
      description,
      ...(ogImages.length > 0 ? { images: ogImages.map((i) => i.url) } : {}),
    },
  };
}

export default async function TrendDetailPage({ params }: TrendDetailPageProps) {
  const { slug } = await params;
  const [trend, history, sourceSummary] = await Promise.all([
    loadTrendDetail(slug),
    loadTrendHistory(),
    loadSourceSummaries(),
  ]);

  if (trend === null) {
    const recentTrend = findRecentTrendSnapshot(history, slug);
    if (recentTrend != null) {
      const rawHistory = buildTrendChartHistory(slug, history);
      const historyPoints = compressTrendChartHistory(rawHistory);
      const bucketGranularity = determineTrendHistoryGranularity(rawHistory);
      const forecast = forecastTrendFromHistory(rawHistory);
      return (
        <main className="detail-page" data-screenshot-target="trend-detail">
          <section className="detail-hero">
            <div>
              <Link className="detail-back-link" href="/explore">
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
              <TrendScoreChart
                history={historyPoints}
                currentScore={recentTrend.record.score.total}
                bucketGranularity={bucketGranularity}
                forecast={forecast}
              />
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

  const rawTrendHistory = await loadTrendDetailHistory(
    trend.id,
    trend.history,
    history,
    trend.name,
  );
  const chartHistory = compressTrendChartHistory(rawTrendHistory);
  const chartGranularity = determineTrendHistoryGranularity(rawTrendHistory);
  const effectiveForecast = trend.forecast ?? forecastTrendFromHistory(rawTrendHistory);
  const geoSummary = trend.geoSummary ?? [];
  const audienceSummary = trend.audienceSummary ?? [];
  const seasonalityBadge = getSeasonalityBadge(trend.seasonality);
  const primaryEvidenceLink = getPrimaryEvidenceLink(trend);
  const wikipediaLink = getWikipediaLinkFromDetail(trend);
  const wikipediaData = trend.wikipediaExtract
    ? {
        extract: trend.wikipediaExtract,
        description: trend.wikipediaDescription ?? null,
        thumbnailUrl: trend.wikipediaThumbnailUrl ?? null,
        pageUrl: trend.wikipediaPageUrl ?? wikipediaLink?.url ?? "#",
      }
    : null;
  const sourceInsights = buildSourceContributionInsights(trend.sourceContributions, sourceSummary.sources);
  const visibleMarketFootprint = trend.marketFootprint.filter((metric) => !metric.isEstimated);

  const articleDescription = trend.wikipediaDescription ?? trend.summary ?? `${trend.name} is an emerging trend tracked by Signal Eye.`;
  const jsonLd = [
    buildArticleJsonLd({
      headline: `${trend.name} — Trend Analysis`,
      description: articleDescription,
      url: `${SITE_URL}/trends/${trend.id}`,
      imageUrl: trend.wikipediaThumbnailUrl ?? undefined,
    }),
    buildBreadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Explore", url: `${SITE_URL}/explore` },
      { name: formatCategory(trend.category), url: `${SITE_URL}/categories/${slugifyBrowseValue(trend.category)}` },
      { name: trend.name, url: `${SITE_URL}/trends/${trend.id}` },
    ]),
  ];

  return (
    <main className="detail-page" data-screenshot-target="trend-detail">
      <JsonLd data={jsonLd} />
      <section className="detail-hero">
        <div>
          <Link className="detail-back-link" href="/explore">
            Back to explorer
          </Link>
          <p className="eyebrow">Trend detail</p>
          <div className="detail-pill-row">
            <Link className="trend-date-chip" href={`/categories/${slugifyBrowseValue(trend.category)}`}>{formatCategory(trend.category)}</Link>
            <Link className="trend-date-chip" href={`/meta-trends/${slugifyBrowseValue(trend.metaTrend)}`}>{trend.metaTrend}</Link>
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
          {trend.summary && wikipediaData ? <p className="detail-copy">{trend.summary}</p> : null}
          {wikipediaLink || primaryEvidenceLink?.evidenceUrl || trend.relatedTrends[0] ? (
            <div className="detail-action-links">
              {wikipediaLink ? (
                <a className="detail-back-link" href={wikipediaLink.url} rel="noreferrer" target="_blank">
                  Open Wikipedia page for {wikipediaLink.title}
                </a>
              ) : null}
              {primaryEvidenceLink?.evidenceUrl ? (
                <a className="detail-back-link" href={normalizeEvidenceUrl(primaryEvidenceLink.evidenceUrl)} rel="noreferrer" target="_blank">
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

      {wikipediaData ? (
        <section className="about-panel">
          <div className="about-panel-content">
            {wikipediaData.thumbnailUrl ? (
              <div className="about-panel-image">
                <Image
                  src={wikipediaData.thumbnailUrl}
                  alt={trend.name}
                  width={320}
                  height={320}
                  className="about-panel-thumbnail"
                />
              </div>
            ) : null}
            <div className="about-panel-text">
              <p className="eyebrow">About</p>
              <h2>What is {trend.name}?</h2>
              {wikipediaData.description ? (
                <p className="about-panel-tagline">{wikipediaData.description}</p>
              ) : null}
              <p className="about-panel-extract">{wikipediaData.extract}</p>
              <a className="about-panel-wiki-link" href={wikipediaData.pageUrl} rel="noreferrer" target="_blank">
                Read more on Wikipedia
              </a>
            </div>
          </div>
        </section>
      ) : trend.summary ? (
        <section className="about-panel">
          <div className="about-panel-content">
            <div className="about-panel-text">
              <p className="eyebrow">About</p>
              <h2>What is {trend.name}?</h2>
              <p className="about-panel-extract">{trend.summary}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="detail-grid">
        <section className="detail-panel detail-panel-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">History</p>
              <h2>Score trajectory</h2>
            </div>
          </div>

          <TrendScoreChart
            history={chartHistory}
            currentScore={trend.score.total}
            bucketGranularity={chartGranularity}
            forecast={effectiveForecast}
          />
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
              <p className="eyebrow">Platform intelligence</p>
              <h2>Source-by-source breakdown</h2>
            </div>
            <small className="section-heading-meta">
              {trend.coverage.sourceCount} sources · {trend.coverage.signalCount} signals
            </small>
          </div>

          <PlatformIntelligence
            sourceContributions={trend.sourceContributions}
            sourceBreakdown={trend.sourceBreakdown}
            marketFootprint={trend.marketFootprint}
            evidenceItems={trend.evidenceItems}
            sourceInsights={sourceInsights}
          />
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Why now</p>
              <h2>Why is {trend.name} trending?</h2>
            </div>
          </div>

          <div className="why-trending-list">
            {trend.whyNow.map((reason, index) => (
              <article className="why-trending-item" key={`${trend.id}-why-now-${index}`}>
                <span className="why-trending-number">{index + 1}</span>
                <div>
                  <strong>{extractReasonTitle(reason)}</strong>
                  <span>{extractReasonBody(reason)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Identity</p>
              <h2>Aliases & duplicates</h2>
            </div>
          </div>

          <div className="detail-subsection-label">Tracked aliases</div>
          <div className="detail-list">
            {(trend.aliases.length > 0 ? trend.aliases : [trend.name]).map((alias) => (
              <article className="detail-list-item" key={`${trend.id}-alias-${alias}`}>
                <div>
                  <strong>{alias}</strong>
                </div>
              </article>
            ))}
          </div>
          {trend.duplicateCandidates.length > 0 ? (
            <>
              <div className="detail-subsection-label">Potential duplicates</div>
              <div className="detail-list">
                {trend.duplicateCandidates.map((candidate) => (
                  <article className="detail-list-item" key={`${trend.id}-duplicate-${candidate.id}`}>
                    <div>
                      <strong>{candidate.name}</strong>
                      <span>{candidate.reason}</span>
                    </div>
                    <small>{Math.round(candidate.similarity * 100)}% overlap</small>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Opportunity</p>
              <h2>What you can do with it</h2>
            </div>
            <small className="section-heading-meta">{formatPredictionDirection(trend.breakoutPrediction.predictedDirection)}</small>
          </div>

          <div className="opportunity-hero">
            <div className="opportunity-composite">
              <span>Composite</span>
              <strong>{formatOpportunityScore(trend.opportunity.composite)}</strong>
            </div>
            <div className="opportunity-scores">
              <div className="opportunity-score-item">
                <span>Discovery</span>
                <strong>{formatOpportunityScore(trend.opportunity.discovery)}</strong>
              </div>
              <div className="opportunity-score-item">
                <span>SEO</span>
                <strong>{formatOpportunityScore(trend.opportunity.seo)}</strong>
              </div>
              <div className="opportunity-score-item">
                <span>Content</span>
                <strong>{formatOpportunityScore(trend.opportunity.content)}</strong>
              </div>
              <div className="opportunity-score-item">
                <span>Product</span>
                <strong>{formatOpportunityScore(trend.opportunity.product)}</strong>
              </div>
              <div className="opportunity-score-item">
                <span>Investment</span>
                <strong>{formatOpportunityScore(trend.opportunity.investment)}</strong>
              </div>
            </div>
          </div>

          {trend.opportunity.reasoning.length > 0 ? (
            <div className="detail-list">
              {trend.opportunity.reasoning.map((reason) => (
                <article className="detail-list-item" key={reason}>
                  <div>
                    <strong>{reason}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
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
            {effectiveForecast ? (
              <article className="detail-list-item">
                <div>
                  <strong>{summarizeForecastWindow(effectiveForecast)}</strong>
                  <span>
                    {formatForecastMethod(effectiveForecast.method)} · {effectiveForecast.mape.toFixed(1)}% backtest error
                  </span>
                </div>
                <small>
                  {effectiveForecast.predictedScores[0]?.toFixed(1)} to{" "}
                  {effectiveForecast.predictedScores[effectiveForecast.predictedScores.length - 1]?.toFixed(1)} projected
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

        {/* Source drivers are now integrated into Platform Intelligence above */}

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

        {/* Evidence items are now grouped per-platform in Platform Intelligence above */}
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

function findSentenceBreak(text: string, maxPos: number): number {
  for (let i = 0; i < text.length && i < maxPos; i++) {
    if (text[i] === ".") {
      const before = text[i - 1];
      const after = text[i + 1];
      if (before && after && /\d/.test(before) && /\d/.test(after)) continue;
      return i;
    }
  }
  return -1;
}

function extractReasonTitle(reason: string) {
  const colonIndex = reason.indexOf(":");
  if (colonIndex > 0 && colonIndex < 60) {
    return reason.slice(0, colonIndex);
  }
  const periodIndex = findSentenceBreak(reason, 80);
  if (periodIndex > 0) {
    return reason.slice(0, periodIndex);
  }
  return reason;
}

function extractReasonBody(reason: string) {
  const colonIndex = reason.indexOf(":");
  if (colonIndex > 0 && colonIndex < 60) {
    return reason.slice(colonIndex + 1).trim();
  }
  const periodIndex = findSentenceBreak(reason, 80);
  if (periodIndex > 0) {
    return reason.slice(periodIndex + 1).trim();
  }
  return "";
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
