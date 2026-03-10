"""Build digest summaries for completed ranking runs."""

from __future__ import annotations

from app.models import DigestMover, RunDigest, TrendScoreResult

MAX_NEW_ENTRIES = 5
MAX_BIGGEST_MOVERS = 5
MIN_BIGGEST_MOVER_DELTA = 3


def build_run_digest(
    current_scores: list[TrendScoreResult],
    previous_scores: list[TrendScoreResult] | None,
    current_ranks: dict[str, int],
    previous_ranks: dict[str, int],
    statuses: dict[str, str],
) -> RunDigest:
    """Summarize the most notable changes in the latest ranking run."""

    previous_topics = {score.topic for score in previous_scores or []}
    new_entries = [
        score.topic
        for score in current_scores
        if score.topic not in previous_topics
    ][:MAX_NEW_ENTRIES]

    movers: list[DigestMover] = []
    for score in current_scores:
        previous_rank = previous_ranks.get(score.topic)
        current_rank = current_ranks.get(score.topic)
        if previous_rank is None or current_rank is None:
            continue
        rank_change = previous_rank - current_rank
        if abs(rank_change) < MIN_BIGGEST_MOVER_DELTA:
            continue
        movers.append(
            DigestMover(
                name=score.topic,
                rank_change=rank_change,
                score=round(score.total_score, 1),
            )
        )

    biggest_movers = sorted(
        movers,
        key=lambda mover: (abs(mover.rank_change), mover.score),
        reverse=True,
    )[:MAX_BIGGEST_MOVERS]

    breakouts = [
        score.topic
        for score in current_scores
        if statuses.get(score.topic) == "breakout"
    ]

    return RunDigest(
        total_trends=len(current_scores),
        new_entries=new_entries,
        biggest_movers=biggest_movers,
        breakouts=breakouts,
    )
