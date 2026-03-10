import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  DashboardData,
  DashboardOverviewResponse,
  SourceSummaryResponse,
  TrendDetailIndexResponse,
  TrendDetailRecord,
  LatestTrendsResponse,
  TrendExplorerResponse,
  TrendHistoryResponse,
} from "@/lib/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");

export async function loadDashboardData(): Promise<DashboardData> {
  const [latest, history, overview, explorer, details, sourceSummary] = await Promise.all([
    readLatestTrends(),
    readTrendHistory(),
    readDashboardOverview(),
    readTrendExplorer(),
    readTrendDetailIndex(),
    readSourceSummary(),
  ]);
  return { latest, history, overview, explorer, details, sourceSummary };
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
    charts: {
      topTrendScores: [],
      sourceShare: [],
      statusBreakdown: [],
    },
    operations: {
      lastRunAt: null,
      successRate: 0,
      averageDurationMs: 0,
      recentRuns: [],
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
    charts: {
      topTrendScores: (payload.charts?.topTrendScores ?? []).map((datum) => ({
        label: datum.label,
        value: datum.value ?? 0,
      })),
      sourceShare: (payload.charts?.sourceShare ?? []).map((datum) => ({
        label: datum.label,
        value: datum.value ?? 0,
      })),
      statusBreakdown: (payload.charts?.statusBreakdown ?? []).map((datum) => ({
        label: datum.label,
        value: datum.value ?? 0,
      })),
    },
    operations: {
      lastRunAt: payload.operations?.lastRunAt ?? null,
      successRate: payload.operations?.successRate ?? 0,
      averageDurationMs: payload.operations?.averageDurationMs ?? 0,
      recentRuns: (payload.operations?.recentRuns ?? []).map((run) => ({
        capturedAt: run.capturedAt,
        durationMs: run.durationMs ?? 0,
        sourceCount: run.sourceCount ?? 0,
        successfulSourceCount: run.successfulSourceCount ?? 0,
        failedSourceCount: run.failedSourceCount ?? 0,
        signalCount: run.signalCount ?? 0,
        rankedTrendCount: run.rankedTrendCount ?? 0,
        status: run.status ?? "degraded",
        topTrendId: run.topTrendId ?? null,
        topTrendName: run.topTrendName ?? null,
        topScore: run.topScore ?? null,
      })),
    },
    sources: (payload.sources ?? []).map((source) => ({
      source: source.source,
      signalCount: source.signalCount ?? 0,
      trendCount: source.trendCount ?? 0,
      status: source.status ?? "stale",
      latestFetchAt: source.latestFetchAt ?? null,
      latestSuccessAt: source.latestSuccessAt ?? null,
      latestItemCount: source.latestItemCount ?? 0,
      durationMs: source.durationMs ?? 0,
      usedFallback: source.usedFallback ?? false,
      errorMessage: source.errorMessage ?? null,
    })),
  };
}

export async function loadDashboardOverview(): Promise<DashboardOverviewResponse> {
  return readDashboardOverview();
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
      status: trend.status ?? "steady",
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

export async function loadTrendExplorer(): Promise<TrendExplorerResponse> {
  return readTrendExplorer();
}

export async function loadTrendDetail(slug: string): Promise<TrendDetailRecord | null> {
  const payload = await readTrendDetailIndex();
  return payload.trends.find((trend) => trend.id === slug) ?? null;
}

export async function loadSourceSummary(sourceId: string) {
  const payload = await readSourceSummary();
  return payload.sources.find((source) => source.source === sourceId) ?? null;
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
      status: trend.status ?? "steady",
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

export async function loadTrendDetails(): Promise<TrendDetailIndexResponse> {
  return readTrendDetailIndex();
}

async function readSourceSummary(): Promise<SourceSummaryResponse> {
  const payload = await readJsonFile<SourceSummaryResponse>("source-summary.v2.json", {
    generatedAt: new Date(0).toISOString(),
    sources: [],
  });
  return {
    generatedAt: payload.generatedAt,
    sources: (payload.sources ?? []).map((source) => ({
      source: source.source,
      status: source.status ?? "stale",
      latestFetchAt: source.latestFetchAt ?? null,
      latestSuccessAt: source.latestSuccessAt ?? null,
      latestItemCount: source.latestItemCount ?? 0,
      durationMs: source.durationMs ?? 0,
      usedFallback: source.usedFallback ?? false,
      errorMessage: source.errorMessage ?? null,
      signalCount: source.signalCount ?? 0,
      trendCount: source.trendCount ?? 0,
      runHistory: source.runHistory ?? [],
      topTrends: source.topTrends ?? [],
    })),
  };
}

export async function loadSourceSummaries(): Promise<SourceSummaryResponse> {
  return readSourceSummary();
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
