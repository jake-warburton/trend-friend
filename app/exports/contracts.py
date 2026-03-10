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
class TrendCoveragePayload:
    """Public coverage metrics for a trend."""

    source_count: int
    signal_count: int


@dataclass(frozen=True)
class TrendExplorerRecordPayload:
    """Public explorer record consumed by the dashboard V2."""

    id: str
    name: str
    status: str
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
class TrendEvidenceItemPayload:
    """Evidence item exposed on the trend detail page."""

    source: str
    signal_type: str
    timestamp: str
    value: float
    evidence: str


@dataclass(frozen=True)
class RelatedTrendPayload:
    """Compact related trend entry for detail pages."""

    id: str
    name: str
    status: str
    rank: int
    score_total: float


@dataclass(frozen=True)
class TrendDetailRecordPayload:
    """Detailed trend record consumed by trend detail pages."""

    id: str
    name: str
    status: str
    rank: int
    previous_rank: int | None
    rank_change: int | None
    first_seen_at: str | None
    latest_signal_at: str
    score: TrendScoreComponents
    momentum: TrendMomentumPayload
    coverage: TrendCoveragePayload
    sources: list[str]
    history: list[TrendHistoryPointPayload]
    source_breakdown: list[TrendSourceBreakdownPayload]
    evidence_items: list[TrendEvidenceItemPayload]
    related_trends: list[RelatedTrendPayload]


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
    status: str
    rank: int
    score_total: float


@dataclass(frozen=True)
class DashboardOverviewSectionsPayload:
    """Curated overview lists shown on the landing page."""

    top_trends: list[DashboardOverviewTrendItemPayload]
    breakout_trends: list[DashboardOverviewTrendItemPayload]
    rising_trends: list[DashboardOverviewTrendItemPayload]


@dataclass(frozen=True)
class DashboardOverviewSourcePayload:
    """Source-level aggregate for overview and source health summary."""

    source: str
    signal_count: int
    trend_count: int
    status: str
    latest_fetch_at: str | None
    latest_success_at: str | None
    latest_item_count: int
    duration_ms: int
    used_fallback: bool
    error_message: str | None


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
        for section_name in ("topTrends", "breakoutTrends", "risingTrends"):
            for trend in payload["sections"][section_name]:
                trend["scoreTotal"] = trend.pop("score_total")
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
        for source in payload["sources"]:
            source["signalCount"] = source.pop("signal_count")
            source["trendCount"] = source.pop("trend_count")
            source["latestFetchAt"] = source.pop("latest_fetch_at")
            source["latestSuccessAt"] = source.pop("latest_success_at")
            source["latestItemCount"] = source.pop("latest_item_count")
            source["durationMs"] = source.pop("duration_ms")
            source["usedFallback"] = source.pop("used_fallback")
            source["errorMessage"] = source.pop("error_message")
        return payload


@dataclass(frozen=True)
class SourceRunPayload:
    """Source ingestion run history item."""

    fetched_at: str
    success: bool
    item_count: int
    duration_ms: int
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
class SourceSummaryRecordPayload:
    """Detailed source summary for source health pages."""

    source: str
    status: str
    latest_fetch_at: str | None
    latest_success_at: str | None
    latest_item_count: int
    duration_ms: int
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

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        payload = asdict(self)
        payload["generatedAt"] = payload.pop("generated_at")
        for source in payload["sources"]:
            source["latestFetchAt"] = source.pop("latest_fetch_at")
            source["latestSuccessAt"] = source.pop("latest_success_at")
            source["latestItemCount"] = source.pop("latest_item_count")
            source["durationMs"] = source.pop("duration_ms")
            source["usedFallback"] = source.pop("used_fallback")
            source["errorMessage"] = source.pop("error_message")
            source["signalCount"] = source.pop("signal_count")
            source["trendCount"] = source.pop("trend_count")
            source["runHistory"] = source.pop("run_history")
            source["topTrends"] = source.pop("top_trends")
            for run in source["runHistory"]:
                run["fetchedAt"] = run.pop("fetched_at")
                run["itemCount"] = run.pop("item_count")
                run["durationMs"] = run.pop("duration_ms")
                run["usedFallback"] = run.pop("used_fallback")
                run["errorMessage"] = run.pop("error_message")
            for trend in source["topTrends"]:
                trend["scoreTotal"] = trend.pop("score_total")
        return payload


def trend_to_dict(trend: TrendRecord) -> dict[str, object]:
    """Serialize a trend record using API-style keys."""

    payload = asdict(trend)
    payload["latestSignalAt"] = payload.pop("latest_signal_at")
    return payload


def trend_explorer_record_to_dict(trend: TrendExplorerRecordPayload) -> dict[str, object]:
    """Serialize an explorer record using API-style keys."""

    payload = asdict(trend)
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
    return payload


def trend_detail_record_to_dict(trend: TrendDetailRecordPayload) -> dict[str, object]:
    """Serialize a trend detail record using API-style keys."""

    payload = asdict(trend)
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
    payload["sourceBreakdown"] = payload.pop("source_breakdown")
    payload["evidenceItems"] = payload.pop("evidence_items")
    payload["relatedTrends"] = payload.pop("related_trends")
    for point in payload["history"]:
        point["capturedAt"] = point.pop("captured_at")
        point["scoreTotal"] = point.pop("score_total")
    for source in payload["sourceBreakdown"]:
        source["signalCount"] = source.pop("signal_count")
        source["latestSignalAt"] = source.pop("latest_signal_at")
    for item in payload["evidenceItems"]:
        item["signalType"] = item.pop("signal_type")
    for item in payload["relatedTrends"]:
        item["scoreTotal"] = item.pop("score_total")
    return payload
