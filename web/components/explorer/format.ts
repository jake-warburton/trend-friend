import type {
  TrendExplorerRecord,
  TrendDetailRecord,
  PublicWatchlistSummary,
  Watchlist,
  TrendThesis,
} from "@/lib/types";
import { formatCategoryLabel } from "@/lib/category-labels";
import { formatSourceLabel } from "@/lib/source-health";
import { formatCountryLabel, getRegionName } from "@/lib/geo-map-data";
import { confidenceBucketForTrend } from "@/lib/trend-filters";

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function buildTrendCardKey(trend: TrendExplorerRecord, index: number) {
  return `${trend.id}-${trend.rank}-${trend.latestSignalAt}-${index}`;
}

export function formatCompactTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function buildShareActivityMap(watchlist: Watchlist | null) {
  const shareActivityById = new Map<number, string>();
  for (const event of watchlist?.shareEvents ?? []) {
    if (event.shareId == null || shareActivityById.has(event.shareId)) {
      continue;
    }
    shareActivityById.set(event.shareId, event.createdAt);
  }
  return shareActivityById;
}

export function formatRankChange(value: number | null | undefined) {
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

export function formatMomentum(value: number | null | undefined) {
  if (value == null) {
    return "No prior run";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatMomentumHeadline(trend: TrendExplorerRecord) {
  if (trend.rankChange == null) {
    return "New signal";
  }
  const percentDelta = trend.momentum.percentDelta;
  if (percentDelta == null) {
    if (trend.rankChange === 0) {
      return "Flat";
    }
    return `${trend.rankChange > 0 ? "Up" : "Down"} ${Math.abs(trend.rankChange)}`;
  }
  return `${percentDelta > 0 ? "+" : ""}${percentDelta.toFixed(1)}%`;
}

export function formatMomentumDetail(trend: TrendExplorerRecord) {
  if (trend.rankChange == null) {
    return "First appearance in the current ranking";
  }
  if (trend.rankChange === 0) {
    return "Holding the same rank as the previous run";
  }
  const direction = trend.rankChange > 0 ? "up" : "down";
  const magnitude = Math.abs(trend.rankChange);
  return `Rank ${direction} ${magnitude} place${magnitude === 1 ? "" : "s"} vs previous run`;
}

export function formatScoreMix(score: TrendExplorerRecord["score"]) {
  const mix = (
    [
      ["Social", score.social],
      ["Developer", score.developer],
      ["Knowledge", score.knowledge],
      ["Search", score.search],
      ["Advertising", score.advertising ?? 0],
    ] as Array<[string, number]>
  )
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label, value]) => `${label} ${value.toFixed(1)}`);

  if (mix.length === 0) {
    return `Driven by cross-source diversity ${score.diversity.toFixed(1)}`;
  }
  return `Led by ${mix.join(" · ")}`;
}

export function formatCollapsedSourceDriverSummary(
  insights: Array<{ title: string; scoreSharePercent: number }>,
) {
  if (insights.length === 0) {
    return null;
  }
  return `Source drivers: ${insights
    .map(
      (insight) => `${insight.title} ${insight.scoreSharePercent.toFixed(0)}%`,
    )
    .join(" · ")}`;
}

export function formatCollapsedCorroborationSummary(
  detail: TrendDetailRecord | undefined,
  trend: TrendExplorerRecord,
) {
  if (!detail) {
    return `Corroborated by ${trend.coverage.sourceCount} source${trend.coverage.sourceCount === 1 ? "" : "s"}`;
  }

  const supportingSources = detail.sourceContributions.filter(
    (contribution) => contribution.scoreSharePercent >= 5,
  ).length;
  if (supportingSources >= 2) {
    return `Corroborated by ${supportingSources} contributing sources`;
  }
  if (detail.sourceContributions.length === 1) {
    return `Driven mainly by ${formatSourceLabel(detail.sourceContributions[0].source)}`;
  }
  return `Backed by ${trend.coverage.signalCount} signal${trend.coverage.signalCount === 1 ? "" : "s"} across ${trend.coverage.sourceCount} sources`;
}

export function movementClassName(rankChange: number | null | undefined) {
  if (rankChange == null) {
    return "movement-pill movement-pill-new";
  }
  if (rankChange > 0) {
    return "movement-pill movement-pill-up";
  }
  if (rankChange < 0) {
    return "movement-pill movement-pill-down";
  }
  return "movement-pill";
}

export function compareDates(left: string | null, right: string | null) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return -1;
  }
  if (right === null) {
    return 1;
  }
  return new Date(left).getTime() - new Date(right).getTime();
}

export function formatSourceStatus(status: string) {
  if (status === "healthy") {
    return "Healthy";
  }
  if (status === "degraded") {
    return "Degraded";
  }
  return "Stale";
}

export function formatCategory(category: string) {
  return formatCategoryLabel(category);
}

export function sourceHealthClassName(status: string) {
  if (status === "healthy") {
    return "source-health-pill source-health-pill-healthy";
  }
  if (status === "degraded") {
    return "source-health-pill source-health-pill-degraded";
  }
  return "source-health-pill source-health-pill-stale";
}

export function contributionHealthClassName(status: string | null) {
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

export function formatWatchSeverity(severity: "critical" | "warning" | "info") {
  if (severity === "critical") {
    return "Critical";
  }
  if (severity === "warning") {
    return "Warning";
  }
  return "Watch";
}

export function formatDuration(durationMs: number) {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${durationMs}ms`;
}

export function formatShareTokenLabel(shareToken: string) {
  return `${shareToken.slice(0, 8)}...`;
}

export function formatShareActivityTimestamp(value: string | null) {
  if (value == null) {
    return "No changes yet";
  }
  return formatCompactTimestamp(value);
}

export function formatTrendStatus(status: string) {
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

export function trendStatusClassName(status: string) {
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

export function formatVolatility(volatility: string) {
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

export function volatilityClassName(volatility: string) {
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

export function scaleValue(value: number, dataset: { value: number }[]) {
  const maxValue = dataset.reduce(
    (currentMax, item) => Math.max(currentMax, item.value),
    0,
  );
  if (maxValue <= 0) {
    return 0;
  }
  return Math.max((value / maxValue) * 100, 8);
}

export function formatPercent(value: number, dataset: { value: number }[]) {
  const total = dataset.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return "0%";
  }
  return `${Math.round((value / total) * 100)}%`;
}

export function formatAlertRuleType(ruleType: string) {
  const labels: Record<string, string> = {
    score_above: "Score",
    rank_change: "Rank",
    new_breakout: "Breakout",
    new_trend: "New",
  };
  return labels[ruleType] ?? ruleType;
}

export function formatSourceContributionSummary(
  source: NonNullable<PublicWatchlistSummary["sourceContributions"]>[number],
) {
  const components: Array<[string, number]> = [
    ["Social", source.score.social],
    ["Developer", source.score.developer],
    ["Knowledge", source.score.knowledge],
    ["Search", source.score.search],
    ["Advertising", source.score.advertising ?? 0],
    ["Diversity", source.score.diversity],
  ];
  const topComponents = components
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label, value]) => `${label} ${value.toFixed(1)}`);

  if (topComponents.length === 0) {
    return `${formatSourceLabel(source.source)} drove ${source.scoreSharePercent.toFixed(1)}%`;
  }
  return `${formatSourceLabel(source.source)} drove ${source.scoreSharePercent.toFixed(1)}% · ${topComponents.join(" · ")}`;
}

export function formatAudienceSummary(
  summary: NonNullable<PublicWatchlistSummary["audienceSummary"]>,
) {
  return summary
    .slice(0, 2)
    .map(
      (item) =>
        `${formatAudiencePrefix(item.segmentType)} ${formatAudienceLabel(item.label)}`,
    )
    .join(" · ");
}

export function formatAudiencePrefix(segmentType: string) {
  if (segmentType === "audience") {
    return "Audience:";
  }
  if (segmentType === "market") {
    return "Market:";
  }
  return "Language:";
}

export function formatAudienceLabel(label: string) {
  return label
    .split("-")
    .map((part) =>
      part.length <= 3 || /\d/.test(part)
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

export function formatConfidenceLabel(confidence: number) {
  return `${formatConfidenceBucketLabel(confidenceBucketForTrend(confidence))} confidence`;
}

export function formatConfidenceBucketLabel(confidence: string | undefined) {
  if (confidence === "high") {
    return "High";
  }
  if (confidence === "medium") {
    return "Medium";
  }
  return "Low";
}

export function formatStageLabel(stage: string | undefined) {
  return (stage ?? "steady")
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function buildTrendAudienceBadge(
  summary: TrendDetailRecord["audienceSummary"],
) {
  const lead = summary[0];
  if (!lead) {
    return null;
  }
  if (lead.segmentType === "audience") {
    return formatAudienceLabel(lead.label);
  }
  if (lead.segmentType === "market") {
    return formatAudienceLabel(lead.label);
  }
  return `${formatAudienceLabel(lead.label)} language`;
}

export function summarizeTrendAudience(summary: TrendDetailRecord["audienceSummary"]) {
  if (summary.length === 0) {
    return null;
  }
  return summary
    .slice(0, 2)
    .map(
      (item) =>
        `${formatAudiencePrefix(item.segmentType)} ${formatAudienceLabel(item.label)}`,
    )
    .join(" · ");
}

export function formatLanguageLabel(code: string) {
  const labels: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    it: "Italian",
    nl: "Dutch",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
  };
  return labels[code] ?? code.toUpperCase();
}

export function formatExplorerSortLabel(sortBy: string) {
  const labels: Record<string, string> = {
    rank: "Rank",
    strength: "Strength",
    dateAdded: "Date added",
    latestActivity: "Latest activity",
    sources: "Sources",
    momentum: "Momentum",
  };
  return labels[sortBy] ?? sortBy;
}

export function formatStatusLabel(status: string | undefined) {
  if (!status || status === "all") return "All statuses";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getOpportunityScoreForLens(
  detail: TrendDetailRecord | undefined,
  lens: string,
) {
  if (!detail) {
    return 0;
  }
  if (lens === "discovery") {
    return detail.opportunity.discovery;
  }
  if (lens === "seo") {
    return detail.opportunity.seo;
  }
  if (lens === "content") {
    return detail.opportunity.content;
  }
  if (lens === "product") {
    return detail.opportunity.product;
  }
  if (lens === "investment") {
    return detail.opportunity.investment;
  }
  return detail.opportunity.composite;
}

export function formatLensLabel(lens: string) {
  const labels: Record<string, string> = {
    all: "All lenses",
    discovery: "Discovery",
    seo: "SEO",
    content: "Content",
    product: "Product",
    investment: "Investment",
  };
  return labels[lens] ?? lens;
}

export function summarizeThesisFilters(thesis: TrendThesis) {
  const filters = [
    formatLensLabel(thesis.lens),
    thesis.keywordQuery ? `keyword: ${thesis.keywordQuery}` : null,
    thesis.source ? formatSourceLabel(thesis.source) : null,
    thesis.category ? formatCategory(thesis.category) : null,
    thesis.stage ? formatStageLabel(thesis.stage) : null,
    thesis.metaTrend,
    thesis.audience ? formatAudienceLabel(thesis.audience) : null,
    thesis.market ? formatAudienceLabel(thesis.market) : null,
    thesis.language ? thesis.language.toUpperCase() : null,
    thesis.geoCountry ? thesis.geoCountry.toUpperCase() : null,
    thesis.minimumScore > 0 ? `min ${thesis.minimumScore}` : null,
    thesis.hideRecurring ? "non-recurring" : null,
  ].filter(Boolean);
  return filters.join(" · ");
}

export function getOptionLabel<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string,
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

export function formatGeoCountryLabel(countryCode: string) {
  return formatCountryLabel(
    countryCode,
    getRegionName(countryCode) ?? countryCode,
  );
}

export function isDataStale(lastRunAt: string | null): boolean {
  if (!lastRunAt) return false;
  const twoHoursMs = 2 * 60 * 60 * 1000;
  return Date.now() - new Date(lastRunAt).getTime() > twoHoursMs;
}
