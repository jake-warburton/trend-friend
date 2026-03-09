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
  explorer: TrendExplorerResponse;
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
