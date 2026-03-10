"""Watchlist API routes."""

from __future__ import annotations

import sqlite3
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db
from app.data.repositories import TrendScoreRepository, WatchlistRepository

router = APIRouter(tags=["watchlists"])


@router.get("/watchlists")
def list_watchlists(db: sqlite3.Connection = Depends(get_db)) -> dict:
    """Return all watchlists with items, alert rules, and current matches."""

    watchlist_repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)
    watchlist_repo.ensure_default_watchlist()
    return _build_watchlist_payload(watchlist_repo, score_repo)


@router.post("/watchlists")
def create_watchlist(body: dict, db: sqlite3.Connection = Depends(get_db)) -> dict:
    """Create a new watchlist."""

    name = body.get("name")
    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    watchlist_repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)
    watchlist_repo.create_watchlist(name)
    return _build_watchlist_payload(watchlist_repo, score_repo)


@router.post("/watchlists/items")
def manage_watchlist_item(body: dict, db: sqlite3.Connection = Depends(get_db)) -> dict:
    """Add or remove an item from a watchlist."""

    action = body.get("action")
    watchlist_id = body.get("watchlistId")
    trend_id = body.get("trendId")
    watchlist_repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)

    if action == "add":
        trend_name = body.get("trendName", trend_id)
        if not watchlist_id or not trend_id:
            raise HTTPException(status_code=422, detail="watchlistId and trendId are required")
        watchlist_repo.add_item(watchlist_id, trend_id, trend_name)
    elif action == "remove":
        if not watchlist_id or not trend_id:
            raise HTTPException(status_code=422, detail="watchlistId and trendId are required")
        watchlist_repo.remove_item(watchlist_id, trend_id)
    else:
        raise HTTPException(status_code=422, detail="action must be 'add' or 'remove'")

    return _build_watchlist_payload(watchlist_repo, score_repo)


def _build_watchlist_payload(
    watchlist_repo: WatchlistRepository,
    score_repo: TrendScoreRepository,
) -> dict:
    """Build the combined watchlists + alerts + matches payload."""

    latest_scores = score_repo.list_scores(limit=100)
    score_by_slug: dict[str, object] = {}
    for score in latest_scores:
        slug = _slugify(score.topic)
        score_by_slug[slug] = score

    watchlists = watchlist_repo.list_watchlists()
    alerts = watchlist_repo.list_alert_rules()

    alert_matches = []
    for alert in alerts:
        watchlist = next((w for w in watchlists if w.id == alert.watchlist_id), None)
        if watchlist is None or not alert.enabled:
            continue
        for item in watchlist.items:
            score = score_by_slug.get(item.trend_id)
            if score is None:
                continue
            if alert.rule_type == "score_above" and score.total_score >= alert.threshold:
                alert_matches.append({
                    "alertId": alert.id,
                    "alertName": alert.name,
                    "watchlistId": watchlist.id,
                    "trendId": item.trend_id,
                    "trendName": item.trend_name,
                    "ruleType": alert.rule_type,
                    "threshold": alert.threshold,
                    "currentValue": round(score.total_score, 1),
                })

    return {
        "watchlists": [
            {
                "id": w.id,
                "name": w.name,
                "createdAt": _to_utc_iso(w.created_at),
                "updatedAt": _to_utc_iso(w.updated_at),
                "items": [
                    {
                        "trendId": item.trend_id,
                        "trendName": item.trend_name,
                        "addedAt": _to_utc_iso(item.added_at),
                    }
                    for item in w.items
                ],
            }
            for w in watchlists
        ],
        "alerts": [
            {
                "id": a.id,
                "watchlistId": a.watchlist_id,
                "name": a.name,
                "ruleType": a.rule_type,
                "threshold": a.threshold,
                "enabled": a.enabled,
                "createdAt": _to_utc_iso(a.created_at),
            }
            for a in alerts
        ],
        "matches": alert_matches,
    }


def _to_utc_iso(dt: object) -> str:
    """Return a UTC ISO-8601 timestamp string."""
    from datetime import datetime
    if isinstance(dt, datetime):
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(dt)


def _slugify(topic: str) -> str:
    normalized = "".join(c.lower() if c.isalnum() else "-" for c in topic)
    return "-".join(part for part in normalized.split("-") if part) or "trend"
