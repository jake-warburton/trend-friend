export type TrendScore = {
  total: number;
  social: number;
  developer: number;
  knowledge: number;
  search: number;
  advertising: number;
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

export type ExploreInitialData = {
  overview: DashboardOverviewResponse;
  explorer: TrendExplorerResponse;
};

export type ExploreDeferredData = {
  history: TrendHistoryResponse;
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
  category: string;
  status: string;
  rank: number;
  scoreTotal: number;
};

export type DashboardOverviewMetaTrend = {
  category: string;
  trendCount: number;
  averageScore: number;
  topTrendId: string;
  topTrendName: string;
};

export type DashboardOverviewSections = {
  topTrends: DashboardOverviewTrendItem[];
  breakoutTrends: DashboardOverviewTrendItem[];
  risingTrends: DashboardOverviewTrendItem[];
  experimentalTrends: DashboardOverviewTrendItem[];
  metaTrends: DashboardOverviewMetaTrend[];
};

export type DashboardOverviewSource = {
  source: string;
  family: string;
  signalCount: number;
  trendCount: number;
  status: string;
  latestFetchAt: string | null;
  latestSuccessAt: string | null;
  rawItemCount: number;
  latestItemCount: number;
  keptItemCount: number;
  yieldRatePercent: number;
  signalYieldRatio?: number;
  durationMs: number;
  rawTopicCount: number;
  mergedTopicCount: number;
  duplicateTopicCount: number;
  duplicateTopicRate: number;
  usedFallback: boolean;
  errorMessage: string | null;
};

export type DashboardOverviewSourceWatch = {
  source: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
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
  rawTopicCount: number;
  mergedTopicCount: number;
  duplicateTopicCount: number;
  duplicateTopicRate: number;
  multiSourceTrendCount: number;
  lowEvidenceTrendCount: number;
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
  sourceWatch?: DashboardOverviewSourceWatch[];
};

export type TrendMomentum = {
  previousRank: number | null;
  rankChange: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
};

export type BreakoutPrediction = {
  confidence: number;
  predictedDirection: string;
  signals: string[];
};

export type TrendForecast = {
  predictedScores: number[];
  confidence: string;
  mape: number;
  method: string;
};

export type SeasonalitySummary = {
  tag: string | null;
  recurrenceCount: number;
  avgGapRuns: number;
  confidence: number;
};

export type OpportunitySummary = {
  composite: number;
  discovery: number;
  seo: number;
  content: number;
  product: number;
  investment: number;
  reasoning: string[];
};

export type TrendCoverage = {
  sourceCount: number;
  signalCount: number;
};

export type TrendExplorerRecord = {
  id: string;
  name: string;
  category: string;
  metaTrend: string;
  stage: string;
  confidence: number;
  summary: string;
  status: string;
  volatility: string;
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
  audienceSummary?: TrendAudienceSegment[];
  primaryEvidence?: TrendEvidenceItem | null;
  recentHistory?: TrendHistoryPoint[];
  seasonality?: SeasonalitySummary | null;
  forecastDirection?: string | null;
  breaking?: TrendBreaking | null;
};

export type TrendBreaking = {
  breakingScore: number;
  corroborated: boolean;
  accountCount: number;
  tweets: BreakingTweet[];
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
  evidenceUrl: string | null;
  languageCode?: string | null;
  audienceFlags?: string[];
  marketFlags?: string[];
  geoFlags: string[];
  geoCountryCode: string | null;
  geoRegion: string | null;
  geoDetectionMode: string;
  geoConfidence: number;
};

export type TrendGeoSummary = {
  label: string;
  countryCode: string | null;
  region: string | null;
  signalCount: number;
  explicitCount: number;
  inferredCount: number;
  averageConfidence: number;
};

export type TrendAudienceSegment = {
  segmentType: string;
  label: string;
  signalCount: number;
};

export type TrendSourceContribution = {
  source: string;
  signalCount: number;
  latestSignalAt: string;
  estimatedScore: number;
  scoreSharePercent: number;
  score: TrendScore;
};

export type TrendMarketMetric = {
  source: string;
  metricKey: string;
  label: string;
  valueNumeric: number;
  valueDisplay: string;
  unit: string;
  period: string;
  capturedAt: string;
  confidence: number;
  provenanceUrl: string | null;
  isEstimated: boolean;
};

export type RelatedTrend = {
  id: string;
  name: string;
  status: string;
  rank: number;
  scoreTotal: number;
  relationshipStrength: number;
};

export type TrendDuplicateCandidate = {
  id: string;
  name: string;
  similarity: number;
  reason: string;
};

export type TrendDetailRecord = {
  id: string;
  name: string;
  category: string;
  metaTrend: string;
  stage: string;
  confidence: number;
  summary: string;
  whyNow: string[];
  status: string;
  volatility: string;
  rank: number;
  previousRank: number | null;
  rankChange: number | null;
  firstSeenAt: string | null;
  latestSignalAt: string;
  score: TrendScore;
  momentum: TrendMomentum;
  breakoutPrediction: BreakoutPrediction;
  forecast?: TrendForecast | null;
  opportunity: OpportunitySummary;
  coverage: TrendCoverage;
  sources: string[];
  aliases: string[];
  history: TrendHistoryPoint[];
  sourceBreakdown: TrendSourceBreakdown[];
  sourceContributions: TrendSourceContribution[];
  marketFootprint: TrendMarketMetric[];
  geoSummary: TrendGeoSummary[];
  audienceSummary: TrendAudienceSegment[];
  evidenceItems: TrendEvidenceItem[];
  primaryEvidence?: TrendEvidenceItem | null;
  duplicateCandidates: TrendDuplicateCandidate[];
  relatedTrends: RelatedTrend[];
  seasonality?: SeasonalitySummary | null;
  wikipediaExtract?: string | null;
  wikipediaDescription?: string | null;
  wikipediaThumbnailUrl?: string | null;
  wikipediaPageUrl?: string | null;
  breaking?: TrendBreaking | null;
};

export type TrendDetailIndexResponse = {
  generatedAt: string;
  trends: TrendDetailRecord[];
};

export type SourceRun = {
  fetchedAt: string;
  success: boolean;
  rawItemCount: number;
  itemCount: number;
  keptItemCount: number;
  yieldRatePercent: number;
  durationMs: number;
  rawTopicCount: number;
  mergedTopicCount: number;
  duplicateTopicCount: number;
  duplicateTopicRate: number;
  usedFallback: boolean;
  errorMessage: string | null;
};

export type SourceSummaryTrend = {
  id: string;
  name: string;
  rank: number;
  scoreTotal: number;
};

export type SourceFamilySnapshot = {
  family: string;
  label: string;
  capturedAt: string;
  sourceCount: number;
  healthySourceCount: number;
  signalCount: number;
  trendCount: number;
  corroboratedTrendCount: number;
  topRankedTrendCount: number;
  averageScore: number;
  averageYieldRatePercent: number;
  successRatePercent: number;
};

export type SourceSummaryRecord = {
  source: string;
  family: string;
  status: string;
  latestFetchAt: string | null;
  latestSuccessAt: string | null;
  rawItemCount: number;
  latestItemCount: number;
  keptItemCount: number;
  yieldRatePercent: number;
  signalYieldRatio?: number;
  durationMs: number;
  rawTopicCount: number;
  mergedTopicCount: number;
  duplicateTopicCount: number;
  duplicateTopicRate: number;
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
  familyHistory: SourceFamilySnapshot[];
};

export type WatchlistItem = {
  trendId: string;
  trendName: string;
  addedAt: string;
  geoSummary?: TrendGeoSummary[];
};

export type SharedWatchlistItem = WatchlistItem & {
  currentScore: number | null;
  rank: number | null;
  rankChange: number | null;
  status: string | null;
  category: string | null;
  sources: string[];
  audienceSummary?: TrendAudienceSegment[];
  sourceContributions?: TrendSourceContribution[];
};

export type WatchlistShare = {
  id: number;
  shareToken: string;
  public: boolean;
  showCreator: boolean;
  expiresAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  accessHistory: Array<{
    date: string;
    count: number;
  }>;
  createdAt: string;
};

export type WatchlistShareEvent = {
  id: number;
  shareId: number | null;
  eventType: string;
  detail: string;
  createdAt: string;
};

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  accountTier: "free" | "pro";
  createdAt: string;
};

export type Watchlist = {
  id: number;
  name: string;
  ownerUserId: number | null;
  ownedByCurrentUser: boolean;
  defaultShareExpiryDays: number | null;
  createdAt: string;
  updatedAt: string;
  items: WatchlistItem[];
  shares: WatchlistShare[];
  shareEvents: WatchlistShareEvent[];
};

export type AlertRule = {
  id: number;
  watchlistId: number;
  thesisId?: number | null;
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
  authEnabled?: boolean;
  currentUser?: AuthUser | null;
  watchlists: Watchlist[];
  alerts: AlertRule[];
  matches: AlertMatch[];
  theses?: TrendThesis[];
  thesisMatches?: TrendThesisMatch[];
};

export type TrendThesis = {
  id: number;
  watchlistId: number;
  name: string;
  lens: string;
  keywordQuery?: string | null;
  source?: string | null;
  category?: string | null;
  stage?: string | null;
  confidence?: string | null;
  metaTrend?: string | null;
  audience?: string | null;
  market?: string | null;
  language?: string | null;
  geoCountry?: string | null;
  minimumScore: number;
  hideRecurring: boolean;
  notifyOnMatch: boolean;
  activeMatchCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TrendThesisMatch = {
  thesisId: number;
  trendId: string;
  trendName: string;
  active: boolean;
  firstMatchedAt: string;
  lastMatchedAt: string;
  lensScore: number;
  totalScore: number;
  stage?: string | null;
  metaTrend?: string | null;
  confidence?: number | null;
};

export type PublicTrendThesis = {
  id: number;
  name: string;
  lens: string;
  notifyOnMatch: boolean;
};

export type SharedWatchlistResponse = {
  watchlist: {
    id: number;
    name: string;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
    items: SharedWatchlistItem[];
  };
  shareToken: string;
  public: boolean;
  showCreator?: boolean;
  ownerDisplayName?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

export type PublicWatchlistSummary = {
  id: number;
  name: string;
  itemCount: number;
  shareToken: string;
  showCreator?: boolean;
  ownerDisplayName?: string | null;
  expiresAt?: string | null;
  accessCount?: number;
  recentOpenCount?: number;
  lastAccessedAt?: string | null;
  popularThisWeek?: boolean;
  createdAt: string;
  updatedAt: string;
  categories?: string[];
  statuses?: string[];
  geoSummary?: TrendGeoSummary[];
  audienceSummary?: TrendAudienceSegment[];
  sourceContributions?: TrendSourceContribution[];
  theses?: PublicTrendThesis[];
};

export type PublicWatchlistsResponse = {
  watchlists: PublicWatchlistSummary[];
};

export type AlertEvent = {
  id: number;
  ruleId: number;
  watchlistId: number;
  trendId: string;
  trendName: string;
  ruleType: string;
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: string;
  read: boolean;
};

export type AlertEventsResponse = {
  alerts: AlertEvent[];
};

export type AuthStatusResponse = {
  authEnabled: boolean;
  user: AuthUser | null;
};

export type NotificationLogEntry = {
  id: number;
  sentAt: string;
  statusCode: number | null;
  error: string | null;
};

export type NotificationChannel = {
  id: number;
  channelType: string;
  destination: string;
  label: string;
  enabled: boolean;
  createdAt: string;
  recentLogs: NotificationLogEntry[];
};

export type NotificationChannelsResponse = {
  channels: NotificationChannel[];
};

export type BreakingTweet = {
  account: string;
  text: string;
  tweetId: string;
  timestamp: string;
  engagement: number;
};

export type BreakingItem = {
  topic: string;
  breakingScore: number;
  corroborated: boolean;
  accountCount: number;
  tweets: BreakingTweet[];
};

export type BreakingFeed = {
  updatedAt: string;
  items: BreakingItem[];
};

export type AdIntelligenceKeyword = {
  keyword: string;
  cpc: number;
  searchVolume: number;
  competitionLevel: string;
  adDensity: number;
  platforms: string[];
  topAdvertisers: string[];
  trendId: string | null;
  category: string | null;
};

export type AdIntelligenceAdvertiser = {
  name: string;
  platform: string;
  adCount: number;
  adFormats: string[];
  regions: string[];
};

export type AdIntelligencePlatformSummary = {
  platform: string;
  adCount: number;
  keywordCount: number;
  advertiserCount: number;
};

export type AdIntelligenceResponse = {
  generatedAt: string;
  topKeywords: AdIntelligenceKeyword[];
  topAdvertisers: AdIntelligenceAdvertiser[];
  platformSummary: AdIntelligencePlatformSummary[];
};
