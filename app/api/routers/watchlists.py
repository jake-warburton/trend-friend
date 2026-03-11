"""Watchlist API routes."""

from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db
from app.auth.middleware import auth_enabled, require_auth
from app.data.connection import DatabaseConnection
from app.data.repositories import TrendScoreRepository, WatchlistRepository
from app.models import User
from app.watchlists_payloads import build_watchlist_payload

router = APIRouter(tags=["watchlists"])


@router.get("/watchlists")
def list_watchlists(user: User = Depends(require_auth), db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return all watchlists with items, alert rules, and current matches."""

    watchlist_repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)
    current_user = _serialize_current_user(user) if auth_enabled() else None
    owner_user_id = user.id if auth_enabled() else None
    watchlist_repo.ensure_default_watchlist(owner_user_id=owner_user_id)
    return build_watchlist_payload(
        watchlist_repo,
        score_repo,
        current_user=current_user,
        auth_enabled=auth_enabled(),
    )


@router.post("/watchlists")
def create_watchlist(
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Create a new watchlist."""

    name = body.get("name")
    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    watchlist_repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)
    owner_user_id = user.id if auth_enabled() else None
    watchlist_repo.create_watchlist(name, owner_user_id=owner_user_id)
    return build_watchlist_payload(
        watchlist_repo,
        score_repo,
        current_user=_serialize_current_user(user) if auth_enabled() else None,
        auth_enabled=auth_enabled(),
    )


@router.post("/watchlists/items")
def manage_watchlist_item(
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Add or remove an item from a watchlist."""

    action = body.get("action")
    watchlist_id = body.get("watchlistId")
    trend_id = body.get("trendId")
    watchlist_repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)
    owner_user_id = user.id if auth_enabled() else None

    if watchlist_id:
        watchlist = watchlist_repo.get_watchlist_for_owner(watchlist_id, owner_user_id)
        if watchlist is None:
            raise HTTPException(status_code=404, detail="Watchlist not found")

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

    return build_watchlist_payload(
        watchlist_repo,
        score_repo,
        current_user=_serialize_current_user(user) if auth_enabled() else None,
        auth_enabled=auth_enabled(),
    )


def _serialize_current_user(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "isAdmin": user.is_admin,
        "createdAt": user.created_at.isoformat(),
    }
