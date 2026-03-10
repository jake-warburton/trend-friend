"""Serialize stored trends into frontend-facing payloads."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from app.exports.contracts import (
    BreakoutPredictionPayload,
    DashboardOverviewChartDatumPayload,
    DashboardOverviewChartsPayload,
    DashboardOverviewHighlightsPayload,
    DashboardOverviewOperationsPayload,
    DashboardOverviewPayload,
    DashboardOverviewRunPayload,
    DashboardOverviewSectionsPayload,
    DashboardOverviewMetaTrendPayload,
    DashboardOverviewSourcePayload,
    DashboardOverviewSummaryPayload,
    DashboardOverviewTrendItemPayload,
    LatestTrendsPayload,
    SourceRunPayload,
    SourceSummaryPayload,
    SourceSummaryRecordPayload,
    SourceSummaryTrendPayload,
    OpportunityPayload,
    RelatedTrendPayload,
    TrendCoveragePayload,
    TrendDetailIndexPayload,
    TrendDetailRecordPayload,
    TrendEvidenceItemPayload,
    TrendForecastPayload,
    TrendGeoSummaryPayload,
    TrendExplorerPayload,
    TrendExplorerRecordPayload,
    TrendHistoryPointPayload,
    TrendHistoryPayload,
    TrendMomentumPayload,
    TrendRecord,
    TrendScoreComponents,
    TrendSourceContributionPayload,
    TrendSourceBreakdownPayload,
    TrendSnapshotPayload,
)
from app.models import (
    NormalizedSignal,
    PipelineRun,
    RelatedTrend,
    SourceIngestionRun,
    SourceSummaryRecord,
    SourceSummaryTrend,
    TrendDetailRecord,
    TrendExplorerRecord,
    TrendScoreResult,
)


def build_latest_trends_payload(
    generated_at: datetime,
    scores: list[TrendScoreResult],
) -> LatestTrendsPayload:
    """Create the latest trends payload."""

    return LatestTrendsPayload(
        generated_at=to_timestamp(generated_at),
        trends=[serialize_trend(score, rank) for rank, score in enumerate(scores, start=1)],
    )


def build_trend_history_payload(
    generated_at: datetime,
    snapshots: list[tuple[datetime, list[TrendScoreResult]]],
) -> TrendHistoryPayload:
    """Create the trend history payload."""

    return TrendHistoryPayload(
        generated_at=to_timestamp(generated_at),
        snapshots=[
            TrendSnapshotPayload(
                captured_at=to_timestamp(captured_at),
                trends=[serialize_trend(score, rank) for rank, score in enumerate(scores, start=1)],
            )
            for captured_at, scores in snapshots
        ],
    )


def build_trend_explorer_payload(
    generated_at: datetime,
    trends: list[TrendExplorerRecord],
) -> TrendExplorerPayload:
    """Create the explorer payload for Dashboard V2."""

    return TrendExplorerPayload(
        generated_at=to_timestamp(generated_at),
        trends=[serialize_explorer_trend(trend) for trend in trends],
    )


def build_trend_detail_index_payload(
    generated_at: datetime,
    trends: list[TrendDetailRecord],
) -> TrendDetailIndexPayload:
    """Create the detail index payload for Dashboard V2."""

    return TrendDetailIndexPayload(
        generated_at=to_timestamp(generated_at),
        trends=[serialize_detail_trend(trend) for trend in trends],
    )


def build_dashboard_overview_payload(
    generated_at: datetime,
    trends: list[TrendDetailRecord],
    signals: list[NormalizedSignal],
    source_runs: list[SourceIngestionRun],
    pipeline_runs: list[PipelineRun],
) -> DashboardOverviewPayload:
    """Create the overview payload for the dashboard landing page."""

    ordered_trends = sorted(trends, key=lambda trend: trend.rank)
    source_summaries = build_source_summaries(signals, source_runs)
    biggest_mover = max(
        ordered_trends,
        key=lambda trend: trend.rank_change if trend.rank_change is not None else float("-inf"),
        default=None,
    )
    newest_trend = max(
        ordered_trends,
        key=lambda trend: trend.first_seen_at or generated_at,
        default=None,
    )
    average_score = round(
        sum(trend.score.total_score for trend in ordered_trends) / len(ordered_trends),
        1,
    ) if ordered_trends else 0.0

    return DashboardOverviewPayload(
        generated_at=to_timestamp(generated_at),
        summary=DashboardOverviewSummaryPayload(
            tracked_trends=len(ordered_trends),
            total_signals=len(signals),
            source_count=len(source_summaries),
            average_score=average_score,
        ),
        highlights=DashboardOverviewHighlightsPayload(
            top_trend_id=ordered_trends[0].id if ordered_trends else None,
            top_trend_name=ordered_trends[0].name if ordered_trends else None,
            biggest_mover_id=biggest_mover.id if biggest_mover is not None else None,
            biggest_mover_name=biggest_mover.name if biggest_mover is not None else None,
            newest_trend_id=newest_trend.id if newest_trend is not None else None,
            newest_trend_name=newest_trend.name if newest_trend is not None else None,
        ),
        charts=build_dashboard_charts_payload(ordered_trends, source_summaries),
        sections=build_dashboard_sections_payload(ordered_trends),
        operations=build_dashboard_operations_payload(pipeline_runs),
        sources=source_summaries,
    )


def build_source_summary_payload(
    generated_at: datetime,
    sources: list[SourceSummaryRecord],
) -> SourceSummaryPayload:
    """Create the source summary payload for Dashboard V2."""

    return SourceSummaryPayload(
        generated_at=to_timestamp(generated_at),
        sources=[
            SourceSummaryRecordPayload(
                source=source.source,
                status=source.status,
                latest_fetch_at=to_optional_timestamp(source.latest_fetch_at),
                latest_success_at=to_optional_timestamp(source.latest_success_at),
                latest_item_count=source.latest_item_count,
                duration_ms=source.duration_ms,
                used_fallback=source.used_fallback,
                error_message=source.error_message,
                signal_count=source.signal_count,
                trend_count=source.trend_count,
                run_history=[
                    SourceRunPayload(
                        fetched_at=to_timestamp(run.fetched_at),
                        success=run.success,
                        item_count=run.item_count,
                        duration_ms=run.duration_ms,
                        used_fallback=run.used_fallback,
                        error_message=run.error_message,
                    )
                    for run in source.run_history
                ],
                top_trends=[
                    SourceSummaryTrendPayload(
                        id=trend.id,
                        name=trend.name,
                        rank=trend.rank,
                        score_total=trend.score_total,
                    )
                    for trend in source.top_trends
                ],
            )
            for source in sources
        ],
    )


def serialize_trend(score: TrendScoreResult, rank: int) -> TrendRecord:
    """Convert an internal trend score into the public contract."""

    return TrendRecord(
        id=slugify(score.topic),
        name=format_trend_name(score.topic),
        rank=rank,
        score=TrendScoreComponents(
            total=round(score.total_score, 1),
            social=round(score.social_score, 1),
            developer=round(score.developer_score, 1),
            knowledge=round(score.knowledge_score, 1),
            search=round(score.search_score, 1),
            diversity=round(score.diversity_score, 1),
        ),
        sources=sorted(score.source_counts),
        evidence=score.evidence,
        latest_signal_at=to_timestamp(score.latest_timestamp),
    )


def serialize_explorer_trend(trend: TrendExplorerRecord) -> TrendExplorerRecordPayload:
    """Convert an internal explorer record into the public V2 contract."""

    return TrendExplorerRecordPayload(
        id=trend.id,
        name=trend.name,
        category=trend.category,
        status=trend.status,
        volatility=trend.volatility,
        rank=trend.rank,
        previous_rank=trend.previous_rank,
        rank_change=trend.rank_change,
        first_seen_at=to_optional_timestamp(trend.first_seen_at),
        latest_signal_at=to_timestamp(trend.latest_signal_at),
        score=TrendScoreComponents(
            total=round(trend.score.total_score, 1),
            social=round(trend.score.social_score, 1),
            developer=round(trend.score.developer_score, 1),
            knowledge=round(trend.score.knowledge_score, 1),
            search=round(trend.score.search_score, 1),
            diversity=round(trend.score.diversity_score, 1),
        ),
        momentum=TrendMomentumPayload(
            previous_rank=trend.momentum.previous_rank,
            rank_change=trend.momentum.rank_change,
            absolute_delta=trend.momentum.absolute_delta,
            percent_delta=trend.momentum.percent_delta,
        ),
        coverage=TrendCoveragePayload(
            source_count=trend.source_count,
            signal_count=trend.signal_count,
        ),
        sources=sorted(trend.score.source_counts),
        evidence_preview=trend.score.evidence[:2],
        recent_history=[
            TrendHistoryPointPayload(
                captured_at=to_timestamp(point.captured_at),
                rank=point.rank,
                score_total=round(point.score_total, 1),
            )
            for point in trend.recent_history
        ],
        forecast_direction=trend.forecast_direction,
    )


def serialize_detail_trend(trend: TrendDetailRecord) -> TrendDetailRecordPayload:
    """Convert an internal detail record into the public V2 contract."""

    return TrendDetailRecordPayload(
        id=trend.id,
        name=trend.name,
        category=trend.category,
        status=trend.status,
        volatility=trend.volatility,
        rank=trend.rank,
        previous_rank=trend.previous_rank,
        rank_change=trend.rank_change,
        first_seen_at=to_optional_timestamp(trend.first_seen_at),
        latest_signal_at=to_timestamp(trend.latest_signal_at),
        score=TrendScoreComponents(
            total=round(trend.score.total_score, 1),
            social=round(trend.score.social_score, 1),
            developer=round(trend.score.developer_score, 1),
            knowledge=round(trend.score.knowledge_score, 1),
            search=round(trend.score.search_score, 1),
            diversity=round(trend.score.diversity_score, 1),
        ),
        momentum=TrendMomentumPayload(
            previous_rank=trend.momentum.previous_rank,
            rank_change=trend.momentum.rank_change,
            absolute_delta=trend.momentum.absolute_delta,
            percent_delta=trend.momentum.percent_delta,
        ),
        breakout_prediction=BreakoutPredictionPayload(
            confidence=trend.breakout_prediction.confidence,
            predicted_direction=trend.breakout_prediction.predicted_direction,
            signals=trend.breakout_prediction.signals,
        ),
        forecast=(
            TrendForecastPayload(
                predicted_scores=[round(score, 2) for score in trend.forecast.predicted_scores],
                confidence=trend.forecast.confidence,
                mape=trend.forecast.mape,
                method=trend.forecast.method,
            )
            if trend.forecast is not None
            else None
        ),
        opportunity=OpportunityPayload(
            composite=trend.opportunity.composite,
            content=trend.opportunity.content,
            product=trend.opportunity.product,
            investment=trend.opportunity.investment,
            reasoning=trend.opportunity.reasoning,
        ),
        coverage=TrendCoveragePayload(
            source_count=trend.source_count,
            signal_count=trend.signal_count,
        ),
        sources=trend.sources,
        history=[
            TrendHistoryPointPayload(
                captured_at=to_timestamp(point.captured_at),
                rank=point.rank,
                score_total=round(point.score_total, 1),
            )
            for point in trend.history
        ],
        source_breakdown=[
            TrendSourceBreakdownPayload(
                source=item.source,
                signal_count=item.signal_count,
                latest_signal_at=to_timestamp(item.latest_signal_at),
            )
            for item in trend.source_breakdown
        ],
        source_contributions=[
            TrendSourceContributionPayload(
                source=item.source,
                signal_count=item.signal_count,
                latest_signal_at=to_timestamp(item.latest_signal_at),
                estimated_score=round(item.estimated_score, 1),
                score_share_percent=item.score_share_percent,
                score=TrendScoreComponents(
                    total=round(item.estimated_score, 1),
                    social=round(item.social_score, 1),
                    developer=round(item.developer_score, 1),
                    knowledge=round(item.knowledge_score, 1),
                    search=round(item.search_score, 1),
                    diversity=round(item.diversity_score, 1),
                ),
            )
            for item in trend.source_contributions
        ],
        geo_summary=[
            TrendGeoSummaryPayload(
                label=item.label,
                country_code=item.country_code,
                region=item.region,
                signal_count=item.signal_count,
                explicit_count=item.explicit_count,
                inferred_count=item.inferred_count,
                average_confidence=item.average_confidence,
            )
            for item in trend.geo_summary
        ],
        evidence_items=[
            TrendEvidenceItemPayload(
                source=item.source,
                signal_type=item.signal_type,
                timestamp=to_timestamp(item.timestamp),
                value=round(item.value, 1),
                evidence=item.evidence,
                geo_flags=list(item.geo_flags),
                geo_country_code=item.geo_country_code,
                geo_region=item.geo_region,
                geo_detection_mode=item.geo_detection_mode,
                geo_confidence=round(item.geo_confidence, 2),
            )
            for item in trend.evidence_items
        ],
        related_trends=[
            serialize_related_trend(item)
            for item in trend.related_trends
        ],
    )


def serialize_related_trend(trend: RelatedTrend) -> RelatedTrendPayload:
    """Convert a related-trend recommendation into the public contract."""

    return RelatedTrendPayload(
        id=trend.id,
        name=trend.name,
        status=trend.status,
        rank=trend.rank,
        score_total=round(trend.score_total, 1),
    )


def to_timestamp(value: datetime) -> str:
    """Return a UTC ISO-8601 timestamp."""

    utc_value = value.astimezone(timezone.utc)
    return utc_value.isoformat().replace("+00:00", "Z")


def to_optional_timestamp(value: datetime | None) -> str | None:
    """Return a UTC timestamp or None."""

    if value is None:
        return None
    return to_timestamp(value)


def slugify(topic: str) -> str:
    """Convert a topic to a stable slug identifier."""

    normalized = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")
    return normalized or "trend"


def format_trend_name(topic: str) -> str:
    """Return a display-friendly topic name."""

    return " ".join(part.upper() if len(part) <= 3 else part.capitalize() for part in topic.split())


def build_source_summaries(
    signals: list[NormalizedSignal],
    source_runs: list[SourceIngestionRun],
) -> list[DashboardOverviewSourcePayload]:
    """Aggregate signal and topic counts by source."""

    source_map: dict[str, set[str]] = {}
    signal_counts: dict[str, int] = {}
    for signal in signals:
        signal_counts[signal.source] = signal_counts.get(signal.source, 0) + 1
        source_map.setdefault(signal.source, set()).add(signal.topic)

    latest_success_by_source: dict[str, SourceIngestionRun] = {}
    latest_by_source: dict[str, SourceIngestionRun] = {}
    for run in source_runs:
        latest_by_source[run.source] = run
        if run.success:
            latest_success_by_source[run.source] = run

    known_sources = set(signal_counts) | set(latest_by_source)

    return [
        DashboardOverviewSourcePayload(
            source=source,
            signal_count=signal_counts.get(source, 0),
            trend_count=len(source_map.get(source, set())),
            status=build_source_status(latest_by_source.get(source)),
            latest_fetch_at=(
                to_timestamp(latest_by_source[source].fetched_at)
                if source in latest_by_source
                else None
            ),
            latest_success_at=(
                to_timestamp(latest_success_by_source[source].fetched_at)
                if source in latest_success_by_source
                else None
            ),
            latest_item_count=latest_by_source[source].item_count if source in latest_by_source else 0,
            duration_ms=latest_by_source[source].duration_ms if source in latest_by_source else 0,
            used_fallback=latest_by_source[source].used_fallback if source in latest_by_source else False,
            error_message=latest_by_source[source].error_message if source in latest_by_source else None,
        )
        for source in sorted(known_sources, key=lambda item: (-signal_counts.get(item, 0), item))
    ]


def build_source_status(run: SourceIngestionRun | None) -> str:
    """Return the dashboard health label for a source."""

    if run is None or not run.success:
        return "stale"
    if run.used_fallback:
        return "degraded"
    return "healthy"


def build_dashboard_charts_payload(
    trends: list[TrendDetailRecord],
    source_summaries: list[DashboardOverviewSourcePayload],
) -> DashboardOverviewChartsPayload:
    """Return compact chart datasets for the homepage."""

    status_counts: dict[str, int] = {}
    for trend in trends:
        status_counts[trend.status] = status_counts.get(trend.status, 0) + 1

    return DashboardOverviewChartsPayload(
        top_trend_scores=[
            DashboardOverviewChartDatumPayload(
                label=trend.name,
                value=round(trend.score.total_score, 1),
            )
            for trend in trends[:8]
        ],
        source_share=[
            DashboardOverviewChartDatumPayload(
                label=source.source.replace("_", " ").title(),
                value=float(source.signal_count),
            )
            for source in source_summaries[:6]
            if source.signal_count > 0
        ],
        status_breakdown=[
            DashboardOverviewChartDatumPayload(
                label=format_trend_name(status),
                value=float(count),
            )
            for status, count in sorted(status_counts.items(), key=lambda item: (-item[1], item[0]))
        ],
    )


def build_dashboard_sections_payload(
    trends: list[TrendDetailRecord],
) -> DashboardOverviewSectionsPayload:
    """Return curated overview sections similar to dedicated trend products."""

    return DashboardOverviewSectionsPayload(
        top_trends=[serialize_overview_trend_item(trend) for trend in trends[:5]],
        breakout_trends=[
            serialize_overview_trend_item(trend)
            for trend in trends
            if trend.status == "breakout"
        ][:5],
        rising_trends=[
            serialize_overview_trend_item(trend)
            for trend in trends
            if trend.status == "rising"
        ][:5],
        meta_trends=build_meta_trend_payloads(trends),
    )


def serialize_overview_trend_item(trend: TrendDetailRecord) -> DashboardOverviewTrendItemPayload:
    """Convert a detail record into a compact overview trend item."""

    return DashboardOverviewTrendItemPayload(
        id=trend.id,
        name=trend.name,
        category=trend.category,
        status=trend.status,
        rank=trend.rank,
        score_total=round(trend.score.total_score, 1),
    )


def build_meta_trend_payloads(trends: list[TrendDetailRecord]) -> list[DashboardOverviewMetaTrendPayload]:
    """Summarize the current ranked set into category-level meta trends."""

    grouped: dict[str, list[TrendDetailRecord]] = {}
    for trend in trends:
        grouped.setdefault(trend.category, []).append(trend)

    payloads = [
        # Top-ranked trend acts as the anchor label for each meta trend bucket.
        DashboardOverviewMetaTrendPayload(
            category=category,
            trend_count=len(items),
            average_score=round(sum(item.score.total_score for item in items) / len(items), 1),
            top_trend_id=sorted(items, key=lambda item: item.rank)[0].id,
            top_trend_name=sorted(items, key=lambda item: item.rank)[0].name,
        )
        for category, items in grouped.items()
    ]
    payloads.sort(key=lambda item: (-item.average_score, -item.trend_count, item.category))
    return payloads[:6]


def build_dashboard_operations_payload(
    pipeline_runs: list[PipelineRun],
) -> DashboardOverviewOperationsPayload:
    """Return recent operational history for full pipeline runs."""

    if not pipeline_runs:
        return DashboardOverviewOperationsPayload(
            last_run_at=None,
            success_rate=0.0,
            average_duration_ms=0,
            recent_runs=[],
        )

    healthy_runs = sum(1 for run in pipeline_runs if run.failed_source_count == 0)
    average_duration_ms = round(
        sum(run.duration_ms for run in pipeline_runs) / len(pipeline_runs)
    )
    return DashboardOverviewOperationsPayload(
        last_run_at=to_timestamp(pipeline_runs[0].captured_at),
        success_rate=round((healthy_runs / len(pipeline_runs)) * 100, 1),
        average_duration_ms=average_duration_ms,
        recent_runs=[
            DashboardOverviewRunPayload(
                captured_at=to_timestamp(run.captured_at),
                duration_ms=run.duration_ms,
                source_count=run.source_count,
                successful_source_count=run.successful_source_count,
                failed_source_count=run.failed_source_count,
                signal_count=run.signal_count,
                ranked_trend_count=run.ranked_trend_count,
                status="healthy" if run.failed_source_count == 0 else "degraded",
                top_trend_id=slugify(run.top_topic) if run.top_topic else None,
                top_trend_name=format_trend_name(run.top_topic) if run.top_topic else None,
                top_score=round(run.top_score, 1) if run.top_score is not None else None,
            )
            for run in pipeline_runs
        ],
    )


def build_source_summary_records(
    trends: list[TrendDetailRecord],
    signals: list[NormalizedSignal],
    latest_source_runs: list[SourceIngestionRun],
    source_run_history: dict[str, list[SourceIngestionRun]],
) -> list[SourceSummaryRecord]:
    """Build detailed source summaries from trend and ingestion state."""

    signal_counts: dict[str, int] = {}
    trend_counts: dict[str, set[str]] = {}
    for signal in signals:
        signal_counts[signal.source] = signal_counts.get(signal.source, 0) + 1
        trend_counts.setdefault(signal.source, set()).add(signal.topic)

    trends_by_source: dict[str, list[SourceSummaryTrend]] = {}
    for trend in trends:
        for source in trend.sources:
            trends_by_source.setdefault(source, []).append(
                SourceSummaryTrend(
                    id=trend.id,
                    name=trend.name,
                    rank=trend.rank,
                    score_total=round(trend.score.total_score, 1),
                )
            )

    latest_run_map = {run.source: run for run in latest_source_runs}
    known_sources = set(signal_counts) | set(latest_run_map) | set(trends_by_source) | set(source_run_history)
    summaries: list[SourceSummaryRecord] = []
    for source in sorted(known_sources):
        latest_run = latest_run_map.get(source)
        successful_runs = [run for run in source_run_history.get(source, []) if run.success]
        summaries.append(
            SourceSummaryRecord(
                source=source,
                status=build_source_status(latest_run),
                latest_fetch_at=latest_run.fetched_at if latest_run is not None else None,
                latest_success_at=successful_runs[0].fetched_at if successful_runs else None,
                latest_item_count=latest_run.item_count if latest_run is not None else 0,
                duration_ms=latest_run.duration_ms if latest_run is not None else 0,
                used_fallback=latest_run.used_fallback if latest_run is not None else False,
                error_message=latest_run.error_message if latest_run is not None else None,
                signal_count=signal_counts.get(source, 0),
                trend_count=len(trend_counts.get(source, set())),
                run_history=source_run_history.get(source, []),
                top_trends=sorted(
                    trends_by_source.get(source, []),
                    key=lambda trend: (trend.rank, -trend.score_total, trend.name),
                )[:5],
            )
        )
    return summaries
