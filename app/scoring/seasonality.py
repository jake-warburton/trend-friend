"""Derived recurrence classification for historical trend appearances."""

from __future__ import annotations

from app.models import SeasonalityResult

MIN_APPEARANCES = 5
MIN_TOTAL_RUNS = 5
RECURRING_GAP_THRESHOLD = 3
EVERGREEN_RATIO_THRESHOLD = 0.8
EVERGREEN_MAX_GAP = 2


def classify_seasonality(
    *,
    appearance_count: int,
    total_runs: int,
    gaps: list[int],
) -> SeasonalityResult:
    """Classify recurrence from a topic's appearance history."""

    if appearance_count < MIN_APPEARANCES or total_runs < MIN_TOTAL_RUNS:
        return SeasonalityResult(tag=None, recurrence_count=0, avg_gap_runs=_average_gap(gaps), confidence=0.0)

    recurrence_gaps = [gap for gap in gaps if gap >= RECURRING_GAP_THRESHOLD]
    recurrence_count = len(recurrence_gaps)
    avg_gap_runs = _average_gap(gaps)
    appearance_ratio = appearance_count / max(total_runs, 1)
    max_gap = max(gaps, default=0)

    if recurrence_count > 0:
        confidence = min(1.0, 0.55 + recurrence_count * 0.15 + min(avg_gap_runs, 6.0) * 0.03)
        return SeasonalityResult(
            tag="recurring",
            recurrence_count=recurrence_count,
            avg_gap_runs=avg_gap_runs,
            confidence=round(confidence, 2),
        )

    if appearance_ratio >= EVERGREEN_RATIO_THRESHOLD and max_gap <= EVERGREEN_MAX_GAP:
        confidence = min(1.0, 0.5 + appearance_ratio * 0.5)
        return SeasonalityResult(
            tag="evergreen",
            recurrence_count=0,
            avg_gap_runs=avg_gap_runs,
            confidence=round(confidence, 2),
        )

    return SeasonalityResult(tag=None, recurrence_count=0, avg_gap_runs=avg_gap_runs, confidence=0.0)


def _average_gap(gaps: list[int]) -> float:
    """Return the average run gap between appearances."""

    if not gaps:
        return 0.0
    return round(sum(gaps) / len(gaps), 1)
