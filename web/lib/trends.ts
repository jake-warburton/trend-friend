import { promises as fs } from "node:fs";
import path from "node:path";

import { apiGet } from "@/lib/api-client";
import type {
  DashboardData,
  DashboardOverviewResponse,
  SourceSummaryRecord,
  SourceSummaryResponse,
  TrendDetailIndexResponse,
  TrendDetailRecord,
  LatestTrendsResponse,
  TrendExplorerResponse,
  TrendHistoryResponse,
} from "@/lib/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");

/**
 * Whether to fetch from the Python REST API (true) or fall back to JSON files.
 * Set TREND_FRIEND_API_URL to enable API mode. Falls back to files on error.
 */
const API_ENABLED = !!process.env.TREND_FRIEND_API_URL;

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
  if (API_ENABLED) {
    try {
      return await apiGet<LatestTrendsResponse>("/trends/latest");
    } catch { /* fall through to file */ }
  }
  return readJsonFile<LatestTrendsResponse>("latest-trends.json", {
    generatedAt: new Date(0).toISOString(),
    trends: [],
  });
}

async function readTrendHistory(): Promise<TrendHistoryResponse> {
  if (API_ENABLED) {
    try {
      return await apiGet<TrendHistoryResponse>("/trends/history");
    } catch { /* fall through to file */ }
  }
  return readJsonFile<TrendHistoryResponse>("trend-history.json", {
    generatedAt: new Date(0).toISOString(),
    snapshots: [],
  });
}

async function readDashboardOverview(): Promise<DashboardOverviewResponse> {
  let payload: DashboardOverviewResponse;
  if (API_ENABLED) {
    try {
      payload = await apiGet<DashboardOverviewResponse>("/dashboard/overview");
      return normalizeDashboardOverview(payload);
    } catch { /* fall through to file */ }
  }
  payload = await readJsonFile<DashboardOverviewResponse>("dashboard-overview.v2.json", {
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
    sections: {
      topTrends: [],
      breakoutTrends: [],
      risingTrends: [],
      metaTrends: [],
    },
    operations: {
      lastRunAt: null,
      successRate: 0,
      averageDurationMs: 0,
      recentRuns: [],
    },
    sources: [],
  });
  return normalizeDashboardOverview(payload);
}

function normalizeDashboardOverview(payload: DashboardOverviewResponse): DashboardOverviewResponse {
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
    sections: {
      topTrends: (payload.sections?.topTrends ?? []).map((trend) => ({
        id: trend.id,
        name: trend.name,
        category: trend.category ?? "general-tech",
        status: trend.status ?? "steady",
        rank: trend.rank ?? 0,
        scoreTotal: trend.scoreTotal ?? 0,
      })),
      breakoutTrends: (payload.sections?.breakoutTrends ?? []).map((trend) => ({
        id: trend.id,
        name: trend.name,
        category: trend.category ?? "general-tech",
        status: trend.status ?? "breakout",
        rank: trend.rank ?? 0,
        scoreTotal: trend.scoreTotal ?? 0,
      })),
      risingTrends: (payload.sections?.risingTrends ?? []).map((trend) => ({
        id: trend.id,
        name: trend.name,
        category: trend.category ?? "general-tech",
        status: trend.status ?? "rising",
        rank: trend.rank ?? 0,
        scoreTotal: trend.scoreTotal ?? 0,
      })),
      metaTrends: (payload.sections?.metaTrends ?? []).map((trend) => ({
        category: trend.category ?? "general-tech",
        trendCount: trend.trendCount ?? 0,
        averageScore: trend.averageScore ?? 0,
        topTrendId: trend.topTrendId ?? "",
        topTrendName: trend.topTrendName ?? "",
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
      rawItemCount: source.rawItemCount ?? 0,
      latestItemCount: source.latestItemCount ?? 0,
      keptItemCount: source.keptItemCount ?? source.latestItemCount ?? 0,
      yieldRatePercent: source.yieldRatePercent ?? 0,
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
  let payload: TrendExplorerResponse;
  if (API_ENABLED) {
    try {
      payload = await apiGet<TrendExplorerResponse>("/trends");
      return normalizeTrendExplorer(payload);
    } catch { /* fall through to file */ }
  }
  payload = await readJsonFile<TrendExplorerResponse>("trend-explorer.v2.json", {
    generatedAt: new Date(0).toISOString(),
    trends: [],
  });
  return normalizeTrendExplorer(payload);
}

function normalizeTrendExplorer(payload: TrendExplorerResponse): TrendExplorerResponse {
  return {
    generatedAt: payload.generatedAt,
    trends: payload.trends.map((trend) => ({
      ...trend,
      category: trend.category ?? "general-tech",
      status: trend.status ?? "steady",
      volatility: trend.volatility ?? "stable",
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
      primaryEvidence: trend.primaryEvidence
        ? {
            ...trend.primaryEvidence,
            evidenceUrl: trend.primaryEvidence.evidenceUrl ?? null,
          }
        : null,
      seasonality: trend.seasonality
        ? {
            tag: trend.seasonality.tag ?? null,
            recurrenceCount: trend.seasonality.recurrenceCount ?? 0,
            avgGapRuns: trend.seasonality.avgGapRuns ?? 0,
            confidence: trend.seasonality.confidence ?? 0,
          }
        : null,
      forecastDirection: trend.forecastDirection ?? null,
    })),
  };
}

export async function loadTrendExplorer(): Promise<TrendExplorerResponse> {
  return readTrendExplorer();
}

export async function loadTrendDetail(slug: string): Promise<TrendDetailRecord | null> {
  if (API_ENABLED) {
    try {
      const trend = await apiGet<TrendDetailRecord>(`/trends/${slug}`);
      return normalizeTrendDetailRecord(trend);
    } catch { /* fall through to file */ }
  }
  const payload = await readTrendDetailIndex();
  return payload.trends.find((trend) => trend.id === slug) ?? null;
}

export async function loadSourceSummary(sourceId: string) {
  if (API_ENABLED) {
    try {
      const data = await apiGet<SourceSummaryRecord>(`/sources/${sourceId}`);
      return normalizeSourceRecord(data);
    } catch { /* fall through to file */ }
  }
  const payload = await readSourceSummary();
  return payload.sources.find((source) => source.source === sourceId) ?? null;
}

function normalizeSourceRecord(source: SourceSummaryRecord): SourceSummaryRecord {
  return {
    source: source.source,
    status: source.status ?? "stale",
    latestFetchAt: source.latestFetchAt ?? null,
    latestSuccessAt: source.latestSuccessAt ?? null,
    rawItemCount: source.rawItemCount ?? 0,
    latestItemCount: source.latestItemCount ?? 0,
    keptItemCount: source.keptItemCount ?? source.latestItemCount ?? 0,
    yieldRatePercent: source.yieldRatePercent ?? 0,
    durationMs: source.durationMs ?? 0,
    usedFallback: source.usedFallback ?? false,
    errorMessage: source.errorMessage ?? null,
    signalCount: source.signalCount ?? 0,
    trendCount: source.trendCount ?? 0,
    runHistory: (source.runHistory ?? []).map((run) => ({
      fetchedAt: run.fetchedAt,
      success: run.success ?? false,
      rawItemCount: run.rawItemCount ?? 0,
      itemCount: run.itemCount ?? 0,
      keptItemCount: run.keptItemCount ?? run.itemCount ?? 0,
      yieldRatePercent: run.yieldRatePercent ?? 0,
      durationMs: run.durationMs ?? 0,
      usedFallback: run.usedFallback ?? false,
      errorMessage: run.errorMessage ?? null,
    })),
    topTrends: source.topTrends ?? [],
  };
}

async function readTrendDetailIndex(): Promise<TrendDetailIndexResponse> {
  let payload: TrendDetailIndexResponse;
  if (API_ENABLED) {
    try {
      // The API doesn't have a detail-index endpoint — we load individual trends
      // Fall through to file for bulk loading
    } catch { /* fall through */ }
  }
  payload = await readJsonFile<TrendDetailIndexResponse>("trend-detail-index.v2.json", {
    generatedAt: new Date(0).toISOString(),
    trends: [],
  });
  return normalizeTrendDetailIndex(payload);
}

function normalizeTrendDetailIndex(payload: TrendDetailIndexResponse): TrendDetailIndexResponse {
  return {
    generatedAt: payload.generatedAt,
    trends: payload.trends.map(normalizeTrendDetailRecord),
  };
}

function normalizeTrendDetailRecord(trend: TrendDetailRecord): TrendDetailRecord {
  return {
    ...trend,
    category: trend.category ?? "general-tech",
    status: trend.status ?? "steady",
    volatility: trend.volatility ?? "stable",
    previousRank: trend.previousRank ?? null,
    rankChange: trend.rankChange ?? null,
    firstSeenAt: trend.firstSeenAt ?? null,
    momentum: {
      previousRank: trend.momentum?.previousRank ?? trend.previousRank ?? null,
      rankChange: trend.momentum?.rankChange ?? trend.rankChange ?? null,
      absoluteDelta: trend.momentum?.absoluteDelta ?? null,
      percentDelta: trend.momentum?.percentDelta ?? null,
    },
    breakoutPrediction: {
      confidence: trend.breakoutPrediction?.confidence ?? 0,
      predictedDirection: trend.breakoutPrediction?.predictedDirection ?? "stable",
      signals: trend.breakoutPrediction?.signals ?? [],
    },
    forecast: trend.forecast
      ? {
          predictedScores: trend.forecast.predictedScores ?? [],
          confidence: trend.forecast.confidence ?? "low",
          mape: trend.forecast.mape ?? 100,
          method: trend.forecast.method ?? "ses",
        }
      : null,
    opportunity: {
      composite: trend.opportunity?.composite ?? 0,
      content: trend.opportunity?.content ?? 0,
      product: trend.opportunity?.product ?? 0,
      investment: trend.opportunity?.investment ?? 0,
      reasoning: trend.opportunity?.reasoning ?? [],
    },
    coverage: {
      sourceCount: trend.coverage?.sourceCount ?? trend.sources?.length ?? 0,
      signalCount: trend.coverage?.signalCount ?? 0,
    },
    sources: trend.sources ?? [],
    history: trend.history ?? [],
    sourceBreakdown: trend.sourceBreakdown ?? [],
    sourceContributions: trend.sourceContributions ?? [],
    geoSummary: trend.geoSummary ?? [],
    evidenceItems: (trend.evidenceItems ?? []).map((item) => ({
      ...item,
      evidenceUrl: item.evidenceUrl ?? null,
    })),
    primaryEvidence: trend.primaryEvidence
      ? {
          ...trend.primaryEvidence,
          evidenceUrl: trend.primaryEvidence.evidenceUrl ?? null,
        }
      : null,
    relatedTrends: trend.relatedTrends ?? [],
    seasonality: trend.seasonality
      ? {
          tag: trend.seasonality.tag ?? null,
          recurrenceCount: trend.seasonality.recurrenceCount ?? 0,
          avgGapRuns: trend.seasonality.avgGapRuns ?? 0,
          confidence: trend.seasonality.confidence ?? 0,
        }
      : null,
  };
}

export async function loadTrendDetails(): Promise<TrendDetailIndexResponse> {
  return readTrendDetailIndex();
}

async function readSourceSummary(): Promise<SourceSummaryResponse> {
  let payload: SourceSummaryResponse;
  if (API_ENABLED) {
    try {
      payload = await apiGet<SourceSummaryResponse>("/sources");
      return normalizeSourceSummary(payload);
    } catch { /* fall through to file */ }
  }
  payload = await readJsonFile<SourceSummaryResponse>("source-summary.v2.json", {
    generatedAt: new Date(0).toISOString(),
    sources: [],
  });
  return normalizeSourceSummary(payload);
}

function normalizeSourceSummary(payload: SourceSummaryResponse): SourceSummaryResponse {
  return {
    generatedAt: payload.generatedAt,
    sources: (payload.sources ?? []).map((source) => ({
      source: source.source,
      status: source.status ?? "stale",
      latestFetchAt: source.latestFetchAt ?? null,
      latestSuccessAt: source.latestSuccessAt ?? null,
      rawItemCount: source.rawItemCount ?? 0,
      latestItemCount: source.latestItemCount ?? 0,
      keptItemCount: source.keptItemCount ?? source.latestItemCount ?? 0,
      yieldRatePercent: source.yieldRatePercent ?? 0,
      durationMs: source.durationMs ?? 0,
      usedFallback: source.usedFallback ?? false,
      errorMessage: source.errorMessage ?? null,
      signalCount: source.signalCount ?? 0,
      trendCount: source.trendCount ?? 0,
      runHistory: (source.runHistory ?? []).map((run) => ({
        fetchedAt: run.fetchedAt,
        success: run.success ?? false,
        rawItemCount: run.rawItemCount ?? 0,
        itemCount: run.itemCount ?? 0,
        keptItemCount: run.keptItemCount ?? run.itemCount ?? 0,
        yieldRatePercent: run.yieldRatePercent ?? 0,
        durationMs: run.durationMs ?? 0,
        usedFallback: run.usedFallback ?? false,
        errorMessage: run.errorMessage ?? null,
      })),
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
