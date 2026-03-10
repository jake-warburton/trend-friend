export type TrendScore = {
  total: number;
  social: number;
  developer: number;
  knowledge: number;
  search: number;
  diversity: number;
};

export type TrendRecord = {
  id: string;
  name: string;
  rank: number;
  score: TrendScore;
  sources: string[];
  evidence: string[];
  latestSignalAt: string;
};

export type LatestTrendsResponse = {
  generatedAt: string;
  trends: TrendRecord[];
};

export type TrendSnapshot = {
  capturedAt: string;
  trends: TrendRecord[];
};

export type TrendHistoryResponse = {
  generatedAt: string;
  snapshots: TrendSnapshot[];
};

export type DashboardData = {
  latest: LatestTrendsResponse;
  history: TrendHistoryResponse;
  overview: DashboardOverviewResponse;
  explorer: TrendExplorerResponse;
  details: TrendDetailIndexResponse;
  sourceSummary: SourceSummaryResponse;
};

export type DashboardOverviewSummary = {
  trackedTrends: number;
  totalSignals: number;
  sourceCount: number;
  averageScore: number;
};

export type DashboardOverviewHighlights = {
  topTrendId: string | null;
  topTrendName: string | null;
  biggestMoverId: string | null;
  biggestMoverName: string | null;
  newestTrendId: string | null;
  newestTrendName: string | null;
};

export type DashboardChartDatum = {
  label: string;
  value: number;
};

export type DashboardOverviewCharts = {
  topTrendScores: DashboardChartDatum[];
  sourceShare: DashboardChartDatum[];
  statusBreakdown: DashboardChartDatum[];
};

export type DashboardOverviewTrendItem = {
  id: string;
  name: string;
  status: string;
  rank: number;
  scoreTotal: number;
};

export type DashboardOverviewSections = {
  topTrends: DashboardOverviewTrendItem[];
  breakoutTrends: DashboardOverviewTrendItem[];
  risingTrends: DashboardOverviewTrendItem[];
};

export type DashboardOverviewSource = {
  source: string;
  signalCount: number;
  trendCount: number;
  status: string;
  latestFetchAt: string | null;
  latestSuccessAt: string | null;
  latestItemCount: number;
  durationMs: number;
  usedFallback: boolean;
  errorMessage: string | null;
};

export type DashboardOverviewRun = {
  capturedAt: string;
  durationMs: number;
  sourceCount: number;
  successfulSourceCount: number;
  failedSourceCount: number;
  signalCount: number;
  rankedTrendCount: number;
  status: string;
  topTrendId: string | null;
  topTrendName: string | null;
  topScore: number | null;
};

export type DashboardOverviewOperations = {
  lastRunAt: string | null;
  successRate: number;
  averageDurationMs: number;
  recentRuns: DashboardOverviewRun[];
};

export type DashboardOverviewResponse = {
  generatedAt: string;
  summary: DashboardOverviewSummary;
  highlights: DashboardOverviewHighlights;
  charts: DashboardOverviewCharts;
  sections: DashboardOverviewSections;
  operations: DashboardOverviewOperations;
  sources: DashboardOverviewSource[];
};

export type TrendMomentum = {
  previousRank: number | null;
  rankChange: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
};

export type TrendCoverage = {
  sourceCount: number;
  signalCount: number;
};

export type TrendExplorerRecord = {
  id: string;
  name: string;
  status: string;
  rank: number;
  previousRank: number | null;
  rankChange: number | null;
  firstSeenAt: string | null;
  latestSignalAt: string;
  score: TrendScore;
  momentum: TrendMomentum;
  coverage: TrendCoverage;
  sources: string[];
  evidencePreview: string[];
};

export type TrendExplorerResponse = {
  generatedAt: string;
  trends: TrendExplorerRecord[];
};

export type TrendHistoryPoint = {
  capturedAt: string;
  rank: number;
  scoreTotal: number;
};

export type TrendSourceBreakdown = {
  source: string;
  signalCount: number;
  latestSignalAt: string;
};

export type TrendEvidenceItem = {
  source: string;
  signalType: string;
  timestamp: string;
  value: number;
  evidence: string;
};

export type RelatedTrend = {
  id: string;
  name: string;
  status: string;
  rank: number;
  scoreTotal: number;
};

export type TrendDetailRecord = {
  id: string;
  name: string;
  status: string;
  rank: number;
  previousRank: number | null;
  rankChange: number | null;
  firstSeenAt: string | null;
  latestSignalAt: string;
  score: TrendScore;
  momentum: TrendMomentum;
  coverage: TrendCoverage;
  sources: string[];
  history: TrendHistoryPoint[];
  sourceBreakdown: TrendSourceBreakdown[];
  evidenceItems: TrendEvidenceItem[];
  relatedTrends: RelatedTrend[];
};

export type TrendDetailIndexResponse = {
  generatedAt: string;
  trends: TrendDetailRecord[];
};

export type SourceRun = {
  fetchedAt: string;
  success: boolean;
  itemCount: number;
  durationMs: number;
  usedFallback: boolean;
  errorMessage: string | null;
};

export type SourceSummaryTrend = {
  id: string;
  name: string;
  rank: number;
  scoreTotal: number;
};

export type SourceSummaryRecord = {
  source: string;
  status: string;
  latestFetchAt: string | null;
  latestSuccessAt: string | null;
  latestItemCount: number;
  durationMs: number;
  usedFallback: boolean;
  errorMessage: string | null;
  signalCount: number;
  trendCount: number;
  runHistory: SourceRun[];
  topTrends: SourceSummaryTrend[];
};

export type SourceSummaryResponse = {
  generatedAt: string;
  sources: SourceSummaryRecord[];
};

export type WatchlistItem = {
  trendId: string;
  trendName: string;
  addedAt: string;
};

export type Watchlist = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: WatchlistItem[];
};

export type AlertRule = {
  id: number;
  watchlistId: number;
  name: string;
  ruleType: string;
  threshold: number;
  enabled: boolean;
  createdAt: string;
};

export type AlertMatch = {
  alertId: number;
  alertName: string;
  watchlistId: number;
  trendId: string;
  trendName: string;
  ruleType: string;
  threshold: number;
  currentValue: number;
};

export type WatchlistResponse = {
  watchlists: Watchlist[];
  alerts: AlertRule[];
  matches: AlertMatch[];
};
