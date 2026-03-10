"""Breakout prediction based on historical trend momentum.

Uses a simple weighted feature model rather than external ML libraries
to keep the "free to run" constraint. Features:
  - Score acceleration (second derivative of score over time)
  - Rank velocity (rate of rank improvement)
  - Source diversity growth
  - Recency bias (newer trends get a boost)

Output: a probability-like confidence score [0.0, 1.0] for each trend.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

from app.models import SeasonalityResult, TrendHistoryPoint, TrendScoreResult


@dataclass(frozen=True)
class BreakoutPrediction:
    """Predicted breakout likelihood for a trend."""

    trend_id: str
    trend_name: str
    confidence: float  # 0.0 to 1.0
    signals: list[str]  # human-readable reasons
    current_score: float
    predicted_direction: str  # "breakout", "rising", "stable", "declining"


# Feature weights (tuned heuristically)
_W_ACCELERATION = 0.30
_W_RANK_VELOCITY = 0.25
_W_DIVERSITY = 0.15
_W_RECENCY = 0.15
_W_MAGNITUDE = 0.15


def predict_breakouts(
    current_scores: list[TrendScoreResult],
    histories: dict[str, list[TrendHistoryPoint]],
    current_ranks: dict[str, int],
    first_seen: dict[str, datetime | None],
    now: datetime,
    seasonality_by_topic: dict[str, SeasonalityResult | None] | None = None,
) -> list[BreakoutPrediction]:
    """Predict breakout likelihood for all scored trends.

    Returns predictions sorted by confidence descending.
    """

    predictions: list[BreakoutPrediction] = []
    for score in current_scores:
        topic = score.topic
        history = histories.get(topic, [])
        rank = current_ranks.get(topic)
        first = first_seen.get(topic)

        prediction = _predict_single(
            topic=topic,
            score=score,
            history=history,
            rank=rank,
            first_seen_at=first,
            now=now,
            seasonality=seasonality_by_topic.get(topic) if seasonality_by_topic else None,
        )
        predictions.append(prediction)

    predictions.sort(key=lambda p: (-p.confidence, p.trend_name))
    return predictions


def _predict_single(
    topic: str,
    score: TrendScoreResult,
    history: list[TrendHistoryPoint],
    rank: int | None,
    first_seen_at: datetime | None,
    now: datetime,
    seasonality: SeasonalityResult | None,
) -> BreakoutPrediction:
    """Compute breakout prediction for a single trend."""

    signals: list[str] = []
    sorted_history = sorted(history, key=lambda h: h.captured_at)

    # Feature 1: Score acceleration
    acceleration = _score_acceleration(sorted_history)
    accel_score = _sigmoid(acceleration / 5.0)
    if acceleration > 2.0:
        signals.append(f"Score accelerating (+{acceleration:.1f}/run)")

    # Feature 2: Rank velocity
    rank_velocity = _rank_velocity(sorted_history)
    rank_score = _sigmoid(rank_velocity / 3.0)
    if rank_velocity > 1.0:
        signals.append(f"Climbing ranks ({rank_velocity:+.1f}/run)")

    # Feature 3: Source diversity
    diversity_count = len(score.source_counts)
    diversity_score = min(diversity_count / 4.0, 1.0)
    if diversity_count >= 3:
        signals.append(f"Multi-source coverage ({diversity_count} sources)")

    # Feature 4: Recency (newer trends are more likely to break out)
    recency_score = 0.5
    if first_seen_at is not None:
        age_hours = max((now - first_seen_at).total_seconds() / 3600.0, 0.1)
        recency_score = _sigmoid(-math.log(age_hours / 48.0))
        if age_hours < 24:
            signals.append("Recently emerged (<24h)")

    # Feature 5: Absolute score magnitude
    magnitude_score = _sigmoid((score.total_score - 20.0) / 15.0)
    if score.total_score >= 30.0:
        signals.append(f"High base score ({score.total_score:.1f})")

    # Weighted combination
    confidence = (
        _W_ACCELERATION * accel_score
        + _W_RANK_VELOCITY * rank_score
        + _W_DIVERSITY * diversity_score
        + _W_RECENCY * recency_score
        + _W_MAGNITUDE * magnitude_score
    )

    if seasonality is not None:
        if seasonality.tag == "recurring":
            confidence *= 0.6
            signals.append(f"Recurring pattern detected ({seasonality.recurrence_count} reappearances)")
        elif seasonality.tag == "evergreen":
            confidence *= 0.85
            signals.append("Evergreen topic with consistent presence")

    confidence = max(0.0, min(1.0, confidence))

    # Determine direction label
    if confidence >= 0.65:
        direction = "breakout"
    elif confidence >= 0.45:
        direction = "rising"
    elif confidence >= 0.25:
        direction = "stable"
    else:
        direction = "declining"

    if not signals:
        signals.append("No strong momentum signals")

    trend_name = " ".join(
        part.upper() if len(part) <= 3 else part.capitalize()
        for part in topic.split()
    )

    return BreakoutPrediction(
        trend_id=_slugify(topic),
        trend_name=trend_name,
        confidence=round(confidence, 3),
        signals=signals,
        current_score=score.total_score,
        predicted_direction=direction,
    )


def _score_acceleration(history: list[TrendHistoryPoint]) -> float:
    """Compute the second derivative of score over recent snapshots."""

    if len(history) < 3:
        if len(history) == 2:
            return history[-1].score_total - history[-2].score_total
        return 0.0

    recent = history[-3:]
    delta_1 = recent[1].score_total - recent[0].score_total
    delta_2 = recent[2].score_total - recent[1].score_total
    return delta_2 - delta_1


def _rank_velocity(history: list[TrendHistoryPoint]) -> float:
    """Compute average rank improvement per snapshot (positive = climbing)."""

    if len(history) < 2:
        return 0.0

    recent = history[-min(len(history), 4):]
    changes = [recent[i].rank - recent[i + 1].rank for i in range(len(recent) - 1)]
    return sum(changes) / len(changes)


def _sigmoid(x: float) -> float:
    """Standard sigmoid squashing to [0, 1]."""

    return 1.0 / (1.0 + math.exp(-x))


def _slugify(topic: str) -> str:
    normalized = "".join(c.lower() if c.isalnum() else "-" for c in topic)
    return "-".join(part for part in normalized.split("-") if part) or "trend"
