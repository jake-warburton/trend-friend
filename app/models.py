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
