"""Trend ranking helpers."""

from __future__ import annotations

from app.models import TrendScoreResult
from app.scoring.quality import is_low_evidence_trend
from app.topics.categorize import categorize_topic
from app.topics.normalize import clean_text, tokenize_text

PROTECTED_TOP_RANK_COUNT = 25
LOW_EVIDENCE_TAIL_PENALTY = 6.0
MIN_LOW_EVIDENCE_TAIL_SCORE = 18.0
MIN_EXPERIMENTAL_SCORE = 12.0
MIN_EXPERIMENTAL_TOKEN_COUNT = 2
GENERIC_EXPERIMENTAL_TOKENS = {
    "ai",
    "bot",
    "changes",
    "enabling",
    "exposes",
    "scientific",
    "social",
    "time",
}


def rank_topics_by_score(
    scores: list[TrendScoreResult],
    limit: int = 25,
) -> list[TrendScoreResult]:
    """Return deterministically sorted trend results with a quality gate in the tail."""

    ranked_scores = sorted(
        scores,
        key=lambda score: (-score.total_score, score.topic, score.latest_timestamp.isoformat()),
    )
    if limit <= 0:
        return []

    protected_count = min(PROTECTED_TOP_RANK_COUNT, limit, len(ranked_scores))
    if len(ranked_scores) <= protected_count:
        return ranked_scores[:limit]
    protected_scores = ranked_scores[:protected_count]
    tail_scores = _sort_tail_scores(ranked_scores[protected_count:])
    selected_tail, gated_tail = _partition_tail_scores(tail_scores)

    remaining_slots = max(0, limit - len(protected_scores))
    return protected_scores + selected_tail[:remaining_slots]


def rank_experimental_topics(
    scores: list[TrendScoreResult],
    published_scores: list[TrendScoreResult],
    limit: int = 12,
) -> list[TrendScoreResult]:
    """Return weaker but still viable candidates outside the strict published ranking."""

    if limit <= 0:
        return []

    published_topics = {score.topic for score in published_scores}
    candidates = _sort_tail_scores(
        [score for score in sorted(scores, key=lambda item: (-item.total_score, item.topic, item.latest_timestamp.isoformat())) if score.topic not in published_topics]
    )
    return [
        score
        for score in candidates
        if _is_experimental_candidate(score)
    ][:limit]


def _sort_tail_scores(scores: list[TrendScoreResult]) -> list[TrendScoreResult]:
    """Sort the lower ranking tail, penalizing thin topics without mutating their stored scores."""

    return sorted(
        scores,
        key=lambda score: (
            -_tail_effective_score(score),
            score.topic,
            score.latest_timestamp.isoformat(),
        ),
    )


def _tail_effective_score(score: TrendScoreResult) -> float:
    """Return the quality-adjusted score used only for tail ranking."""

    if not is_low_evidence_trend(score):
        return score.total_score
    return score.total_score - LOW_EVIDENCE_TAIL_PENALTY


def _partition_tail_scores(
    scores: list[TrendScoreResult],
) -> tuple[list[TrendScoreResult], list[TrendScoreResult]]:
    """Split tail candidates into preferred and gated groups."""

    selected: list[TrendScoreResult] = []
    gated: list[TrendScoreResult] = []
    for score in scores:
        if is_low_evidence_trend(score) and score.total_score < MIN_LOW_EVIDENCE_TAIL_SCORE:
            gated.append(score)
            continue
        selected.append(score)
    return selected, gated


def _is_experimental_candidate(score: TrendScoreResult) -> bool:
    """Return whether a non-published score is still worth surfacing experimentally."""

    if score.total_score < MIN_EXPERIMENTAL_SCORE:
        return False
    if not score.evidence:
        return False
    if len(score.source_counts) > 1:
        return True
    topic_tokens = tokenize_text(score.topic)
    if len(topic_tokens) < MIN_EXPERIMENTAL_TOKEN_COUNT:
        return False
    if _looks_like_generic_fragment(topic_tokens):
        return False
    category = categorize_topic(score.topic, score.source_counts)
    if category == "general-tech":
        return False
    if score.developer_score > 0 or score.knowledge_score > 0:
        return _has_concrete_technical_signal(topic_tokens) or _contains_exact_topic_phrase(score)
    if score.search_score > 0:
        return _contains_exact_topic_phrase(score)
    return not is_low_evidence_trend(score) and _contains_exact_topic_phrase(score) and _has_concrete_technical_signal(topic_tokens)


def _looks_like_generic_fragment(topic_tokens: list[str]) -> bool:
    """Return True when a topic looks like a weak headline fragment rather than a stable concept."""

    generic_token_count = sum(1 for token in topic_tokens if token in GENERIC_EXPERIMENTAL_TOKENS)
    return generic_token_count >= max(1, len(topic_tokens) - 1)


def _has_concrete_technical_signal(topic_tokens: list[str]) -> bool:
    """Return True for topic shapes that look concrete enough for an experimental slot."""

    return any(
        token.isdigit()
        for token in topic_tokens
    ) or any(
        len(token) >= 8 for token in topic_tokens
    )


def _contains_exact_topic_phrase(score: TrendScoreResult) -> bool:
    """Return True when at least one evidence item contains the full topic phrase."""

    normalized_topic = clean_text(score.topic)
    return any(clean_text(evidence).find(normalized_topic) != -1 for evidence in score.evidence)
