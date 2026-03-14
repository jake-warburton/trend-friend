"""Evaluate alert rules against current trend state."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.models import AlertRule, TrendScoreResult


RULE_TYPE_SCORE_ABOVE = "score_above"
RULE_TYPE_RANK_CHANGE = "rank_change"
RULE_TYPE_NEW_BREAKOUT = "new_breakout"
RULE_TYPE_NEW_TREND = "new_trend"
RULE_TYPE_THESIS_MATCH = "thesis_match"

SUPPORTED_RULE_TYPES = {
    RULE_TYPE_SCORE_ABOVE,
    RULE_TYPE_RANK_CHANGE,
    RULE_TYPE_NEW_BREAKOUT,
    RULE_TYPE_NEW_TREND,
    RULE_TYPE_THESIS_MATCH,
}


@dataclass(frozen=True)
class AlertEvent:
    """A triggered alert event to be persisted."""

    rule_id: int
    watchlist_id: int
    trend_id: str
    trend_name: str
    rule_type: str
    threshold: float
    current_value: float
    message: str
    triggered_at: datetime


def evaluate_alerts(
    rules: list[AlertRule],
    watchlist_trend_ids: dict[int, set[str]],
    current_scores: list[TrendScoreResult],
    previous_scores: list[TrendScoreResult] | None,
    current_ranks: dict[str, int],
    previous_ranks: dict[str, int],
    statuses: dict[str, str],
    previous_trend_ids: set[str],
    new_thesis_match_ids: dict[int, set[str]] | None = None,
) -> list[AlertEvent]:
    """Evaluate all enabled alert rules and return triggered events."""

    now = datetime.now(tz=timezone.utc)
    score_by_topic = {score.topic: score for score in current_scores}
    events: list[AlertEvent] = []

    for rule in rules:
        if not rule.enabled:
            continue

        watched_ids = watchlist_trend_ids.get(rule.watchlist_id, set())
        thesis_match_ids = set()
        if rule.rule_type == RULE_TYPE_THESIS_MATCH and rule.thesis_id is not None:
            thesis_match_ids = (new_thesis_match_ids or {}).get(rule.thesis_id, set())
            if not thesis_match_ids:
                continue
            watched_ids = watched_ids.union(thesis_match_ids)
        elif not watched_ids:
            continue

        for trend_id in watched_ids:
            score = score_by_topic.get(trend_id)
            if score is None:
                continue

            event = _evaluate_rule(
                rule=rule,
                trend_id=trend_id,
                score=score,
                current_rank=current_ranks.get(trend_id),
                previous_rank=previous_ranks.get(trend_id),
                status=statuses.get(trend_id),
                is_new=trend_id not in previous_trend_ids,
                now=now,
            )
            if event is not None:
                events.append(event)

    return events


def _evaluate_rule(
    rule: AlertRule,
    trend_id: str,
    score: TrendScoreResult,
    current_rank: int | None,
    previous_rank: int | None,
    status: str | None,
    is_new: bool,
    now: datetime,
) -> AlertEvent | None:
    """Check a single rule against a single trend. Return an event or None."""

    trend_name = score.topic

    if rule.rule_type == RULE_TYPE_SCORE_ABOVE:
        if score.total_score >= rule.threshold:
            return AlertEvent(
                rule_id=rule.id,
                watchlist_id=rule.watchlist_id,
                trend_id=trend_id,
                trend_name=trend_name,
                rule_type=rule.rule_type,
                threshold=rule.threshold,
                current_value=score.total_score,
                message=f"{trend_name} score {score.total_score:.1f} >= threshold {rule.threshold:.1f}",
                triggered_at=now,
            )

    elif rule.rule_type == RULE_TYPE_RANK_CHANGE:
        if current_rank is not None and previous_rank is not None:
            change = previous_rank - current_rank
            if change >= rule.threshold:
                return AlertEvent(
                    rule_id=rule.id,
                    watchlist_id=rule.watchlist_id,
                    trend_id=trend_id,
                    trend_name=trend_name,
                    rule_type=rule.rule_type,
                    threshold=rule.threshold,
                    current_value=float(change),
                    message=f"{trend_name} moved up {change} ranks (threshold: {rule.threshold:.0f})",
                    triggered_at=now,
                )

    elif rule.rule_type == RULE_TYPE_NEW_BREAKOUT:
        if status == "breakout":
            return AlertEvent(
                rule_id=rule.id,
                watchlist_id=rule.watchlist_id,
                trend_id=trend_id,
                trend_name=trend_name,
                rule_type=rule.rule_type,
                threshold=rule.threshold,
                current_value=score.total_score,
                message=f"{trend_name} has reached breakout status",
                triggered_at=now,
            )

    elif rule.rule_type == RULE_TYPE_NEW_TREND:
        if is_new:
            return AlertEvent(
                rule_id=rule.id,
                watchlist_id=rule.watchlist_id,
                trend_id=trend_id,
                trend_name=trend_name,
                rule_type=rule.rule_type,
                threshold=rule.threshold,
                current_value=score.total_score,
                message=f"{trend_name} appeared for the first time",
                triggered_at=now,
            )
    elif rule.rule_type == RULE_TYPE_THESIS_MATCH:
        return AlertEvent(
            rule_id=rule.id,
            watchlist_id=rule.watchlist_id,
            trend_id=trend_id,
            trend_name=trend_name,
            rule_type=rule.rule_type,
            threshold=rule.threshold,
            current_value=score.total_score,
            message=f"{trend_name} matched thesis {rule.name}",
            triggered_at=now,
        )

    return None
