import Link from "next/link";
import type { TrendExplorerRecord, TrendDetailRecord, DashboardOverviewSource } from "@/lib/types";
import {
  formatDateOnly,
  formatCategory,
  formatStageLabel,
  formatConfidenceLabel,
  formatTrendStatus,
  formatVolatility,
  formatScoreMix,
  movementClassName,
  formatMomentumHeadline,
  formatMomentumDetail,
  buildTrendCardKey,
  buildTrendAudienceBadge,
  summarizeTrendAudience,
} from "./format";
import { buildSourceContributionInsights, formatSourceLabel } from "@/lib/source-health";
import { getPrimaryEvidenceLink, normalizeEvidenceUrl, summarizeEvidencePreview } from "@/lib/evidence-links";
import { getExplorerForecastBadge } from "@/lib/forecast-ui";
import { getSeasonalityBadge } from "@/lib/seasonality-ui";
import { getWikipediaLinkFromDetail } from "@/lib/wikipedia";

type ExplorerCardProps = {
  trend: TrendExplorerRecord;
  index: number;
  detail: TrendDetailRecord | undefined;
  sources: DashboardOverviewSource[];
  isUpdated: boolean;
};

export function ExplorerCard({ trend, index, detail, sources, isUpdated }: ExplorerCardProps) {
  const forecastBadge = getExplorerForecastBadge(trend.forecastDirection);
  const seasonalityBadge = getSeasonalityBadge(trend.seasonality);
  const primaryEvidenceLink = getPrimaryEvidenceLink(detail);
  const wikipediaLink = getWikipediaLinkFromDetail(detail);
  const audienceBadge = buildTrendAudienceBadge(detail?.audienceSummary ?? []);
  const audienceSummary = summarizeTrendAudience(detail?.audienceSummary ?? []);
  const evidencePreviewText = primaryEvidenceLink
    ? summarizeEvidencePreview(
        primaryEvidenceLink.evidence,
        primaryEvidenceLink.source,
      )
    : summarizeEvidencePreview(trend.evidencePreview[0] ?? "");
  const evidenceMeta = [
    primaryEvidenceLink
      ? formatSourceLabel(primaryEvidenceLink.source)
      : null,
    audienceSummary,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" · ");
  const compactSummaryParts = [
    formatStageLabel(trend.stage),
    formatConfidenceLabel(trend.confidence),
    formatTrendStatus(trend.status),
    formatVolatility(trend.volatility),
    forecastBadge?.label ?? null,
    seasonalityBadge?.label ?? null,
    audienceBadge ?? null,
    trend.metaTrend,
  ].filter((item): item is string => Boolean(item));
  const sourceInsights = detail
    ? buildSourceContributionInsights(
        detail.sourceContributions,
        sources,
      ).slice(0, 5)
    : [];

  return (
    <article
      className={
        isUpdated
          ? "explorer-card explorer-card-updated"
          : "explorer-card"
      }
      data-status={trend.status}
      key={buildTrendCardKey(trend, index)}
    >
      <div className="explorer-card-top">
        <div className="trend-cell explorer-card-head">
          <div className="explorer-card-title-line">
            <span className="explorer-rank-chip">
              #{trend.rank}
            </span>
            <div className="trend-title-row">
              <strong>
                <Link
                  className="trend-link"
                  href={`/trends/${trend.id}`}
                >
                  {trend.name}
                </Link>
              </strong>
            </div>
          </div>
          <div className="explorer-card-meta">
            <span>
              {trend.firstSeenAt
                ? `Since ${formatDateOnly(trend.firstSeenAt)}`
                : "This run"}
            </span>
            <span>Sources: {trend.sources.length}</span>
            <span>{formatCategory(trend.category)}</span>
          </div>
          <div className="explorer-card-summary">
            <span>{compactSummaryParts.join(" / ")}</span>
          </div>
          {sourceInsights.length > 0 && (
            <div className="explorer-source-bars">
              {sourceInsights.map((insight) => (
                <span
                  key={insight.source}
                  className="explorer-source-pip"
                  title={`${insight.title} ${insight.scoreSharePercent.toFixed(0)}%`}
                  style={{
                    flex: `${insight.scoreSharePercent} 0 0`,
                    opacity: 0.5 + (insight.scoreSharePercent / 100) * 0.5,
                  }}
                >
                  {insight.title}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="explorer-metrics-row">
          <div className="explorer-metrics-panel">
            <div className="explorer-metric-card">
              <span className="explorer-metric-label">
                Trend strength
              </span>
              <strong className="explorer-metric-value">
                {trend.score.total.toFixed(1)}
              </strong>
              <small className="explorer-metric-copy">
                {formatScoreMix(trend.score)}
              </small>
            </div>

            <div className="explorer-metric-card">
              <span className="explorer-metric-label">
                Change vs last run
              </span>
              <strong
                className={`explorer-metric-value ${movementClassName(trend.rankChange)}`}
              >
                {formatMomentumHeadline(trend)}
              </strong>
              <small className="explorer-metric-copy">
                {formatMomentumDetail(trend)}
              </small>
            </div>

            <div className="explorer-metric-card">
              <span className="explorer-metric-label">
                Evidence base
              </span>
              <strong className="explorer-metric-value">
                {trend.coverage.signalCount} signal
                {trend.coverage.signalCount === 1 ? "" : "s"}
              </strong>
              <small className="explorer-metric-copy">
                {trend.coverage.sourceCount} source{trend.coverage.sourceCount === 1 ? "" : "s"}
              </small>
            </div>
          </div>
        </div>
      </div>

      <div className="explorer-card-bottom">
        <div className="evidence-preview evidence-preview-inline">
          <div className="evidence-main-row">
            <span className="explorer-evidence-label">
              Latest signal
            </span>
            {primaryEvidenceLink?.evidenceUrl ? (
              <a
                className="trend-link"
                href={normalizeEvidenceUrl(primaryEvidenceLink.evidenceUrl)}
                rel="noreferrer"
                target="_blank"
              >
                {evidencePreviewText}
              </a>
            ) : (
              <span>{evidencePreviewText}</span>
            )}
          </div>
          {evidenceMeta || wikipediaLink ? (
            <div className="evidence-meta-row">
              {evidenceMeta ? (
                <span className="source-summary-copy">
                  {evidenceMeta}
                </span>
              ) : null}
              {wikipediaLink ? (
                <a
                  className="trend-link source-summary-copy"
                  href={wikipediaLink.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Background: {wikipediaLink.title}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        {trend.breaking && trend.breaking.tweets.length > 0 && (
          <div className="explorer-breaking-strip">
            <div className="explorer-breaking-header">
              <span className="breaking-feed-dot" aria-hidden="true" />
              <span className="explorer-breaking-label">Breaking</span>
              <span className="breaking-feed-score">{trend.breaking.breakingScore.toFixed(1)}</span>
              {trend.breaking.corroborated && (
                <span className="breaking-feed-corroborated">Corroborated</span>
              )}
            </div>
            <ul className="explorer-breaking-tweets">
              {trend.breaking.tweets.slice(0, 2).map((tweet) => (
                <li key={tweet.tweetId}>
                  <a
                    href={`https://x.com/i/status/${tweet.tweetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="breaking-feed-tweet-link"
                  >
                    <span className="breaking-feed-account">@{tweet.account}</span>
                    <span className="breaking-feed-tweet-text">{tweet.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

    </article>
  );
}
