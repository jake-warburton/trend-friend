"""Watchlist API routes."""

from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db
from app.data.repositories import TrendScoreRepository, WatchlistRepository
from app.watchlists_payloads import build_watchlist_payload

router = APIRouter(tags=["watchlists"])


@router.get("/watchlists")
def list_watchlists(db: sqlite3.Connection = Depends(get_db)) -> dict:
    """Return all watchlists with items, alert rules, and current matches."""

    watchlist_repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)
    watchlist_repo.ensure_default_watchlist()
    return build_watchlist_payload(watchlist_repo, score_repo)


@router.post("/watchlists")
def create_watchlist(body: dict, db: sqlite3.Connection = Depends(get_db)) -> dict:
    """Create a new watchlist."""

    name = body.get("name")
    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    watchlist_repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)
    watchlist_repo.create_watchlist(name)
    return build_watchlist_payload(watchlist_repo, score_repo)


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

    return build_watchlist_payload(watchlist_repo, score_repo)
