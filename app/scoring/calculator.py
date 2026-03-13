"""Trend score calculation."""

from __future__ import annotations

from math import log10
from datetime import datetime

from app.models import TopicAggregate, TrendScoreResult
from app.sources.catalog import source_family_for_source, source_reliability_for_source
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
WIKIPEDIA_ONLY_TOPIC_PENALTY = 4.0
MAX_FRESHNESS_BONUS = 5.0
MAX_VELOCITY_BONUS = 4.5
MAX_RELIABILITY_BONUS = 4.0
MAX_FAMILY_DIVERSITY_BONUS = 4.5
GENERIC_TOPIC_PENALTY = 2.5


def calculate_trend_scores(
    aggregates: list[TopicAggregate],
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> list[TrendScoreResult]:
    """Return explainable trend scores for topic aggregates."""

    results: list[TrendScoreResult] = []
    reference_time = max((aggregate.latest_timestamp for aggregate in aggregates), default=datetime.now())
    for aggregate in aggregates:
        social_score = scaled_component_score(aggregate, "social", weights.social_weight)
        developer_score = scaled_component_score(aggregate, "developer", weights.developer_weight)
        knowledge_score = scaled_component_score(aggregate, "knowledge", weights.knowledge_weight)
        search_score = scaled_component_score(aggregate, "search", weights.search_weight)
        diversity_score = len(aggregate.source_counts) * weights.diversity_weight
        quality_adjustment = topic_quality_adjustment(aggregate, reference_time)
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
                display_name=aggregate.display_name,
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
    total_signal_value = max(aggregate.total_signal_value, 0.0)
    if total_signal_value == 0.0:
        return 0.0
    return log10(total_signal_value + 1.0) * signal_count * weight * 10


def topic_quality_adjustment(aggregate: TopicAggregate, reference_time: datetime) -> float:
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
    if len(topic_tokens) <= 1 or (len(topic_tokens) == 2 and all(len(token) <= 4 for token in topic_tokens)):
        adjustment -= GENERIC_TOPIC_PENALTY
    if set(aggregate.source_counts) == {"wikipedia"}:
        adjustment -= WIKIPEDIA_ONLY_TOPIC_PENALTY
    adjustment += corroboration_adjustment(aggregate)
    adjustment += freshness_adjustment(aggregate, reference_time)
    adjustment += velocity_adjustment(aggregate)
    adjustment += reliability_adjustment(aggregate)
    adjustment += family_diversity_adjustment(aggregate)
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


def freshness_adjustment(aggregate: TopicAggregate, reference_time: datetime) -> float:
    """Reward topics that are close to the freshest evidence in the current batch."""

    age_hours = max((reference_time - aggregate.latest_timestamp).total_seconds() / 3600, 0.0)
    freshness_ratio = max(0.0, 1.0 - min(age_hours / 72.0, 1.0))
    return round(freshness_ratio * MAX_FRESHNESS_BONUS, 2)


def velocity_adjustment(aggregate: TopicAggregate) -> float:
    """Reward dense evidence and stronger average signal values."""

    corroborated_count = sum(aggregate.source_counts.values())
    density = min(1.0, corroborated_count / 6.0)
    average_signal_value = max(aggregate.average_signal_value, 0.0)
    value_score = min(1.0, log10(average_signal_value + 1.0) / 3.0)
    return round((density * 0.45 + value_score * 0.55) * MAX_VELOCITY_BONUS, 2)


def reliability_adjustment(aggregate: TopicAggregate) -> float:
    """Reward topics supported by more reliable source priors."""

    total_mentions = max(1, sum(aggregate.source_counts.values()))
    weighted_reliability = sum(
        source_reliability_for_source(source) * count
        for source, count in aggregate.source_counts.items()
    ) / total_mentions
    return round(weighted_reliability * MAX_RELIABILITY_BONUS, 2)


def family_diversity_adjustment(aggregate: TopicAggregate) -> float:
    """Reward corroboration across different source families, not just raw source count."""

    families = {source_family_for_source(source) for source in aggregate.source_counts}
    if len(families) <= 1:
        return 0.0
    return round(min(1.0, (len(families) - 1) / 4.0) * MAX_FAMILY_DIVERSITY_BONUS, 2)
