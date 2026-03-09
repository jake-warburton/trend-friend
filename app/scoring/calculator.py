"""Trend score calculation."""

from __future__ import annotations

from math import log10

from app.models import TopicAggregate, TrendScoreResult
from app.scoring.weights import DEFAULT_WEIGHTS, ScoreWeights


def calculate_trend_scores(
    aggregates: list[TopicAggregate],
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> list[TrendScoreResult]:
    """Return explainable trend scores for topic aggregates."""

    results: list[TrendScoreResult] = []
    for aggregate in aggregates:
        social_score = scaled_component_score(aggregate, "social", weights.social_weight)
        developer_score = scaled_component_score(aggregate, "developer", weights.developer_weight)
        knowledge_score = scaled_component_score(aggregate, "knowledge", weights.knowledge_weight)
        search_score = scaled_component_score(aggregate, "search", weights.search_weight)
        diversity_score = len(aggregate.source_counts) * weights.diversity_weight
        total_score = round(
            social_score + developer_score + knowledge_score + search_score + diversity_score,
            2,
        )
        results.append(
            TrendScoreResult(
                topic=aggregate.topic,
                total_score=total_score,
                search_score=round(search_score, 2),
                social_score=round(social_score, 2),
                developer_score=round(developer_score, 2),
                knowledge_score=round(knowledge_score, 2),
                diversity_score=round(diversity_score, 2),
                evidence=aggregate.evidence,
                source_counts=aggregate.source_counts,
                latest_timestamp=aggregate.latest_timestamp,
            )
        )
    return results


def scaled_component_score(
    aggregate: TopicAggregate,
    signal_type: str,
    weight: float,
) -> float:
    """Scale total signal value by signal count and an explicit weight."""

    signal_count = aggregate.signal_counts.get(signal_type, 0)
    if signal_count == 0 or weight == 0:
        return 0.0
    return log10(aggregate.total_signal_value + 1) * signal_count * weight * 10
