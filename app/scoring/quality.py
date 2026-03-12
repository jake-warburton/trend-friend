"""Run-level quality diagnostics for trend scoring."""

from __future__ import annotations

from dataclasses import dataclass

from app.models import NormalizedSignal, TopicAggregate, TrendScoreResult


@dataclass(frozen=True)
class PipelineQualityMetrics:
    """Compact diagnostics that explain ranking breadth and duplicate pressure."""

    raw_topic_count: int
    merged_topic_count: int
    duplicate_topic_count: int
    duplicate_topic_rate: float
    multi_source_trend_count: int
    low_evidence_trend_count: int


def calculate_pipeline_quality_metrics(
    signals: list[NormalizedSignal],
    aggregates: list[TopicAggregate],
    ranked_scores: list[TrendScoreResult],
) -> PipelineQualityMetrics:
    """Return run-level quality metrics derived from the pipeline stages."""

    raw_topic_count = len({signal.topic for signal in signals})
    merged_topic_count = len(aggregates)
    duplicate_topic_count = max(0, raw_topic_count - merged_topic_count)
    duplicate_topic_rate = round(
        (duplicate_topic_count / raw_topic_count) * 100,
        1,
    ) if raw_topic_count else 0.0
    multi_source_trend_count = sum(1 for score in ranked_scores if len(score.source_counts) > 1)
    low_evidence_trend_count = sum(1 for score in ranked_scores if is_low_evidence_trend(score))
    return PipelineQualityMetrics(
        raw_topic_count=raw_topic_count,
        merged_topic_count=merged_topic_count,
        duplicate_topic_count=duplicate_topic_count,
        duplicate_topic_rate=duplicate_topic_rate,
        multi_source_trend_count=multi_source_trend_count,
        low_evidence_trend_count=low_evidence_trend_count,
    )


def is_low_evidence_trend(score: TrendScoreResult) -> bool:
    """Return True when a ranked trend has only thin single-source support."""

    total_signals = sum(score.source_counts.values())
    return len(score.source_counts) <= 1 and total_signals <= 1 and len(score.evidence) <= 1
