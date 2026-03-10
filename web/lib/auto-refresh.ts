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
