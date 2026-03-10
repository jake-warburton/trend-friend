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
CORROBORATION_BONUS_PER_EXTRA_EVIDENCE = 0.75
MAX_CORROBORATION_BONUS = 1.5


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
    if normalized_topic and any(
        evidence_contains_exact_topic_phrase(evidence, normalized_topic)
        for evidence in aggregate.evidence
    ):
        adjustment += EXACT_PHRASE_BONUS

    topic_tokens = normalized_topic.split()
    if topic_tokens and topic_tokens[0] in GENERIC_LEAD_TOKENS:
        adjustment -= GENERIC_LEAD_PENALTY
    adjustment += corroboration_adjustment(aggregate)
    return adjustment


def evidence_contains_exact_topic_phrase(evidence: str, normalized_topic: str) -> bool:
    """Return True when evidence includes the full normalized topic phrase."""

    evidence_tokens = clean_text(evidence).replace("/", " ").replace("-", " ").split()
    topic_tokens = normalized_topic.split()
    if not evidence_tokens or not topic_tokens or len(topic_tokens) > len(evidence_tokens):
        return False
    return any(
        evidence_tokens[index : index + len(topic_tokens)] == topic_tokens
        for index in range(len(evidence_tokens) - len(topic_tokens) + 1)
    )


def corroboration_adjustment(aggregate: TopicAggregate) -> float:
    """Reward topics that appear in multiple unique evidence items."""

    unique_evidence = {
        clean_text(evidence)
        for evidence in aggregate.evidence
        if clean_text(evidence)
    }
    extra_evidence_count = max(0, len(unique_evidence) - 1)
    return min(
        extra_evidence_count * CORROBORATION_BONUS_PER_EXTRA_EVIDENCE,
        MAX_CORROBORATION_BONUS,
    )
