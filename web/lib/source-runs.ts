import type { SourceRun } from "@/lib/types";

export type SourceRunFilter = "all" | "healthy" | "fallback" | "failed";
export type SourceRunSort = "newest" | "oldest" | "slowest" | "lowest_yield";

export function normalizeSourceRunFilter(value: string | string[] | undefined): SourceRunFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "healthy" || candidate === "fallback" || candidate === "failed") {
    return candidate;
  }
  return "all";
}

export function normalizeSourceRunSort(value: string | string[] | undefined): SourceRunSort {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "oldest" || candidate === "slowest" || candidate === "lowest_yield") {
    return candidate;
  }
  return "newest";
}

export function filterAndSortSourceRuns(
  runs: SourceRun[],
  filter: SourceRunFilter,
  sort: SourceRunSort,
): SourceRun[] {
  return [...runs]
    .filter((run) => matchesSourceRunFilter(run, filter))
    .sort((left, right) => compareSourceRuns(left, right, sort));
}

function matchesSourceRunFilter(run: SourceRun, filter: SourceRunFilter): boolean {
  if (filter === "healthy") {
    return run.success && !run.usedFallback;
  }
  if (filter === "fallback") {
    return run.success && run.usedFallback;
  }
  if (filter === "failed") {
    return !run.success;
  }
  return true;
}

function compareSourceRuns(left: SourceRun, right: SourceRun, sort: SourceRunSort): number {
  if (sort === "oldest") {
    return compareDates(left.fetchedAt, right.fetchedAt);
  }
  if (sort === "slowest") {
    return right.durationMs - left.durationMs || compareDates(right.fetchedAt, left.fetchedAt);
  }
  if (sort === "lowest_yield") {
    return left.yieldRatePercent - right.yieldRatePercent || compareDates(right.fetchedAt, left.fetchedAt);
  }
  return compareDates(right.fetchedAt, left.fetchedAt);
}

function compareDates(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}
