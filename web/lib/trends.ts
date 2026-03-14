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
  TrendExplorerRecord,
  LatestTrendsResponse,
  TrendExplorerResponse,
  TrendHistoryResponse,
} from "@/lib/types";

const DATA_DIRECTORIES = [
  path.join(process.cwd(), "data"),
  path.join(process.cwd(), "web", "data"),
];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ACCESS_KEY =
  process.env.SIGNAL_EYE_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

/**
 * Whether to fetch from the Python REST API (true) or fall back to JSON files.
 * Set SIGNAL_EYE_API_URL to enable API mode. Falls back to files on error.
 */
const API_ENABLED = !!process.env.SIGNAL_EYE_API_URL;
const SUPABASE_PAYLOADS_ENABLED = !!SUPABASE_URL && !!SUPABASE_ACCESS_KEY;

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
  if (SUPABASE_PAYLOADS_ENABLED) {
    try {
      return await readSupabasePayload<LatestTrendsResponse>("latest-trends.json");
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
  if (SUPABASE_PAYLOADS_ENABLED) {
    try {
      return await readSupabasePayload<TrendHistoryResponse>("trend-history.json");
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
  if (SUPABASE_PAYLOADS_ENABLED) {
    try {
      payload = await readSupabasePayload<DashboardOverviewResponse>("dashboard-overview.v2.json");
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
      experimentalTrends: [],
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

export function normalizeDashboardOverview(payload: DashboardOverviewResponse): DashboardOverviewResponse {
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
      experimentalTrends: (payload.sections?.experimentalTrends ?? []).map((trend) => ({
        id: trend.id,
        name: trend.name,
        category: trend.category ?? "general-tech",
        status: trend.status ?? "experimental",
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
        rawTopicCount: run.rawTopicCount ?? 0,
        mergedTopicCount: run.mergedTopicCount ?? 0,
        duplicateTopicCount: run.duplicateTopicCount ?? 0,
        duplicateTopicRate: run.duplicateTopicRate ?? 0,
        multiSourceTrendCount: run.multiSourceTrendCount ?? 0,
        lowEvidenceTrendCount: run.lowEvidenceTrendCount ?? 0,
      })),
    },
    sourceWatch: (payload.sourceWatch ?? []).map((item) => ({
      source: item.source,
      severity: item.severity ?? "info",
      title: item.title ?? item.source,
      detail: item.detail ?? "",
    })),
    sources: (payload.sources ?? []).map((source) => ({
      source: source.source,
      family: source.family ?? "other",
      signalCount: source.signalCount ?? 0,
      trendCount: source.trendCount ?? 0,
      status: source.status ?? "stale",
      latestFetchAt: source.latestFetchAt ?? null,
      latestSuccessAt: source.latestSuccessAt ?? null,
      rawItemCount: source.rawItemCount ?? 0,
      latestItemCount: source.latestItemCount ?? 0,
      keptItemCount: source.keptItemCount ?? source.latestItemCount ?? 0,
      yieldRatePercent: source.yieldRatePercent ?? 0,
      signalYieldRatio: source.signalYieldRatio ?? 0,
      durationMs: source.durationMs ?? 0,
      rawTopicCount: source.rawTopicCount ?? 0,
      mergedTopicCount: source.mergedTopicCount ?? 0,
      duplicateTopicCount: source.duplicateTopicCount ?? 0,
      duplicateTopicRate: source.duplicateTopicRate ?? 0,
      usedFallback: source.usedFallback ?? false,
      errorMessage: source.errorMessage ?? null,
    })),
  };
}

export async function loadDashboardOverview(): Promise<DashboardOverviewResponse> {
  return readDashboardOverview();
}

export async function loadTrendHistory(): Promise<TrendHistoryResponse> {
  return readTrendHistory();
}

async function readTrendExplorer(): Promise<TrendExplorerResponse> {
  let payload: TrendExplorerResponse;
  if (API_ENABLED) {
    try {
      payload = await apiGet<TrendExplorerResponse>("/trends");
      return normalizeTrendExplorer(payload);
    } catch { /* fall through to file */ }
  }
  if (SUPABASE_PAYLOADS_ENABLED) {
    try {
      payload = await readSupabasePayload<TrendExplorerResponse>("trend-explorer.v2.json");
      return normalizeTrendExplorer(payload);
    } catch { /* fall through to file */ }
  }
  payload = await readJsonFile<TrendExplorerResponse>("trend-explorer.v2.json", {
    generatedAt: new Date(0).toISOString(),
    trends: [],
  });
  return normalizeTrendExplorer(payload);
}

export function normalizeTrendExplorer(payload: TrendExplorerResponse): TrendExplorerResponse {
  return {
    generatedAt: payload.generatedAt,
    trends: payload.trends.map((trend) => ({
      ...trend,
      category: trend.category ?? "general-tech",
      metaTrend: trend.metaTrend ?? "General",
      stage: trend.stage ?? "steady",
      confidence: trend.confidence ?? 0,
      summary: trend.summary ?? "",
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
      audienceSummary: trend.audienceSummary ?? [],
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
  const detailMatch = payload.trends.find((trend) => trend.id === slug) ?? null;
  if (detailMatch) {
    return detailMatch;
  }

  const explorer = await readTrendExplorer();
  const explorerMatch = explorer.trends.find((trend) => trend.id === slug);
  if (explorerMatch) {
    return buildFallbackTrendDetailFromExplorer(explorerMatch, explorer.generatedAt);
  }

  const overview = await readDashboardOverview();
  const experimentalMatch = overview.sections.experimentalTrends.find((trend) => trend.id === slug);
  if (experimentalMatch) {
    return buildFallbackTrendDetailFromOverviewItem(experimentalMatch, overview);
  }

  return null;
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
    family: source.family ?? "other",
    status: source.status ?? "stale",
    latestFetchAt: source.latestFetchAt ?? null,
    latestSuccessAt: source.latestSuccessAt ?? null,
    rawItemCount: source.rawItemCount ?? 0,
    latestItemCount: source.latestItemCount ?? 0,
    keptItemCount: source.keptItemCount ?? source.latestItemCount ?? 0,
    yieldRatePercent: source.yieldRatePercent ?? 0,
    signalYieldRatio: source.signalYieldRatio ?? 0,
    durationMs: source.durationMs ?? 0,
    rawTopicCount: source.rawTopicCount ?? 0,
    mergedTopicCount: source.mergedTopicCount ?? 0,
    duplicateTopicCount: source.duplicateTopicCount ?? 0,
    duplicateTopicRate: source.duplicateTopicRate ?? 0,
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
      rawTopicCount: run.rawTopicCount ?? 0,
      mergedTopicCount: run.mergedTopicCount ?? 0,
      duplicateTopicCount: run.duplicateTopicCount ?? 0,
      duplicateTopicRate: run.duplicateTopicRate ?? 0,
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
  if (SUPABASE_PAYLOADS_ENABLED) {
    try {
      payload = await readSupabasePayload<TrendDetailIndexResponse>("trend-detail-index.v2.json");
      return normalizeTrendDetailIndex(payload);
    } catch { /* fall through to file */ }
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

export function normalizeTrendDetailRecord(trend: TrendDetailRecord): TrendDetailRecord {
  return {
    ...trend,
    category: trend.category ?? "general-tech",
    metaTrend: trend.metaTrend ?? "General",
    stage: trend.stage ?? "steady",
    confidence: trend.confidence ?? 0,
    summary: trend.summary ?? "",
    whyNow: trend.whyNow ?? [],
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
      discovery: trend.opportunity?.discovery ?? 0,
      seo: trend.opportunity?.seo ?? 0,
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
    aliases: trend.aliases ?? [],
    history: trend.history ?? [],
    sourceBreakdown: trend.sourceBreakdown ?? [],
    sourceContributions: trend.sourceContributions ?? [],
    marketFootprint: (trend.marketFootprint ?? []).map((metric) => ({
      source: metric.source,
      metricKey: metric.metricKey ?? "metric",
      label: metric.label ?? metric.source,
      valueNumeric: metric.valueNumeric ?? 0,
      valueDisplay: metric.valueDisplay ?? "0",
      unit: metric.unit ?? "",
      period: metric.period ?? "",
      capturedAt: metric.capturedAt ?? trend.latestSignalAt,
      confidence: metric.confidence ?? 0,
      provenanceUrl: metric.provenanceUrl ?? null,
      isEstimated: metric.isEstimated ?? false,
    })),
    geoSummary: trend.geoSummary ?? [],
    evidenceItems: (trend.evidenceItems ?? []).map((item) => ({
      ...item,
      evidenceUrl: item.evidenceUrl ?? null,
      languageCode: item.languageCode ?? null,
      audienceFlags: item.audienceFlags ?? [],
      marketFlags: item.marketFlags ?? [],
    })),
    audienceSummary: trend.audienceSummary ?? [],
    primaryEvidence: trend.primaryEvidence
      ? {
          ...trend.primaryEvidence,
          evidenceUrl: trend.primaryEvidence.evidenceUrl ?? null,
        }
      : null,
    duplicateCandidates: (trend.duplicateCandidates ?? []).map((item) => ({
      ...item,
      similarity: item.similarity ?? 0,
      reason: item.reason ?? "",
    })),
    relatedTrends: (trend.relatedTrends ?? []).map((item) => ({
      ...item,
      relationshipStrength: item.relationshipStrength ?? 0,
    })),
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

export function buildFallbackTrendDetailFromExplorer(
  trend: TrendExplorerRecord,
  generatedAt: string,
): TrendDetailRecord {
  const latestSignalAt = trend.latestSignalAt || generatedAt;
  return normalizeTrendDetailRecord({
    id: trend.id,
    name: trend.name,
    category: trend.category,
    metaTrend: trend.metaTrend,
    stage: trend.stage,
    confidence: trend.confidence,
    summary: trend.summary || "This topic is available in the explorer, but full detail enrichment has not been generated yet.",
    whyNow: trend.evidencePreview.length > 0 ? trend.evidencePreview.slice(0, 3) : ["Detail enrichment is still catching up for this trend."],
    status: trend.status,
    volatility: trend.volatility,
    rank: trend.rank,
    previousRank: trend.previousRank,
    rankChange: trend.rankChange,
    firstSeenAt: trend.firstSeenAt,
    latestSignalAt,
    score: trend.score,
    momentum: trend.momentum,
    breakoutPrediction: {
      confidence: trend.confidence,
      predictedDirection: trend.forecastDirection ?? "stable",
      signals: trend.evidencePreview.slice(0, 3),
    },
    forecast: null,
    opportunity: {
      composite: trend.score.total / 100,
      discovery: trend.score.total / 100,
      seo: trend.score.search / 100,
      content: trend.score.social / 100,
      product: trend.score.developer / 100,
      investment: trend.score.diversity / 100,
      reasoning: ["Full opportunity reasoning is not available for this trend yet."],
    },
    coverage: trend.coverage,
    sources: trend.sources,
    aliases: [],
    history: trend.recentHistory ?? [],
    sourceBreakdown: trend.sources.map((source) => ({
      source,
      signalCount: 0,
      latestSignalAt,
    })),
    sourceContributions: [],
    marketFootprint: [],
    geoSummary: [],
    audienceSummary: trend.audienceSummary ?? [],
    evidenceItems:
      trend.primaryEvidence != null
        ? [trend.primaryEvidence]
        : [],
    primaryEvidence: trend.primaryEvidence ?? null,
    duplicateCandidates: [],
    relatedTrends: [],
    seasonality: trend.seasonality ?? null,
  });
}

export function buildFallbackTrendDetailFromOverviewItem(
  trend: DashboardOverviewResponse["sections"]["experimentalTrends"][number],
  overview: DashboardOverviewResponse,
): TrendDetailRecord {
  return normalizeTrendDetailRecord({
    id: trend.id,
    name: trend.name,
    category: trend.category,
    metaTrend: "Experimental",
    stage: "nascent",
    confidence: 0.35,
    summary: "This topic is currently surfaced as an experimental candidate before full detail enrichment is available.",
    whyNow: ["This topic is currently ranked in the experimental bucket."],
    status: "experimental",
    volatility: "emerging",
    rank: trend.rank,
    previousRank: null,
    rankChange: null,
    firstSeenAt: null,
    latestSignalAt: overview.generatedAt,
    score: {
      total: trend.scoreTotal,
      social: 0,
      developer: 0,
      knowledge: 0,
      search: 0,
      diversity: 0,
    },
    momentum: {
      previousRank: null,
      rankChange: null,
      absoluteDelta: null,
      percentDelta: null,
    },
    breakoutPrediction: {
      confidence: 0.35,
      predictedDirection: "experimental",
      signals: [],
    },
    forecast: null,
    opportunity: {
      composite: 0,
      discovery: 0,
      seo: 0,
      content: 0,
      product: 0,
      investment: 0,
      reasoning: ["Experimental candidates do not have full scoring decomposition yet."],
    },
    coverage: {
      sourceCount: 0,
      signalCount: 0,
    },
    sources: [],
    aliases: [],
    history: [],
    sourceBreakdown: [],
    sourceContributions: [],
    marketFootprint: [],
    geoSummary: [],
    audienceSummary: [],
    evidenceItems: [],
    primaryEvidence: null,
    duplicateCandidates: [],
    relatedTrends: [],
    seasonality: null,
  });
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
  if (SUPABASE_PAYLOADS_ENABLED) {
    try {
      payload = await readSupabasePayload<SourceSummaryResponse>("source-summary.v2.json");
      return normalizeSourceSummary(payload);
    } catch { /* fall through to file */ }
  }
  payload = await readJsonFile<SourceSummaryResponse>("source-summary.v2.json", {
    generatedAt: new Date(0).toISOString(),
    sources: [],
    familyHistory: [],
  });
  return normalizeSourceSummary(payload);
}

export function normalizeSourceSummary(payload: SourceSummaryResponse): SourceSummaryResponse {
  const sources = (payload.sources ?? []).map((source) => ({
    source: source.source,
    family: source.family ?? "other",
    status: source.status ?? "stale",
    latestFetchAt: source.latestFetchAt ?? null,
    latestSuccessAt: source.latestSuccessAt ?? null,
    rawItemCount: source.rawItemCount ?? 0,
    latestItemCount: source.latestItemCount ?? 0,
    keptItemCount: source.keptItemCount ?? source.latestItemCount ?? 0,
    yieldRatePercent: source.yieldRatePercent ?? 0,
    signalYieldRatio: source.signalYieldRatio ?? 0,
    durationMs: source.durationMs ?? 0,
    rawTopicCount: source.rawTopicCount ?? 0,
    mergedTopicCount: source.mergedTopicCount ?? 0,
    duplicateTopicCount: source.duplicateTopicCount ?? 0,
    duplicateTopicRate: source.duplicateTopicRate ?? 0,
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
      rawTopicCount: run.rawTopicCount ?? 0,
      mergedTopicCount: run.mergedTopicCount ?? 0,
      duplicateTopicCount: run.duplicateTopicCount ?? 0,
      duplicateTopicRate: run.duplicateTopicRate ?? 0,
      usedFallback: run.usedFallback ?? false,
      errorMessage: run.errorMessage ?? null,
    })),
    topTrends: source.topTrends ?? [],
  }));
  return {
    generatedAt: payload.generatedAt,
    sources,
    familyHistory: (payload.familyHistory ?? []).map((family) => ({
      family: family.family ?? "other",
      label: family.label ?? family.family ?? "Other",
      capturedAt: family.capturedAt,
      sourceCount: family.sourceCount ?? 0,
      healthySourceCount: family.healthySourceCount ?? 0,
      signalCount: family.signalCount ?? 0,
      trendCount: family.trendCount ?? 0,
      corroboratedTrendCount: family.corroboratedTrendCount ?? 0,
      topRankedTrendCount: family.topRankedTrendCount ?? 0,
      averageScore: family.averageScore ?? 0,
      averageYieldRatePercent: family.averageYieldRatePercent ?? 0,
      successRatePercent: family.successRatePercent ?? 0,
    })),
  };
}

export async function loadSourceSummaries(): Promise<SourceSummaryResponse> {
  return readSourceSummary();
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  for (const directory of DATA_DIRECTORIES) {
    try {
      const filePath = path.join(directory, filename);
      const contents = await fs.readFile(filePath, "utf8");
      return JSON.parse(contents) as T;
    } catch {
      continue;
    }
  }
  return fallback;
}

async function readSupabasePayload<T>(payloadKey: string): Promise<T> {
  const response = await fetch(buildSupabasePayloadUrl(payloadKey), {
    method: "GET",
    headers: {
      apikey: SUPABASE_ACCESS_KEY!,
      Authorization: `Bearer ${SUPABASE_ACCESS_KEY!}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load Supabase payload ${payloadKey}: ${response.status}`);
  }
  const rows = (await response.json()) as Array<{ payload_json: T | string }>;
  if (rows.length === 0) {
    throw new Error(`Missing Supabase payload ${payloadKey}`);
  }
  const payload = rows[0]?.payload_json;
  return typeof payload === "string" ? (JSON.parse(payload) as T) : (payload as T);
}

function buildSupabasePayloadUrl(payloadKey: string): string {
  const url = new URL("/rest/v1/published_payloads", SUPABASE_URL);
  url.searchParams.set("select", "payload_json");
  url.searchParams.set("payload_key", `eq.${payloadKey}`);
  url.searchParams.set("limit", "1");
  return url.toString();
}
