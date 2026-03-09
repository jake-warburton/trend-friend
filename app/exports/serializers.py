"""Serialize stored trends into frontend-facing payloads."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from app.exports.contracts import (
    LatestTrendsPayload,
    TrendCoveragePayload,
    TrendExplorerPayload,
    TrendExplorerRecordPayload,
    TrendHistoryPayload,
    TrendMomentumPayload,
    TrendRecord,
    TrendScoreComponents,
    TrendSnapshotPayload,
)
from app.models import TrendExplorerRecord, TrendScoreResult


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
