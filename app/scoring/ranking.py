"""Trend ranking helpers."""

from __future__ import annotations

from app.models import TrendScoreResult


def rank_topics_by_score(
    scores: list[TrendScoreResult],
    limit: int = 25,
) -> list[TrendScoreResult]:
    """Return deterministically sorted trend results."""

    ranked_scores = sorted(
        scores,
        key=lambda score: (-score.total_score, score.topic, score.latest_timestamp.isoformat()),
    )
    return ranked_scores[:limit]
