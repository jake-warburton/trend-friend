"""Serialize stored trends into frontend-facing payloads."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from app.exports.contracts import (
    DashboardOverviewHighlightsPayload,
    DashboardOverviewPayload,
    DashboardOverviewSourcePayload,
    DashboardOverviewSummaryPayload,
    LatestTrendsPayload,
    TrendCoveragePayload,
    TrendDetailIndexPayload,
    TrendDetailRecordPayload,
    TrendEvidenceItemPayload,
    TrendExplorerPayload,
    TrendExplorerRecordPayload,
    TrendHistoryPointPayload,
    TrendHistoryPayload,
    TrendMomentumPayload,
    TrendRecord,
    TrendScoreComponents,
    TrendSourceBreakdownPayload,
    TrendSnapshotPayload,
)
from app.models import NormalizedSignal, TrendDetailRecord, TrendExplorerRecord, TrendScoreResult
from app.models import SourceIngestionRun


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
        sources=source_summaries,
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
    )


def serialize_detail_trend(trend: TrendDetailRecord) -> TrendDetailRecordPayload:
    """Convert an internal detail record into the public V2 contract."""

    return TrendDetailRecordPayload(
        id=trend.id,
        name=trend.name,
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
        evidence_items=[
            TrendEvidenceItemPayload(
                source=item.source,
                signal_type=item.signal_type,
                timestamp=to_timestamp(item.timestamp),
                value=round(item.value, 1),
                evidence=item.evidence,
            )
            for item in trend.evidence_items
        ],
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
            status="healthy" if latest_by_source.get(source, None) and latest_by_source[source].success else "stale",
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
            error_message=latest_by_source[source].error_message if source in latest_by_source else None,
        )
        for source in sorted(known_sources, key=lambda item: (-signal_counts.get(item, 0), item))
    ]
