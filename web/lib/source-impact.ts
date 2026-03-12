import type { DashboardOverviewSource, TrendDetailRecord, TrendExplorerRecord } from "@/lib/types";

const SUPPORTING_SOURCE_SHARE_PERCENT = 5;
const MATERIAL_SOURCE_SHARE_PERCENT = 15;
const MAX_EXAMPLE_TRENDS = 3;

export type SourceImpactRow = {
  source: string;
  materialTrendCount: number;
  totalTrendCount: number;
  averageMaterialSharePercent: number;
  exampleTrendNames: string[];
};

type SourceImpactAccumulator = {
  source: string;
  materialTrendIds: Set<string>;
  totalTrendIds: Set<string>;
  materialShareTotal: number;
  exampleTrends: { name: string; scoreSharePercent: number; rank: number }[];
};

export function buildSourceImpactRows(
  sources: DashboardOverviewSource[],
  trends: TrendExplorerRecord[],
  detailsByTrendId: Map<string, TrendDetailRecord>,
): SourceImpactRow[] {
  const rows = new Map<string, SourceImpactAccumulator>();

  for (const source of sources) {
    rows.set(source.source, createAccumulator(source.source));
  }

  for (const trend of trends) {
    const detail = detailsByTrendId.get(trend.id);
    if (!detail) {
      continue;
    }

    for (const contribution of detail.sourceContributions) {
      const row = rows.get(contribution.source) ?? createAccumulator(contribution.source);
      rows.set(contribution.source, row);

      if (contribution.scoreSharePercent >= SUPPORTING_SOURCE_SHARE_PERCENT) {
        row.totalTrendIds.add(trend.id);
      }

      if (contribution.scoreSharePercent >= MATERIAL_SOURCE_SHARE_PERCENT) {
        row.materialTrendIds.add(trend.id);
        row.materialShareTotal += contribution.scoreSharePercent;
        row.exampleTrends.push({
          name: trend.name,
          scoreSharePercent: contribution.scoreSharePercent,
          rank: trend.rank,
        });
      }
    }
  }

  return Array.from(rows.values())
    .map((row) => ({
      source: row.source,
      materialTrendCount: row.materialTrendIds.size,
      totalTrendCount: row.totalTrendIds.size,
      averageMaterialSharePercent:
        row.materialTrendIds.size > 0 ? row.materialShareTotal / row.materialTrendIds.size : 0,
      exampleTrendNames: row.exampleTrends
        .sort((left, right) => {
          const shareDelta = right.scoreSharePercent - left.scoreSharePercent;
          if (shareDelta !== 0) {
            return shareDelta;
          }
          return left.rank - right.rank;
        })
        .slice(0, MAX_EXAMPLE_TRENDS)
        .map((trend) => trend.name),
    }))
    .sort((left, right) => {
      const materialDelta = right.materialTrendCount - left.materialTrendCount;
      if (materialDelta !== 0) {
        return materialDelta;
      }
      const totalDelta = right.totalTrendCount - left.totalTrendCount;
      if (totalDelta !== 0) {
        return totalDelta;
      }
      return left.source.localeCompare(right.source);
    });
}

function createAccumulator(source: string): SourceImpactAccumulator {
  return {
    source,
    materialTrendIds: new Set<string>(),
    totalTrendIds: new Set<string>(),
    materialShareTotal: 0,
    exampleTrends: [],
  };
}
