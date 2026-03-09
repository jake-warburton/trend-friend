import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  DashboardData,
  DashboardOverviewResponse,
  TrendDetailIndexResponse,
  TrendDetailRecord,
  LatestTrendsResponse,
  TrendExplorerResponse,
  TrendHistoryResponse,
} from "@/lib/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");

export async function loadDashboardData(): Promise<DashboardData> {
  const [latest, history, overview, explorer, details] = await Promise.all([
    readLatestTrends(),
    readTrendHistory(),
    readDashboardOverview(),
    readTrendExplorer(),
    readTrendDetailIndex(),
  ]);
  return { latest, history, overview, explorer, details };
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

async function readDashboardOverview(): Promise<DashboardOverviewResponse> {
  const payload = await readJsonFile<DashboardOverviewResponse>("dashboard-overview.v2.json", {
    generatedAt: new Date(0).toISOString(),
    summary: {
      trackedTrends: 0,
      totalSignals: 0,
      sourceCount: 0,
      averageScore: 0,
    },
    highlights: {
      topTrendId: null,
      topTrendName: null,
      biggestMoverId: null,
      biggestMoverName: null,
      newestTrendId: null,
      newestTrendName: null,
    },
    sources: [],
  });
  return {
    generatedAt: payload.generatedAt,
    summary: {
      trackedTrends: payload.summary?.trackedTrends ?? 0,
      totalSignals: payload.summary?.totalSignals ?? 0,
      sourceCount: payload.summary?.sourceCount ?? 0,
      averageScore: payload.summary?.averageScore ?? 0,
    },
    highlights: {
      topTrendId: payload.highlights?.topTrendId ?? null,
      topTrendName: payload.highlights?.topTrendName ?? null,
      biggestMoverId: payload.highlights?.biggestMoverId ?? null,
      biggestMoverName: payload.highlights?.biggestMoverName ?? null,
      newestTrendId: payload.highlights?.newestTrendId ?? null,
      newestTrendName: payload.highlights?.newestTrendName ?? null,
    },
    sources: (payload.sources ?? []).map((source) => ({
      source: source.source,
      signalCount: source.signalCount ?? 0,
      trendCount: source.trendCount ?? 0,
      status: source.status ?? "stale",
      latestFetchAt: source.latestFetchAt ?? null,
      latestSuccessAt: source.latestSuccessAt ?? null,
      latestItemCount: source.latestItemCount ?? 0,
      errorMessage: source.errorMessage ?? null,
    })),
  };
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

export async function loadTrendDetail(slug: string): Promise<TrendDetailRecord | null> {
  const payload = await readTrendDetailIndex();
  return payload.trends.find((trend) => trend.id === slug) ?? null;
}

async function readTrendDetailIndex(): Promise<TrendDetailIndexResponse> {
  const payload = await readJsonFile<TrendDetailIndexResponse>("trend-detail-index.v2.json", {
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
      history: trend.history ?? [],
      sourceBreakdown: trend.sourceBreakdown ?? [],
      evidenceItems: trend.evidenceItems ?? [],
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
