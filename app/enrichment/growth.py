"""Growth rate calculation from historical score snapshots."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.data.repositories import TrendScoreRepository
from app.models import TrendHistoryPoint, TrendMetricSnapshot

LOGGER = logging.getLogger(__name__)


def compute_growth_metrics(
    repository: TrendScoreRepository,
    topic: str,
    captured_at: datetime,
) -> list[TrendMetricSnapshot]:
    """Compute score growth rates from historical snapshot data.

    Returns metrics for 7-day, 30-day, and all-time growth rates
    based on actual score history in the database.
    """

    history = list(reversed(repository.get_topic_history(topic, limit_runs=72)))
    if len(history) < 2:
        return []

    current_score = history[-1].score_total
    if current_score <= 0:
        return []

    metrics: list[TrendMetricSnapshot] = []
    now = history[-1].captured_at

    # Compute growth over different periods
    periods = [
        ("7d", timedelta(days=7), "7-day score growth"),
        ("30d", timedelta(days=30), "30-day score growth"),
        ("90d", timedelta(days=90), "90-day score growth"),
    ]

    for period_key, delta, label in periods:
        target_time = now - delta
        baseline_score = _find_closest_score(history, target_time)
        if baseline_score is not None and baseline_score > 0:
            growth_pct = ((current_score - baseline_score) / baseline_score) * 100
            metrics.append(
                TrendMetricSnapshot(
                    source="score_history",
                    metric_key=f"score_growth_{period_key}",
                    label=label,
                    value_numeric=round(growth_pct, 1),
                    value_display=f"{growth_pct:+.1f}%",
                    unit="percent",
                    period=period_key,
                    captured_at=captured_at,
                    confidence=0.85,
                    provenance_url=None,
                    is_estimated=False,
                )
            )

    # Compute velocity (average score change per day over the last 7 days)
    recent_points = [p for p in history if (now - p.captured_at) <= timedelta(days=7)]
    if len(recent_points) >= 2:
        score_changes = [
            recent_points[i].score_total - recent_points[i - 1].score_total
            for i in range(1, len(recent_points))
        ]
        avg_daily_change = sum(score_changes) / len(score_changes)
        metrics.append(
            TrendMetricSnapshot(
                source="score_history",
                metric_key="score_velocity",
                label="Score velocity",
                value_numeric=round(avg_daily_change, 2),
                value_display=f"{avg_daily_change:+.2f}/run",
                unit="score/run",
                period="last 7 days",
                captured_at=captured_at,
                confidence=0.8,
                provenance_url=None,
                is_estimated=False,
            )
        )

    # Compute acceleration (is growth accelerating or decelerating?)
    if len(history) >= 6:
        mid = len(history) // 2
        first_half = history[:mid]
        second_half = history[mid:]
        if len(first_half) >= 2 and len(second_half) >= 2:
            first_growth = (first_half[-1].score_total - first_half[0].score_total)
            second_growth = (second_half[-1].score_total - second_half[0].score_total)
            if first_growth != 0:
                acceleration = ((second_growth - first_growth) / abs(first_growth)) * 100
                label = "accelerating" if acceleration > 10 else "decelerating" if acceleration < -10 else "steady"
                metrics.append(
                    TrendMetricSnapshot(
                        source="score_history",
                        metric_key="growth_acceleration",
                        label=f"Growth trend ({label})",
                        value_numeric=round(acceleration, 1),
                        value_display=f"{acceleration:+.1f}%",
                        unit="percent",
                        period="half-over-half",
                        captured_at=captured_at,
                        confidence=0.7,
                        provenance_url=None,
                        is_estimated=False,
                    )
                )

    # Compute a growth classification label (matches Treendly/ExplodingTopics style)
    growth_label, growth_confidence = _classify_growth(metrics, history)
    if growth_label:
        metrics.append(
            TrendMetricSnapshot(
                source="score_history",
                metric_key="growth_label",
                label=f"Growth pace: {growth_label}",
                value_numeric=growth_confidence,
                value_display=growth_label,
                unit="classification",
                period="overall",
                captured_at=captured_at,
                confidence=growth_confidence,
                provenance_url=None,
                is_estimated=False,
            )
        )

    return metrics


def _classify_growth(
    metrics: list[TrendMetricSnapshot],
    history: list[TrendHistoryPoint],
) -> tuple[str, float]:
    """Classify the growth pace based on computed metrics.

    Returns a label and confidence score.
    Classifications: Exploding, Rapid growth, Steady growth, Peaking, Declining, Stable
    """

    growth_7d = next((m.value_numeric for m in metrics if m.metric_key == "score_growth_7d"), None)
    growth_30d = next((m.value_numeric for m in metrics if m.metric_key == "score_growth_30d"), None)
    velocity = next((m.value_numeric for m in metrics if m.metric_key == "score_velocity"), None)
    acceleration = next((m.value_numeric for m in metrics if m.metric_key == "growth_acceleration"), None)

    # Need at least one growth metric to classify
    if growth_7d is None and growth_30d is None:
        if len(history) < 3:
            return "New", 0.6
        return "", 0.0

    g7 = growth_7d or 0
    g30 = growth_30d or 0
    vel = velocity or 0
    acc = acceleration or 0

    # Exploding: very strong short-term growth with positive acceleration
    if g7 > 50 and vel > 2 and acc > 20:
        return "Exploding", 0.85
    if g7 > 80:
        return "Exploding", 0.8

    # Rapid growth: strong growth across both time periods
    if g7 > 25 and g30 > 30:
        return "Rapid growth", 0.8
    if g30 > 50:
        return "Rapid growth", 0.75

    # Steady growth: consistent positive growth
    if g7 > 5 and g30 > 10:
        return "Steady growth", 0.75
    if g30 > 15:
        return "Steady growth", 0.7

    # Peaking: high absolute score but declining growth
    if g7 < -5 and g30 > 0:
        return "Peaking", 0.7

    # Declining: negative growth across periods
    if g7 < -10 and g30 < -10:
        return "Declining", 0.75
    if g7 < -15:
        return "Declining", 0.7

    # Stable: minimal change
    if abs(g7) < 5 and abs(g30) < 10:
        return "Stable", 0.7

    # Default based on direction
    if g7 > 0 or g30 > 0:
        return "Growing", 0.6
    return "Cooling", 0.6


def _find_closest_score(history: list[TrendHistoryPoint], target_time: datetime) -> float | None:
    """Find the score closest to the target time in the history."""

    if not history:
        return None

    best_point = None
    best_distance = None
    for point in history:
        distance = abs((point.captured_at - target_time).total_seconds())
        if best_distance is None or distance < best_distance:
            best_distance = distance
            best_point = point

    if best_point is None:
        return None

    # Only use the point if it's within a reasonable range (2x the target period)
    if best_distance is not None and best_distance > abs((history[-1].captured_at - target_time).total_seconds()) * 3:
        return None

    return best_point.score_total
