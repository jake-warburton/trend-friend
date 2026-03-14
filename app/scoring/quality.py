"""Run-level quality diagnostics for trend scoring."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.models import NormalizedSignal, SourceFamilySnapshot, SourceIngestionRun, TopicAggregate, TrendScoreResult
from app.sources.catalog import source_family_for_source


@dataclass(frozen=True)
class PipelineQualityMetrics:
    """Compact diagnostics that explain ranking breadth and duplicate pressure."""

    raw_topic_count: int
    merged_topic_count: int
    duplicate_topic_count: int
    duplicate_topic_rate: float
    multi_source_trend_count: int
    low_evidence_trend_count: int


@dataclass(frozen=True)
class SourceQualityMetrics:
    """Compact diagnostics that explain one source's topic fragmentation."""

    raw_topic_count: int
    merged_topic_count: int
    duplicate_topic_count: int
    duplicate_topic_rate: float


TOP_RANKED_FAMILY_WINDOW = 10


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


def calculate_source_quality_metrics(
    signals: list[NormalizedSignal],
    aggregates: list[TopicAggregate],
) -> dict[str, SourceQualityMetrics]:
    """Return per-source candidate diagnostics before and after source-local merging."""

    source_names = {signal.source for signal in signals}
    metrics: dict[str, SourceQualityMetrics] = {}
    for source in source_names:
        source_signals = [signal for signal in signals if signal.source == source]
        source_aggregates = [aggregate for aggregate in aggregates if source in aggregate.source_counts]
        raw_topic_count = len({signal.topic for signal in source_signals})
        merged_topic_count = len(source_aggregates)
        duplicate_topic_count = max(0, raw_topic_count - merged_topic_count)
        duplicate_topic_rate = round(
            (duplicate_topic_count / raw_topic_count) * 100,
            1,
        ) if raw_topic_count else 0.0
        metrics[source] = SourceQualityMetrics(
            raw_topic_count=raw_topic_count,
            merged_topic_count=merged_topic_count,
            duplicate_topic_count=duplicate_topic_count,
            duplicate_topic_rate=duplicate_topic_rate,
        )
    return metrics


def build_yield_rate_percent(run: SourceIngestionRun) -> float:
    """Return the kept-item yield percentage for one source run."""

    if run.raw_item_count <= 0:
        return 0.0
    return round((run.kept_item_count / run.raw_item_count) * 100, 1)


def calculate_source_family_snapshots(
    captured_at: datetime,
    signals: list[NormalizedSignal],
    source_runs: list[SourceIngestionRun],
    ranked_scores: list[TrendScoreResult],
) -> list[SourceFamilySnapshot]:
    """Return one historical rollup per source family for the current run."""

    family_sources: dict[str, set[str]] = {}
    healthy_source_counts: dict[str, int] = {}
    yield_totals: dict[str, float] = {}

    for run in source_runs:
        family = source_family_for_source(run.source)
        family_sources.setdefault(family, set()).add(run.source)
        if run.success and not run.used_fallback:
            healthy_source_counts[family] = healthy_source_counts.get(family, 0) + 1
        yield_totals[family] = yield_totals.get(family, 0.0) + build_yield_rate_percent(run)

    signal_counts: dict[str, int] = {}
    for signal in signals:
        family = source_family_for_source(signal.source)
        signal_counts[family] = signal_counts.get(family, 0) + 1

    family_trend_counts: dict[str, int] = {}
    corroborated_trend_counts: dict[str, int] = {}
    top_ranked_trend_counts: dict[str, int] = {}
    score_totals: dict[str, float] = {}

    for rank, score in enumerate(ranked_scores, start=1):
        families = {source_family_for_source(source) for source in score.source_counts}
        multi_family = len(families) > 1
        for family in families:
            family_trend_counts[family] = family_trend_counts.get(family, 0) + 1
            score_totals[family] = score_totals.get(family, 0.0) + score.total_score
            if multi_family:
                corroborated_trend_counts[family] = corroborated_trend_counts.get(family, 0) + 1
            if rank <= TOP_RANKED_FAMILY_WINDOW:
                top_ranked_trend_counts[family] = top_ranked_trend_counts.get(family, 0) + 1

    families = set(family_sources) | set(signal_counts) | set(family_trend_counts)
    snapshots: list[SourceFamilySnapshot] = []
    for family in sorted(families):
        source_count = len(family_sources.get(family, set()))
        trend_count = family_trend_counts.get(family, 0)
        snapshots.append(
            SourceFamilySnapshot(
                family=family,
                captured_at=captured_at,
                source_count=source_count,
                healthy_source_count=healthy_source_counts.get(family, 0),
                signal_count=signal_counts.get(family, 0),
                trend_count=trend_count,
                corroborated_trend_count=corroborated_trend_counts.get(family, 0),
                top_ranked_trend_count=top_ranked_trend_counts.get(family, 0),
                average_score=round(score_totals.get(family, 0.0) / trend_count, 1) if trend_count else 0.0,
                average_yield_rate_percent=round(yield_totals.get(family, 0.0) / source_count, 1) if source_count else 0.0,
                success_rate_percent=round((healthy_source_counts.get(family, 0) / source_count) * 100, 1) if source_count else 0.0,
            )
        )
    return snapshots
