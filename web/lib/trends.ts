import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  DashboardData,
  LatestTrendsResponse,
  TrendExplorerResponse,
  TrendHistoryResponse,
} from "@/lib/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");

export async function loadDashboardData(): Promise<DashboardData> {
  const [latest, history, explorer] = await Promise.all([
    readLatestTrends(),
    readTrendHistory(),
    readTrendExplorer(),
  ]);
  return { latest, history, explorer };
}

async function readLatestTrends(): Promise<LatestTrendsResponse> {
  return readJsonFile<LatestTrendsResponse>("latest-trends.json", {
    generatedAt: new Date(0).toISOString(),
    trends: [],
  });
}

async function readTrendHistory(): Promise<TrendHistoryResponse> {
  return readJsonFile<TrendHistoryResponse>("trend-history.json", {
    generatedAt: new Date(0).toISOString(),
    snapshots: [],
  });
}

async function readTrendExplorer(): Promise<TrendExplorerResponse> {
  const payload = await readJsonFile<TrendExplorerResponse>("trend-explorer.v2.json", {
    generatedAt: new Date(0).toISOString(),
    trends: [],
  });
  return {
    generatedAt: payload.generatedAt,
    trends: payload.trends.map((trend) => ({
      ...trend,
      previousRank: trend.previousRank ?? null,
      rankChange: trend.rankChange ?? null,
      firstSeenAt: trend.firstSeenAt ?? null,
      momentum: {
        previousRank: trend.momentum?.previousRank ?? trend.previousRank ?? null,
        rankChange: trend.momentum?.rankChange ?? trend.rankChange ?? null,
        absoluteDelta: trend.momentum?.absoluteDelta ?? null,
        percentDelta: trend.momentum?.percentDelta ?? null,
      },
      coverage: {
        sourceCount: trend.coverage?.sourceCount ?? trend.sources?.length ?? 0,
        signalCount: trend.coverage?.signalCount ?? 0,
      },
      sources: trend.sources ?? [],
      evidencePreview: trend.evidencePreview ?? [],
    })),
  };
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(DATA_DIRECTORY, filename);
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch {
    return fallback;
  }
}
