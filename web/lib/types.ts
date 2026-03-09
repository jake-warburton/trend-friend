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

export type DashboardOverviewSource = {
  source: string;
  signalCount: number;
  trendCount: number;
  status: string;
  latestFetchAt: string | null;
  latestSuccessAt: string | null;
  latestItemCount: number;
  errorMessage: string | null;
};

export type DashboardOverviewResponse = {
  generatedAt: string;
  summary: DashboardOverviewSummary;
  highlights: DashboardOverviewHighlights;
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

export type TrendDetailRecord = {
  id: string;
  name: string;
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
};

export type TrendDetailIndexResponse = {
  generatedAt: string;
  trends: TrendDetailRecord[];
};
