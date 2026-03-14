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

    return metrics


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
