"""Alert API routes."""

from __future__ import annotations
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db
from app.alerts.evaluate import SUPPORTED_RULE_TYPES
from app.auth.middleware import auth_enabled, require_auth
from app.data.connection import DatabaseConnection
from app.data.repositories import WatchlistRepository
from app.models import User


def _to_utc_iso(value) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

router = APIRouter(tags=["alerts"])


@router.get("/alerts")
def list_alerts(
    unread_only: bool = False,
    limit: int = 50,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Return recent alert events."""

    limit = max(1, min(limit, 500))
    repo = WatchlistRepository(db)
    events = repo.list_alert_events(
        unread_only=unread_only,
        limit=limit,
        owner_user_id=user.id if auth_enabled() else None,
    )
    return {
        "alerts": [
            {
                "id": event.id,
                "ruleId": event.rule_id,
                "watchlistId": event.watchlist_id,
                "trendId": event.trend_id,
                "trendName": event.trend_name,
                "ruleType": event.rule_type,
                "threshold": event.threshold,
                "currentValue": event.current_value,
                "message": event.message,
                "triggeredAt": _to_utc_iso(event.triggered_at),
                "read": event.read,
            }
            for event in events
        ],
    }


@router.post("/alerts/read")
def mark_alerts_read(
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Mark alert events as read."""

    event_ids = body.get("eventIds", [])
    if not isinstance(event_ids, list) or not all(isinstance(i, int) for i in event_ids):
        raise HTTPException(status_code=422, detail="eventIds must be a list of integers")
    repo = WatchlistRepository(db)
    updated = repo.mark_alerts_read(event_ids, owner_user_id=user.id if auth_enabled() else None)
    return {"updated": updated}


@router.get("/alerts/rules")
def list_alert_rules(user: User = Depends(require_auth), db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return all configured alert rules."""

    repo = WatchlistRepository(db)
    rules = repo.list_alert_rules(owner_user_id=user.id if auth_enabled() else None)
    return {
        "rules": [
            {
                "id": rule.id,
                "watchlistId": rule.watchlist_id,
                "thesisId": rule.thesis_id,
                "name": rule.name,
                "ruleType": rule.rule_type,
                "threshold": rule.threshold,
                "enabled": rule.enabled,
                "createdAt": _to_utc_iso(rule.created_at),
            }
            for rule in rules
        ],
    }


@router.post("/alerts/rules")
def create_alert_rule(
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Create a new alert rule."""

    watchlist_id = body.get("watchlistId")
    name = body.get("name")
    rule_type = body.get("ruleType")
    threshold = body.get("threshold")

    if not all([watchlist_id, name, rule_type, threshold is not None]):
        raise HTTPException(status_code=422, detail="watchlistId, name, ruleType, and threshold are required")
    if rule_type not in SUPPORTED_RULE_TYPES:
        raise HTTPException(status_code=422, detail=f"Unsupported rule type: {rule_type}")

    repo = WatchlistRepository(db)
    watchlist = repo.get_watchlist_for_owner(watchlist_id, user.id if auth_enabled() else None)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    rule = repo.create_alert_rule(
        watchlist_id=watchlist_id,
        name=name,
        rule_type=rule_type,
        threshold=float(threshold),
    )
    return {
        "id": rule.id,
        "watchlistId": rule.watchlist_id,
        "thesisId": rule.thesis_id,
        "name": rule.name,
        "ruleType": rule.rule_type,
        "threshold": rule.threshold,
        "enabled": rule.enabled,
        "createdAt": _to_utc_iso(rule.created_at),
    }
