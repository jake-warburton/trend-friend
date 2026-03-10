"""Trend score calculation."""

from __future__ import annotations

from math import log10

from app.models import TopicAggregate, TrendScoreResult
from app.scoring.weights import DEFAULT_WEIGHTS, ScoreWeights
from app.topics.normalize import clean_text

GENERIC_LEAD_TOKENS = {
    "important",
    "learnings",
    "notes",
    "optimizing",
    "opinionated",
    "paying",
    "useless",
}
EXACT_PHRASE_BONUS = 1.5
GENERIC_LEAD_PENALTY = 2.0


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
        quality_adjustment = topic_quality_adjustment(aggregate)
        total_score = round(
            social_score
            + developer_score
            + knowledge_score
            + search_score
            + diversity_score
            + quality_adjustment,
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


def topic_quality_adjustment(aggregate: TopicAggregate) -> float:
    """Apply a small quality adjustment for specific versus generic phrases."""

    adjustment = 0.0
    normalized_topic = clean_text(aggregate.topic)
    if any(normalized_topic in clean_text(evidence) for evidence in aggregate.evidence):
        adjustment += EXACT_PHRASE_BONUS

    topic_tokens = normalized_topic.split()
    if topic_tokens and topic_tokens[0] in GENERIC_LEAD_TOKENS:
        adjustment -= GENERIC_LEAD_PENALTY
    return adjustment
