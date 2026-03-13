import type { DashboardOverviewSource, SourceSummaryRecord, TrendSourceContribution } from "@/lib/types";

type SourceHealthLike = Pick<
  DashboardOverviewSource | SourceSummaryRecord,
  "source" | "status" | "usedFallback" | "errorMessage" | "yieldRatePercent" | "rawItemCount"
> & Partial<
  Pick<
    DashboardOverviewSource | SourceSummaryRecord,
    "latestFetchAt" | "latestSuccessAt" | "latestItemCount" | "keptItemCount" | "durationMs"
  >
>;

export type SourceWatchItem = {
  source: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

export type SourceContributionInsight = {
  source: string;
  title: string;
  scoreSharePercent: number;
  estimatedScore: number;
  signalCount: number;
  latestSignalAt: string;
  mixSummary: string;
  status: string | null;
  statusLabel: string;
  fetchedAt: string | null;
  fetchSummary: string;
  warning: string | null;
};

export type SourceFreshnessBadge = {
  tone: "fresh" | "aging" | "stale";
  label: string;
};

const LOW_YIELD_PERCENT = 30;
const MIXED_YIELD_PERCENT = 50;
const MIN_RAW_VOLUME_FOR_YIELD_WARNING = 10;
const FRESH_SOURCE_WINDOW_MINUTES = 45;
const AGING_SOURCE_WINDOW_MINUTES = 180;

export function buildSourceWatchlist(sources: SourceHealthLike[]): SourceWatchItem[] {
  return sources
    .map(buildSourceWatchItem)
    .filter((item): item is SourceWatchItem => item !== null)
    .sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity) || left.source.localeCompare(right.source))
    .slice(0, 4);
}

export function buildSourceWatchItem(source: SourceHealthLike): SourceWatchItem | null {
  const title = formatSourceLabel(source.source);
  if (source.errorMessage) {
    return {
      source: source.source,
      severity: "critical",
      title,
      detail: "Latest run failed",
    };
  }
  if (source.usedFallback || source.status === "degraded") {
    return {
      source: source.source,
      severity: "warning",
      title,
      detail: "Latest run used fallback data",
    };
  }
  if (source.status === "stale") {
    return {
      source: source.source,
      severity: "warning",
      title,
      detail: "No recent healthy run",
    };
  }
  if (source.rawItemCount >= MIN_RAW_VOLUME_FOR_YIELD_WARNING && source.yieldRatePercent < LOW_YIELD_PERCENT) {
    return {
      source: source.source,
      severity: "warning",
      title,
      detail: "Low kept yield from recent fetches",
    };
  }
  if (source.rawItemCount >= MIN_RAW_VOLUME_FOR_YIELD_WARNING && source.yieldRatePercent < MIXED_YIELD_PERCENT) {
    return {
      source: source.source,
      severity: "info",
      title,
      detail: "Mixed kept yield from recent fetches",
    };
  }
  return null;
}

export function buildSourceContributionInsights(
  contributions: TrendSourceContribution[],
  sources: SourceHealthLike[],
): SourceContributionInsight[] {
  const healthBySource = new Map(sources.map((source) => [source.source, source]));

  return [...contributions]
    .sort((left, right) => right.scoreSharePercent - left.scoreSharePercent || right.estimatedScore - left.estimatedScore)
    .map((contribution) => {
      const health = healthBySource.get(contribution.source) ?? null;
      const fetchedAt = health?.latestSuccessAt ?? health?.latestFetchAt ?? null;
      return {
        source: contribution.source,
        title: formatSourceLabel(contribution.source),
        scoreSharePercent: contribution.scoreSharePercent,
        estimatedScore: contribution.estimatedScore,
        signalCount: contribution.signalCount,
        latestSignalAt: contribution.latestSignalAt,
        mixSummary: formatSourceContributionSummary(contribution),
        status: health?.status ?? null,
        statusLabel: formatSourceStatus(health?.status ?? null),
        fetchedAt,
        fetchSummary: describeSourceFetch(health),
        warning: describeSourceWarning(health),
      };
    });
}

export function summarizeTopSourceDrivers(contributions: TrendSourceContribution[]): string {
  const topContributions = [...contributions]
    .sort((left, right) => right.scoreSharePercent - left.scoreSharePercent || right.estimatedScore - left.estimatedScore)
    .slice(0, 2);

  if (topContributions.length === 0) {
    return "No attributed source contribution yet.";
  }
  if (topContributions.length === 1) {
    return `${formatSourceLabel(topContributions[0].source)} accounts for ${topContributions[0].scoreSharePercent.toFixed(1)}% of this score.`;
  }

  const totalShare = topContributions.reduce((sum, contribution) => sum + contribution.scoreSharePercent, 0);
  return `${formatSourceLabel(topContributions[0].source)} and ${formatSourceLabel(topContributions[1].source)} account for ${totalShare.toFixed(1)}% of this score.`;
}

export function getSourceFreshnessBadge(
  latestSuccessAt: string | null | undefined,
  now: Date = new Date(),
): SourceFreshnessBadge | null {
  if (!latestSuccessAt) {
    return null;
  }

  const latestSuccessTime = new Date(latestSuccessAt).getTime();
  const nowTime = now.getTime();
  if (Number.isNaN(latestSuccessTime) || Number.isNaN(nowTime)) {
    return null;
  }

  const diffMinutes = Math.max(0, Math.round((nowTime - latestSuccessTime) / 60000));
  if (diffMinutes <= FRESH_SOURCE_WINDOW_MINUTES) {
    return { tone: "fresh", label: "Fresh" };
  }
  if (diffMinutes <= AGING_SOURCE_WINDOW_MINUTES) {
    return { tone: "aging", label: `${diffMinutes}m old` };
  }
  if (diffMinutes < 1440) {
    return { tone: "stale", label: `${Math.round(diffMinutes / 60)}h old` };
  }
  return { tone: "stale", label: `${Math.round(diffMinutes / 1440)}d old` };
}

function severityWeight(severity: SourceWatchItem["severity"]): number {
  if (severity === "critical") {
    return 3;
  }
  if (severity === "warning") {
    return 2;
  }
  return 1;
}

function formatSourceContributionSummary(source: TrendSourceContribution): string {
  const components: Array<[string, number]> = [
    ["Social", source.score.social],
    ["Developer", source.score.developer],
    ["Knowledge", source.score.knowledge],
    ["Search", source.score.search],
    ["Diversity", source.score.diversity],
  ];

  const topComponents = components
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label, value]) => `${label} ${value.toFixed(1)}`);

  if (topComponents.length === 0) {
    return "No attributed score contribution";
  }
  return topComponents.join(" · ");
}

function describeSourceFetch(source: SourceHealthLike | null): string {
  if (source == null) {
    return "No fetch telemetry yet";
  }
  if (source.errorMessage) {
    return "Latest run failed";
  }
  if (source.usedFallback) {
    return "Latest successful fetch used fallback data";
  }
  if (source.status === "stale") {
    return "No recent healthy run";
  }
  if (source.keptItemCount == null || source.latestItemCount == null) {
    return "Latest healthy fetch completed";
  }
  return `Latest healthy fetch kept ${source.keptItemCount} of ${source.latestItemCount} items`;
}

function describeSourceWarning(source: SourceHealthLike | null): string | null {
  if (source == null) {
    return null;
  }
  if (source.errorMessage) {
    return "Latest run failed";
  }
  if (source.usedFallback || source.status === "degraded") {
    return "Latest successful fetch used fallback sample data.";
  }
  if (source.status === "stale") {
    return "No recent healthy run for this source.";
  }
  return null;
}

function formatSourceStatus(status: string | null): string {
  if (status === "healthy") {
    return "Healthy";
  }
  if (status === "degraded") {
    return "Degraded";
  }
  if (status === "stale") {
    return "Stale";
  }
  return "Unknown";
}

export function formatSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    arxiv: "arXiv",
    devto: "DEV Community",
    producthunt: "Product Hunt",
    huggingface: "Hugging Face",
    lobsters: "Lobsters",
    npm: "npm",
    pypi: "PyPI",
    stackoverflow: "Stack Overflow",
    reddit: "Reddit",
    hacker_news: "Hacker News",
    github: "GitHub",
    wikipedia: "Wikipedia",
    google_trends: "Google Trends",
    polymarket: "Polymarket",
    twitter: "Twitter/X",
    youtube: "YouTube",
  };
  return labels[source] ?? source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
