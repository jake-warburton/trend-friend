export type OverviewRefreshMeta = {
  generatedAt: string;
  operations: {
    lastRunAt: string | null;
  };
};

export type ExplorerRefreshTrend = {
  id: string;
  rank: number;
  score: {
    total: number;
  };
};

export function hasOverviewChanged(
  current: OverviewRefreshMeta,
  next: OverviewRefreshMeta,
): boolean {
  return current.generatedAt !== next.generatedAt || current.operations.lastRunAt !== next.operations.lastRunAt;
}

export function detectChangedTrendIds(
  previous: ExplorerRefreshTrend[],
  next: ExplorerRefreshTrend[],
): string[] {
  const previousById = new Map(previous.map((trend) => [trend.id, trend]));

  return next
    .filter((trend) => {
      const prior = previousById.get(trend.id);
      if (prior == null) {
        return true;
      }
      return prior.rank !== trend.rank || prior.score.total !== trend.score.total;
    })
    .map((trend) => trend.id);
}
