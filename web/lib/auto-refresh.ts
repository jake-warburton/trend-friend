export const AUTO_REFRESH_INTERVAL_MS = 60_000;

export type AutoRefreshState = "idle" | "checking" | "refreshing" | "updated" | "error";

export type OverviewRefreshMeta = {
  generatedAt: string;
  operations: {
    lastRunAt: string | null;
  };
};

export function hasOverviewChanged(
  current: OverviewRefreshMeta,
  next: OverviewRefreshMeta,
): boolean {
  return current.generatedAt !== next.generatedAt || current.operations.lastRunAt !== next.operations.lastRunAt;
}

export function formatAutoRefreshStatus(state: AutoRefreshState, lastUpdatedAt: number | null): string {
  if (state === "checking") {
    return "Checking for updates...";
  }
  if (state === "refreshing") {
    return "New data found. Updating dashboard...";
  }
  if (state === "error") {
    return "Background refresh unavailable";
  }
  if (state === "updated" && lastUpdatedAt != null) {
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - lastUpdatedAt) / 1000));
    if (elapsedSeconds < 10) {
      return "Updated just now";
    }
    if (elapsedSeconds < 60) {
      return `Updated ${elapsedSeconds}s ago`;
    }
    return `Updated ${Math.round(elapsedSeconds / 60)}m ago`;
  }
  return "Auto-refresh every minute";
}
