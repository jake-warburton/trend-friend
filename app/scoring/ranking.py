"""Trend ranking helpers."""

from __future__ import annotations

from app.models import TrendScoreResult
from app.scoring.quality import is_low_evidence_trend

PROTECTED_TOP_RANK_COUNT = 25
LOW_EVIDENCE_TAIL_PENALTY = 6.0
MIN_LOW_EVIDENCE_TAIL_SCORE = 18.0
MIN_EXPERIMENTAL_SCORE = 12.0


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
    return True
