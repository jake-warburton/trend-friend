import type { DashboardOverviewSource, SourceSummaryRecord } from "@/lib/types";

type SourceHealthLike = Pick<
  DashboardOverviewSource | SourceSummaryRecord,
  "source" | "status" | "usedFallback" | "errorMessage" | "yieldRatePercent" | "rawItemCount"
>;

export type SourceWatchItem = {
  source: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

const LOW_YIELD_PERCENT = 30;
const MIXED_YIELD_PERCENT = 50;
const MIN_RAW_VOLUME_FOR_YIELD_WARNING = 10;

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

function severityWeight(severity: SourceWatchItem["severity"]): number {
  if (severity === "critical") {
    return 3;
  }
  if (severity === "warning") {
    return 2;
  }
  return 1;
}

function formatSourceLabel(source: string): string {
  return source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
