"""Frontend-facing data contracts."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class TrendScoreComponents:
    """Public score breakdown for a trend."""

    total: float
    social: float
    developer: float
    knowledge: float
    search: float
    advertising: float
    diversity: float


@dataclass(frozen=True)
class TrendRecord:
    """Public trend record consumed by the web app."""

    id: str
    name: str
    rank: int
    score: TrendScoreComponents
    sources: list[str]
    evidence: list[str]
    latest_signal_at: str


@dataclass(frozen=True)
class LatestTrendsPayload:
    """Latest trend snapshot payload."""

    generated_at: str
    trends: list[TrendRecord]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        return {
            "generatedAt": self.generated_at,
            "trends": [trend_to_dict(trend) for trend in self.trends],
        }


@dataclass(frozen=True)
class TrendSnapshotPayload:
    """Historical snapshot payload."""

    captured_at: str
    trends: list[TrendRecord]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        return {
            "capturedAt": self.captured_at,
            "trends": [trend_to_dict(trend) for trend in self.trends],
        }


@dataclass(frozen=True)
class TrendHistoryPayload:
    """Historical trend response."""

    generated_at: str
    snapshots: list[TrendSnapshotPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        return {
            "generatedAt": self.generated_at,
            "snapshots": [snapshot.to_dict() for snapshot in self.snapshots],
        }


@dataclass(frozen=True)
class TrendMomentumPayload:
    """Public movement metrics for a trend."""

    previous_rank: int | None
    rank_change: int | None
    absolute_delta: float | None
    percent_delta: float | None


@dataclass(frozen=True)
class BreakoutPredictionPayload:
    """Breakout prediction exposed on detail pages."""

    confidence: float
    predicted_direction: str
    signals: list[str]


@dataclass(frozen=True)
class TrendForecastPayload:
    """Short-horizon forecast exposed on trend detail pages."""

    predicted_scores: list[float]
    confidence: str
    mape: float
    method: str


@dataclass(frozen=True)
class SeasonalityPayload:
    """Derived recurrence metadata exposed on trend surfaces."""

    tag: str | None
    recurrence_count: int
    avg_gap_runs: float
    confidence: float


@dataclass(frozen=True)
class OpportunityPayload:
    """Opportunity scoring exposed on detail pages."""

    composite: float
    discovery: float
    seo: float
    content: float
    product: float
    investment: float
    reasoning: list[str]


@dataclass(frozen=True)
class TrendCoveragePayload:
    """Public coverage metrics for a trend."""

    source_count: int
    signal_count: int


@dataclass(frozen=True)
class TrendPrimaryEvidencePayload:
    """Compact linked evidence item exposed on explorer/detail surfaces."""

    source: str
    signal_type: str
    timestamp: str
    value: float
    evidence: str
    evidence_url: str


@dataclass(frozen=True)
class TrendExplorerRecordPayload:
    """Public explorer record consumed by the dashboard V2."""

    id: str
    name: str
    category: str
    meta_trend: str
    stage: str
    confidence: float
    summary: str
    status: str
    volatility: str
    rank: int
    previous_rank: int | None
    rank_change: int | None
    first_seen_at: str | None
    latest_signal_at: str
    score: TrendScoreComponents
    momentum: TrendMomentumPayload
    coverage: TrendCoveragePayload
    sources: list[str]
    evidence_preview: list[str]
    audience_summary: list[TrendAudienceSegmentPayload]
    primary_evidence: TrendPrimaryEvidencePayload | None
    recent_history: list[TrendHistoryPointPayload]
    seasonality: SeasonalityPayload | None = None
    forecast_direction: str | None = None


@dataclass(frozen=True)
class TrendExplorerPayload:
    """Explorer response for Dashboard V2."""

    generated_at: str
    trends: list[TrendExplorerRecordPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        return {
            "generatedAt": self.generated_at,
            "trends": [trend_explorer_record_to_dict(trend) for trend in self.trends],
        }


@dataclass(frozen=True)
class TrendHistoryPointPayload:
    """Historical score and rank point for a trend."""

    captured_at: str
    rank: int
    score_total: float


@dataclass(frozen=True)
class TrendSourceBreakdownPayload:
    """Source-level coverage metrics for a trend."""

    source: str
    signal_count: int
    latest_signal_at: str


@dataclass(frozen=True)
class TrendSourceContributionPayload:
    """Estimated score contribution of a source to a trend."""

    source: str
    signal_count: int
    latest_signal_at: str
    estimated_score: float
    score_share_percent: float
    score: TrendScoreComponents


@dataclass(frozen=True)
class TrendMarketMetricPayload:
    """Persisted market-footprint metric exposed on detail pages."""

    source: str
    metric_key: str
    label: str
    value_numeric: float
    value_display: str
    unit: str
    period: str
    captured_at: str
    confidence: float
    provenance_url: str | None
    is_estimated: bool


@dataclass(frozen=True)
class TrendEvidenceItemPayload:
    """Evidence item exposed on the trend detail page."""

    source: str
    signal_type: str
    timestamp: str
    value: float
    evidence: str
    evidence_url: str | None
    language_code: str | None
    audience_flags: list[str]
    market_flags: list[str]
    geo_flags: list[str]
    geo_country_code: str | None
    geo_region: str | None
    geo_detection_mode: str
    geo_confidence: float


@dataclass(frozen=True)
class TrendGeoSummaryPayload:
    """Aggregated geo footprint for a trend."""

    label: str
    country_code: str | None
    region: str | None
    signal_count: int
    explicit_count: int
    inferred_count: int
    average_confidence: float


@dataclass(frozen=True)
class TrendAudienceSegmentPayload:
    """Aggregated audience and market metadata for a trend."""

    segment_type: str
    label: str
    signal_count: int


@dataclass(frozen=True)
class RelatedTrendPayload:
    """Compact related trend entry for detail pages."""

    id: str
    name: str
    status: str
    rank: int
    score_total: float
    relationship_strength: float


@dataclass(frozen=True)
class TrendDuplicateCandidatePayload:
    """Potential duplicate trend entry for detail pages."""

    id: str
    name: str
    similarity: float
    reason: str


@dataclass(frozen=True)
class TrendDetailRecordPayload:
    """Detailed trend record consumed by trend detail pages."""

    id: str
    name: str
    category: str
    meta_trend: str
    stage: str
    confidence: float
    summary: str
    why_now: list[str]
    status: str
    volatility: str
    rank: int
    previous_rank: int | None
    rank_change: int | None
    first_seen_at: str | None
    latest_signal_at: str
    score: TrendScoreComponents
    momentum: TrendMomentumPayload
    breakout_prediction: BreakoutPredictionPayload
    forecast: TrendForecastPayload | None
    opportunity: OpportunityPayload
    coverage: TrendCoveragePayload
    sources: list[str]
    aliases: list[str]
    history: list[TrendHistoryPointPayload]
    source_breakdown: list[TrendSourceBreakdownPayload]
    source_contributions: list[TrendSourceContributionPayload]
    market_footprint: list[TrendMarketMetricPayload]
    geo_summary: list[TrendGeoSummaryPayload]
    audience_summary: list[TrendAudienceSegmentPayload]
    evidence_items: list[TrendEvidenceItemPayload]
    primary_evidence: TrendPrimaryEvidencePayload | None
    duplicate_candidates: list[TrendDuplicateCandidatePayload]
    related_trends: list[RelatedTrendPayload]
    seasonality: SeasonalityPayload | None = None
    wikipedia_extract: str | None = None
    wikipedia_description: str | None = None
    wikipedia_thumbnail_url: str | None = None
    wikipedia_page_url: str | None = None


@dataclass(frozen=True)
class TrendDetailIndexPayload:
    """Index response for trend detail pages."""

    generated_at: str
    trends: list[TrendDetailRecordPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        return {
            "generatedAt": self.generated_at,
            "trends": [trend_detail_record_to_dict(trend) for trend in self.trends],
        }


@dataclass(frozen=True)
class DashboardOverviewSummaryPayload:
    """Top-level dashboard summary metrics."""

    tracked_trends: int
    total_signals: int
    source_count: int
    average_score: float


@dataclass(frozen=True)
class DashboardOverviewHighlightsPayload:
    """Headline trends for the dashboard overview."""

    top_trend_id: str | None
    top_trend_name: str | None
    biggest_mover_id: str | None
    biggest_mover_name: str | None
    newest_trend_id: str | None
    newest_trend_name: str | None


@dataclass(frozen=True)
class DashboardOverviewChartDatumPayload:
    """Chart-ready label/value pair for overview visualizations."""

    label: str
    value: float


@dataclass(frozen=True)
class DashboardOverviewChartsPayload:
    """Compact chart datasets exposed to the homepage."""

    top_trend_scores: list[DashboardOverviewChartDatumPayload]
    source_share: list[DashboardOverviewChartDatumPayload]
    status_breakdown: list[DashboardOverviewChartDatumPayload]


@dataclass(frozen=True)
class DashboardOverviewTrendItemPayload:
    """Compact trend item used in curated overview sections."""

    id: str
    name: str
    category: str
    status: str
    rank: int
    score_total: float


@dataclass(frozen=True)
class DashboardOverviewMetaTrendPayload:
    """Compact category summary for the overview page."""

    category: str
    trend_count: int
    average_score: float
    top_trend_id: str
    top_trend_name: str


@dataclass(frozen=True)
class DashboardOverviewSectionsPayload:
    """Curated overview lists shown on the landing page."""

    top_trends: list[DashboardOverviewTrendItemPayload]
    breakout_trends: list[DashboardOverviewTrendItemPayload]
    rising_trends: list[DashboardOverviewTrendItemPayload]
    experimental_trends: list[DashboardOverviewTrendItemPayload]
    meta_trends: list[DashboardOverviewMetaTrendPayload]


@dataclass(frozen=True)
class DashboardOverviewSourcePayload:
    """Source-level aggregate for overview and source health summary."""

    source: str
    family: str
    signal_count: int
    trend_count: int
    status: str
    latest_fetch_at: str | None
    latest_success_at: str | None
    raw_item_count: int
    latest_item_count: int
    kept_item_count: int
    yield_rate_percent: float
    signal_yield_ratio: float
    duration_ms: int
    raw_topic_count: int
    merged_topic_count: int
    duplicate_topic_count: int
    duplicate_topic_rate: float
    used_fallback: bool
    error_message: str | None


@dataclass(frozen=True)
class DashboardOverviewSourceWatchPayload:
    """Operational source warning surfaced on the dashboard."""

    source: str
    severity: str
    title: str
    detail: str


@dataclass(frozen=True)
class DashboardOverviewRunPayload:
    """Recent pipeline execution summary shown on the dashboard."""

    captured_at: str
    duration_ms: int
    source_count: int
    successful_source_count: int
    failed_source_count: int
    signal_count: int
    ranked_trend_count: int
    status: str
    top_trend_id: str | None
    top_trend_name: str | None
    top_score: float | None
    raw_topic_count: int
    merged_topic_count: int
    duplicate_topic_count: int
    duplicate_topic_rate: float
    multi_source_trend_count: int
    low_evidence_trend_count: int


@dataclass(frozen=True)
class DashboardOverviewOperationsPayload:
    """Operational summary for recent pipeline executions."""

    last_run_at: str | None
    success_rate: float
    average_duration_ms: int
    recent_runs: list[DashboardOverviewRunPayload]


@dataclass(frozen=True)
class DashboardOverviewPayload:
    """Overview response for the dashboard landing page."""

    generated_at: str
    summary: DashboardOverviewSummaryPayload
    highlights: DashboardOverviewHighlightsPayload
    charts: DashboardOverviewChartsPayload
    sections: DashboardOverviewSectionsPayload
    operations: DashboardOverviewOperationsPayload
    sources: list[DashboardOverviewSourcePayload]
    source_watch: list[DashboardOverviewSourceWatchPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        payload = asdict(self)
        payload["generatedAt"] = payload.pop("generated_at")
        payload["summary"]["trackedTrends"] = payload["summary"].pop("tracked_trends")
        payload["summary"]["totalSignals"] = payload["summary"].pop("total_signals")
        payload["summary"]["sourceCount"] = payload["summary"].pop("source_count")
        payload["summary"]["averageScore"] = payload["summary"].pop("average_score")
        payload["highlights"]["topTrendId"] = payload["highlights"].pop("top_trend_id")
        payload["highlights"]["topTrendName"] = payload["highlights"].pop("top_trend_name")
        payload["highlights"]["biggestMoverId"] = payload["highlights"].pop("biggest_mover_id")
        payload["highlights"]["biggestMoverName"] = payload["highlights"].pop("biggest_mover_name")
        payload["highlights"]["newestTrendId"] = payload["highlights"].pop("newest_trend_id")
        payload["highlights"]["newestTrendName"] = payload["highlights"].pop("newest_trend_name")
        payload["charts"]["topTrendScores"] = payload["charts"].pop("top_trend_scores")
        payload["charts"]["sourceShare"] = payload["charts"].pop("source_share")
        payload["charts"]["statusBreakdown"] = payload["charts"].pop("status_breakdown")
        payload["sections"]["topTrends"] = payload["sections"].pop("top_trends")
        payload["sections"]["breakoutTrends"] = payload["sections"].pop("breakout_trends")
        payload["sections"]["risingTrends"] = payload["sections"].pop("rising_trends")
        payload["sections"]["experimentalTrends"] = payload["sections"].pop("experimental_trends")
        payload["sections"]["metaTrends"] = payload["sections"].pop("meta_trends")
        for section_name in ("topTrends", "breakoutTrends", "risingTrends", "experimentalTrends"):
            for trend in payload["sections"][section_name]:
                trend["scoreTotal"] = trend.pop("score_total")
        for trend in payload["sections"]["metaTrends"]:
            trend["trendCount"] = trend.pop("trend_count")
            trend["averageScore"] = trend.pop("average_score")
            trend["topTrendId"] = trend.pop("top_trend_id")
            trend["topTrendName"] = trend.pop("top_trend_name")
        payload["operations"]["lastRunAt"] = payload["operations"].pop("last_run_at")
        payload["operations"]["successRate"] = payload["operations"].pop("success_rate")
        payload["operations"]["averageDurationMs"] = payload["operations"].pop("average_duration_ms")
        payload["operations"]["recentRuns"] = payload["operations"].pop("recent_runs")
        for run in payload["operations"]["recentRuns"]:
            run["capturedAt"] = run.pop("captured_at")
            run["durationMs"] = run.pop("duration_ms")
            run["sourceCount"] = run.pop("source_count")
            run["successfulSourceCount"] = run.pop("successful_source_count")
            run["failedSourceCount"] = run.pop("failed_source_count")
            run["signalCount"] = run.pop("signal_count")
            run["rankedTrendCount"] = run.pop("ranked_trend_count")
            run["topTrendId"] = run.pop("top_trend_id")
            run["topTrendName"] = run.pop("top_trend_name")
            run["topScore"] = run.pop("top_score")
            run["rawTopicCount"] = run.pop("raw_topic_count")
            run["mergedTopicCount"] = run.pop("merged_topic_count")
            run["duplicateTopicCount"] = run.pop("duplicate_topic_count")
            run["duplicateTopicRate"] = run.pop("duplicate_topic_rate")
            run["multiSourceTrendCount"] = run.pop("multi_source_trend_count")
            run["lowEvidenceTrendCount"] = run.pop("low_evidence_trend_count")
        for source in payload["sources"]:
            source["signalCount"] = source.pop("signal_count")
            source["trendCount"] = source.pop("trend_count")
            source["latestFetchAt"] = source.pop("latest_fetch_at")
            source["latestSuccessAt"] = source.pop("latest_success_at")
            source["rawItemCount"] = source.pop("raw_item_count")
            source["latestItemCount"] = source.pop("latest_item_count")
            source["keptItemCount"] = source.pop("kept_item_count")
            source["yieldRatePercent"] = source.pop("yield_rate_percent")
            source["signalYieldRatio"] = source.pop("signal_yield_ratio")
            source["durationMs"] = source.pop("duration_ms")
            source["rawTopicCount"] = source.pop("raw_topic_count")
            source["mergedTopicCount"] = source.pop("merged_topic_count")
            source["duplicateTopicCount"] = source.pop("duplicate_topic_count")
            source["duplicateTopicRate"] = source.pop("duplicate_topic_rate")
            source["usedFallback"] = source.pop("used_fallback")
            source["errorMessage"] = source.pop("error_message")
        payload["sourceWatch"] = payload.pop("source_watch")
        return payload


@dataclass(frozen=True)
class SourceRunPayload:
    """Source ingestion run history item."""

    fetched_at: str
    success: bool
    raw_item_count: int
    item_count: int
    kept_item_count: int
    yield_rate_percent: float
    duration_ms: int
    raw_topic_count: int
    merged_topic_count: int
    duplicate_topic_count: int
    duplicate_topic_rate: float
    used_fallback: bool
    error_message: str | None


@dataclass(frozen=True)
class SourceSummaryTrendPayload:
    """Trend summary nested under a source summary."""

    id: str
    name: str
    rank: int
    score_total: float


@dataclass(frozen=True)
class SourceFamilySnapshotPayload:
    """Historical rollup for one source family."""

    family: str
    label: str
    captured_at: str
    source_count: int
    healthy_source_count: int
    signal_count: int
    trend_count: int
    corroborated_trend_count: int
    top_ranked_trend_count: int
    average_score: float
    average_yield_rate_percent: float
    success_rate_percent: float


@dataclass(frozen=True)
class SourceSummaryRecordPayload:
    """Detailed source summary for source health pages."""

    source: str
    family: str
    status: str
    latest_fetch_at: str | None
    latest_success_at: str | None
    raw_item_count: int
    latest_item_count: int
    kept_item_count: int
    yield_rate_percent: float
    signal_yield_ratio: float
    duration_ms: int
    raw_topic_count: int
    merged_topic_count: int
    duplicate_topic_count: int
    duplicate_topic_rate: float
    used_fallback: bool
    error_message: str | None
    signal_count: int
    trend_count: int
    run_history: list[SourceRunPayload]
    top_trends: list[SourceSummaryTrendPayload]


@dataclass(frozen=True)
class SourceSummaryPayload:
    """Source summary response for Dashboard V2."""

    generated_at: str
    sources: list[SourceSummaryRecordPayload]
    family_history: list[SourceFamilySnapshotPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        payload = asdict(self)
        payload["generatedAt"] = payload.pop("generated_at")
        payload["familyHistory"] = payload.pop("family_history")
        for source in payload["sources"]:
            source["latestFetchAt"] = source.pop("latest_fetch_at")
            source["latestSuccessAt"] = source.pop("latest_success_at")
            source["rawItemCount"] = source.pop("raw_item_count")
            source["latestItemCount"] = source.pop("latest_item_count")
            source["keptItemCount"] = source.pop("kept_item_count")
            source["yieldRatePercent"] = source.pop("yield_rate_percent")
            source["signalYieldRatio"] = source.pop("signal_yield_ratio")
            source["durationMs"] = source.pop("duration_ms")
            source["rawTopicCount"] = source.pop("raw_topic_count")
            source["mergedTopicCount"] = source.pop("merged_topic_count")
            source["duplicateTopicCount"] = source.pop("duplicate_topic_count")
            source["duplicateTopicRate"] = source.pop("duplicate_topic_rate")
            source["usedFallback"] = source.pop("used_fallback")
            source["errorMessage"] = source.pop("error_message")
            source["signalCount"] = source.pop("signal_count")
            source["trendCount"] = source.pop("trend_count")
            source["runHistory"] = source.pop("run_history")
            source["topTrends"] = source.pop("top_trends")
            for run in source["runHistory"]:
                run["fetchedAt"] = run.pop("fetched_at")
                run["rawItemCount"] = run.pop("raw_item_count")
                run["itemCount"] = run.pop("item_count")
                run["keptItemCount"] = run.pop("kept_item_count")
                run["yieldRatePercent"] = run.pop("yield_rate_percent")
                run["durationMs"] = run.pop("duration_ms")
                run["rawTopicCount"] = run.pop("raw_topic_count")
                run["mergedTopicCount"] = run.pop("merged_topic_count")
                run["duplicateTopicCount"] = run.pop("duplicate_topic_count")
                run["duplicateTopicRate"] = run.pop("duplicate_topic_rate")
                run["usedFallback"] = run.pop("used_fallback")
                run["errorMessage"] = run.pop("error_message")
            for trend in source["topTrends"]:
                trend["scoreTotal"] = trend.pop("score_total")
        for family in payload["familyHistory"]:
            family["capturedAt"] = family.pop("captured_at")
            family["sourceCount"] = family.pop("source_count")
            family["healthySourceCount"] = family.pop("healthy_source_count")
            family["signalCount"] = family.pop("signal_count")
            family["trendCount"] = family.pop("trend_count")
            family["corroboratedTrendCount"] = family.pop("corroborated_trend_count")
            family["topRankedTrendCount"] = family.pop("top_ranked_trend_count")
            family["averageScore"] = family.pop("average_score")
            family["averageYieldRatePercent"] = family.pop("average_yield_rate_percent")
            family["successRatePercent"] = family.pop("success_rate_percent")
        return payload


@dataclass(frozen=True)
class AdIntelligenceKeywordPayload:
    """Keyword-level advertising intelligence."""

    keyword: str
    cpc: float
    search_volume: int
    competition_level: str
    ad_density: float
    platforms: list[str]
    top_advertisers: list[str]
    trend_id: str | None


@dataclass(frozen=True)
class AdIntelligenceAdvertiserPayload:
    """Advertiser-level advertising intelligence."""

    name: str
    platform: str
    ad_count: int
    ad_formats: list[str]
    regions: list[str]


@dataclass(frozen=True)
class AdIntelligencePlatformSummaryPayload:
    """Platform-level advertising summary."""

    platform: str
    ad_count: int
    keyword_count: int
    advertiser_count: int


@dataclass(frozen=True)
class AdIntelligencePayload:
    """Full ad intelligence response payload."""

    generated_at: str
    top_keywords: list[AdIntelligenceKeywordPayload]
    top_advertisers: list[AdIntelligenceAdvertiserPayload]
    platform_summary: list[AdIntelligencePlatformSummaryPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with camelCase keys."""

        return {
            "generatedAt": self.generated_at,
            "topKeywords": [
                {
                    "keyword": kw.keyword,
                    "cpc": kw.cpc,
                    "searchVolume": kw.search_volume,
                    "competitionLevel": kw.competition_level,
                    "adDensity": kw.ad_density,
                    "platforms": kw.platforms,
                    "topAdvertisers": kw.top_advertisers,
                    "trendId": kw.trend_id,
                }
                for kw in self.top_keywords
            ],
            "topAdvertisers": [
                {
                    "name": adv.name,
                    "platform": adv.platform,
                    "adCount": adv.ad_count,
                    "adFormats": adv.ad_formats,
                    "regions": adv.regions,
                }
                for adv in self.top_advertisers
            ],
            "platformSummary": [
                {
                    "platform": ps.platform,
                    "adCount": ps.ad_count,
                    "keywordCount": ps.keyword_count,
                    "advertiserCount": ps.advertiser_count,
                }
                for ps in self.platform_summary
            ],
        }


def trend_to_dict(trend: TrendRecord) -> dict[str, object]:
    """Serialize a trend record using API-style keys."""

    payload = asdict(trend)
    payload["latestSignalAt"] = payload.pop("latest_signal_at")
    return payload


def trend_explorer_record_to_dict(trend: TrendExplorerRecordPayload) -> dict[str, object]:
    """Serialize an explorer record using API-style keys."""

    payload = asdict(trend)
    payload["metaTrend"] = payload.pop("meta_trend")
    payload["previousRank"] = payload.pop("previous_rank")
    payload["rankChange"] = payload.pop("rank_change")
    payload["firstSeenAt"] = payload.pop("first_seen_at")
    payload["latestSignalAt"] = payload.pop("latest_signal_at")
    payload["momentum"]["previousRank"] = payload["momentum"].pop("previous_rank")
    payload["momentum"]["rankChange"] = payload["momentum"].pop("rank_change")
    payload["momentum"]["absoluteDelta"] = payload["momentum"].pop("absolute_delta")
    payload["momentum"]["percentDelta"] = payload["momentum"].pop("percent_delta")
    payload["coverage"]["sourceCount"] = payload["coverage"].pop("source_count")
    payload["coverage"]["signalCount"] = payload["coverage"].pop("signal_count")
    payload["evidencePreview"] = payload.pop("evidence_preview")
    payload["audienceSummary"] = payload.pop("audience_summary")
    payload["primaryEvidence"] = payload.pop("primary_evidence")
    payload["recentHistory"] = payload.pop("recent_history")
    if payload["primaryEvidence"] is not None:
        payload["primaryEvidence"]["signalType"] = payload["primaryEvidence"].pop("signal_type")
        payload["primaryEvidence"]["evidenceUrl"] = payload["primaryEvidence"].pop("evidence_url")
    if payload["seasonality"] is not None:
        payload["seasonality"]["recurrenceCount"] = payload["seasonality"].pop("recurrence_count")
        payload["seasonality"]["avgGapRuns"] = payload["seasonality"].pop("avg_gap_runs")
    payload["forecastDirection"] = payload.pop("forecast_direction")
    for item in payload["audienceSummary"]:
        item["segmentType"] = item.pop("segment_type")
        item["signalCount"] = item.pop("signal_count")
    for point in payload["recentHistory"]:
        point["capturedAt"] = point.pop("captured_at")
        point["scoreTotal"] = point.pop("score_total")
    return payload


def trend_detail_record_to_dict(trend: TrendDetailRecordPayload) -> dict[str, object]:
    """Serialize a trend detail record using API-style keys."""

    payload = asdict(trend)
    payload["metaTrend"] = payload.pop("meta_trend")
    payload["previousRank"] = payload.pop("previous_rank")
    payload["rankChange"] = payload.pop("rank_change")
    payload["firstSeenAt"] = payload.pop("first_seen_at")
    payload["latestSignalAt"] = payload.pop("latest_signal_at")
    payload["momentum"]["previousRank"] = payload["momentum"].pop("previous_rank")
    payload["momentum"]["rankChange"] = payload["momentum"].pop("rank_change")
    payload["momentum"]["absoluteDelta"] = payload["momentum"].pop("absolute_delta")
    payload["momentum"]["percentDelta"] = payload["momentum"].pop("percent_delta")
    payload["breakoutPrediction"] = payload.pop("breakout_prediction")
    payload["breakoutPrediction"]["predictedDirection"] = payload["breakoutPrediction"].pop("predicted_direction")
    if payload["forecast"] is not None:
        payload["forecast"]["predictedScores"] = payload["forecast"].pop("predicted_scores")
    if payload["seasonality"] is not None:
        payload["seasonality"]["recurrenceCount"] = payload["seasonality"].pop("recurrence_count")
        payload["seasonality"]["avgGapRuns"] = payload["seasonality"].pop("avg_gap_runs")
    payload["coverage"]["sourceCount"] = payload["coverage"].pop("source_count")
    payload["coverage"]["signalCount"] = payload["coverage"].pop("signal_count")
    payload["sourceBreakdown"] = payload.pop("source_breakdown")
    payload["sourceContributions"] = payload.pop("source_contributions")
    payload["marketFootprint"] = payload.pop("market_footprint")
    payload["geoSummary"] = payload.pop("geo_summary")
    payload["audienceSummary"] = payload.pop("audience_summary")
    payload["evidenceItems"] = payload.pop("evidence_items")
    payload["primaryEvidence"] = payload.pop("primary_evidence")
    payload["duplicateCandidates"] = payload.pop("duplicate_candidates")
    payload["relatedTrends"] = payload.pop("related_trends")
    payload["whyNow"] = payload.pop("why_now")
    for point in payload["history"]:
        point["capturedAt"] = point.pop("captured_at")
        point["scoreTotal"] = point.pop("score_total")
    for source in payload["sourceBreakdown"]:
        source["signalCount"] = source.pop("signal_count")
        source["latestSignalAt"] = source.pop("latest_signal_at")
    for source in payload["sourceContributions"]:
        source["signalCount"] = source.pop("signal_count")
        source["latestSignalAt"] = source.pop("latest_signal_at")
        source["estimatedScore"] = source.pop("estimated_score")
        source["scoreSharePercent"] = source.pop("score_share_percent")
    for metric in payload["marketFootprint"]:
        metric["metricKey"] = metric.pop("metric_key")
        metric["valueNumeric"] = metric.pop("value_numeric")
        metric["valueDisplay"] = metric.pop("value_display")
        metric["capturedAt"] = metric.pop("captured_at")
        metric["provenanceUrl"] = metric.pop("provenance_url")
        metric["isEstimated"] = metric.pop("is_estimated")
    for geo in payload["geoSummary"]:
        geo["countryCode"] = geo.pop("country_code")
        geo["signalCount"] = geo.pop("signal_count")
        geo["explicitCount"] = geo.pop("explicit_count")
        geo["inferredCount"] = geo.pop("inferred_count")
        geo["averageConfidence"] = geo.pop("average_confidence")
    for item in payload["evidenceItems"]:
        item["signalType"] = item.pop("signal_type")
        item["evidenceUrl"] = item.pop("evidence_url")
        item["languageCode"] = item.pop("language_code")
        item["audienceFlags"] = item.pop("audience_flags")
        item["marketFlags"] = item.pop("market_flags")
        item["geoFlags"] = item.pop("geo_flags")
        item["geoCountryCode"] = item.pop("geo_country_code")
        item["geoRegion"] = item.pop("geo_region")
        item["geoDetectionMode"] = item.pop("geo_detection_mode")
        item["geoConfidence"] = item.pop("geo_confidence")
    for item in payload["audienceSummary"]:
        item["segmentType"] = item.pop("segment_type")
        item["signalCount"] = item.pop("signal_count")
    if payload["primaryEvidence"] is not None:
        payload["primaryEvidence"]["signalType"] = payload["primaryEvidence"].pop("signal_type")
        payload["primaryEvidence"]["evidenceUrl"] = payload["primaryEvidence"].pop("evidence_url")
    for item in payload["relatedTrends"]:
        item["scoreTotal"] = item.pop("score_total")
        item["relationshipStrength"] = item.pop("relationship_strength")
    payload["wikipediaExtract"] = payload.pop("wikipedia_extract")
    payload["wikipediaDescription"] = payload.pop("wikipedia_description")
    payload["wikipediaThumbnailUrl"] = payload.pop("wikipedia_thumbnail_url")
    payload["wikipediaPageUrl"] = payload.pop("wikipedia_page_url")
    return payload


@dataclass(frozen=True)
class BreakingTweetPayload:
    """Single tweet in the breaking feed."""

    account: str
    text: str
    tweet_id: str
    timestamp: str
    engagement: float


@dataclass(frozen=True)
class BreakingItemPayload:
    """Grouped breaking topic with source tweets."""

    topic: str
    breaking_score: float
    corroborated: bool
    account_count: int
    tweets: list[BreakingTweetPayload]


@dataclass(frozen=True)
class BreakingFeedPayload:
    """Breaking news feed payload."""

    updated_at: str
    items: list[BreakingItemPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""
        return {
            "updatedAt": self.updated_at,
            "items": [
                {
                    "topic": item.topic,
                    "breakingScore": item.breaking_score,
                    "corroborated": item.corroborated,
                    "accountCount": item.account_count,
                    "tweets": [
                        {
                            "account": tweet.account,
                            "text": tweet.text,
                            "tweetId": tweet.tweet_id,
                            "timestamp": tweet.timestamp,
                            "engagement": tweet.engagement,
                        }
                        for tweet in item.tweets
                    ],
                }
                for item in self.items
            ],
        }
