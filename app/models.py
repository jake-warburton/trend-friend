"""Shared data models used across the application."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class RawSourceItem:
    """A normalized external content item before topic extraction."""

    source: str
    external_id: str
    title: str
    url: str
    timestamp: datetime
    engagement_score: float
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class NormalizedSignal:
    """A topic-level signal derived from a source item."""

    topic: str
    source: str
    signal_type: str
    value: float
    timestamp: datetime
    evidence: str


@dataclass(frozen=True)
class SourceIngestionRun:
    """Fetch result for a single source during a pipeline run."""

    source: str
    fetched_at: datetime
    success: bool
    item_count: int
    duration_ms: int
    used_fallback: bool = False
    error_message: str | None = None


@dataclass(frozen=True)
class TopicAggregate:
    """Aggregated metrics for a topic across many signals."""

    topic: str
    source_counts: dict[str, int]
    signal_counts: dict[str, int]
    total_signal_value: float
    average_signal_value: float
    latest_timestamp: datetime
    evidence: list[str]


@dataclass(frozen=True)
class TrendScoreResult:
    """Explainable trend score output for a topic."""

    topic: str
    total_score: float
    search_score: float
    social_score: float
    developer_score: float
    knowledge_score: float
    diversity_score: float
    evidence: list[str]
    source_counts: dict[str, int]
    latest_timestamp: datetime


@dataclass(frozen=True)
class TrendHistoryPoint:
    """Historical position and score for a topic at a specific run."""

    captured_at: datetime
    rank: int
    score_total: float


@dataclass(frozen=True)
class TrendMomentum:
    """Movement metrics derived from the most recent historical snapshots."""

    previous_rank: int | None
    rank_change: int | None
    absolute_delta: float | None
    percent_delta: float | None


@dataclass(frozen=True)
class TrendExplorerRecord:
    """Richer read model for the explorer dashboard."""

    id: str
    name: str
    rank: int
    previous_rank: int | None
    rank_change: int | None
    first_seen_at: datetime | None
    latest_signal_at: datetime
    score: TrendScoreResult
    momentum: TrendMomentum
    source_count: int
    signal_count: int


@dataclass(frozen=True)
class TrendSourceBreakdown:
    """Source-level coverage details for a trend."""

    source: str
    signal_count: int
    latest_signal_at: datetime


@dataclass(frozen=True)
class TrendEvidenceItem:
    """Evidence item captured from a normalized signal."""

    source: str
    signal_type: str
    timestamp: datetime
    value: float
    evidence: str


@dataclass(frozen=True)
class TrendDetailRecord:
    """Detailed read model for a single trend page."""

    id: str
    name: str
    rank: int
    previous_rank: int | None
    rank_change: int | None
    first_seen_at: datetime | None
    latest_signal_at: datetime
    score: TrendScoreResult
    momentum: TrendMomentum
    source_count: int
    signal_count: int
    sources: list[str]
    history: list[TrendHistoryPoint]
    source_breakdown: list[TrendSourceBreakdown]
    evidence_items: list[TrendEvidenceItem]


@dataclass(frozen=True)
class SourceSummaryTrend:
    """Trend summary associated with a source."""

    id: str
    name: str
    rank: int
    score_total: float


@dataclass(frozen=True)
class SourceSummaryRecord:
    """Detailed source health and contribution summary."""

    source: str
    status: str
    latest_fetch_at: datetime | None
    latest_success_at: datetime | None
    latest_item_count: int
    duration_ms: int
    used_fallback: bool
    error_message: str | None
    signal_count: int
    trend_count: int
    run_history: list[SourceIngestionRun]
    top_trends: list[SourceSummaryTrend]
