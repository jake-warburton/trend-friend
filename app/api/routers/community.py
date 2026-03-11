"""Community features: shared watchlists and public trend pages."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db, get_settings
from app.auth.middleware import auth_enabled, require_auth
from app.auth.repository import UserRepository
from app.data.connection import DatabaseConnection
from app.data.repositories import TrendScoreRepository, WatchlistRepository
from app.models import User
from app.watchlists_payloads import (
    build_watchlist_payload,
    build_public_watchlists_payload,
    build_shared_watchlist_payload,
)

router = APIRouter(tags=["community"])


@router.post("/watchlists/{watchlist_id}/share")
def share_watchlist(
    watchlist_id: int,
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Create a share link for a watchlist."""

    repo = WatchlistRepository(db)
    watchlist = repo.get_watchlist_for_owner(watchlist_id, user.id if auth_enabled() else None)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    is_public = body.get("public", False)
    expires_at = _parse_expires_at(body.get("expiresAt"))
    token = secrets.token_urlsafe(16)
    share = repo.create_share(
        watchlist_id=watchlist_id,
        share_token=token,
        created_by=user.id if auth_enabled() else None,
        is_public=is_public,
        show_creator=body.get("showCreator") is True,
        expires_at=expires_at,
        use_watchlist_default_expiry=body.get("useDefaultExpiry") is True,
    )

    return _serialize_share_payload(share)


@router.post("/watchlists/{watchlist_id}/shares/{share_id}/revoke")
def revoke_watchlist_share(
    watchlist_id: int,
    share_id: int,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Revoke an existing share link for a watchlist."""

    repo = WatchlistRepository(db)
    watchlist = repo.get_watchlist_for_owner(watchlist_id, user.id if auth_enabled() else None)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    revoked = repo.revoke_share(share_id, user.id if auth_enabled() else None)
    if not revoked:
        raise HTTPException(status_code=404, detail="Share link not found")

    return {"ok": True}


@router.post("/watchlists/{watchlist_id}/shares/{share_id}/visibility")
def update_watchlist_share_visibility(
    watchlist_id: int,
    share_id: int,
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Update whether a share is listed in the public directory."""

    if "public" not in body or not isinstance(body["public"], bool):
        raise HTTPException(status_code=422, detail="public must be a boolean")

    repo = WatchlistRepository(db)
    watchlist = repo.get_watchlist_for_owner(watchlist_id, user.id if auth_enabled() else None)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    share = repo.update_share_visibility(share_id, user.id if auth_enabled() else None, body["public"])
    if share is None:
        raise HTTPException(status_code=404, detail="Share link not found")

    return _serialize_share_payload(share)


@router.post("/watchlists/{watchlist_id}/shares/{share_id}/attribution")
def update_watchlist_share_attribution(
    watchlist_id: int,
    share_id: int,
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Update whether a share exposes its creator display name."""

    if "showCreator" not in body or not isinstance(body["showCreator"], bool):
        raise HTTPException(status_code=422, detail="showCreator must be a boolean")

    repo = WatchlistRepository(db)
    watchlist = repo.get_watchlist_for_owner(watchlist_id, user.id if auth_enabled() else None)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    share = repo.update_share_creator_visibility(share_id, user.id if auth_enabled() else None, body["showCreator"])
    if share is None:
        raise HTTPException(status_code=404, detail="Share link not found")

    return _serialize_share_payload(share)


@router.post("/watchlists/{watchlist_id}/shares/{share_id}/expiration")
def update_watchlist_share_expiration(
    watchlist_id: int,
    share_id: int,
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Update expiration time for a share."""

    expires_at = _parse_expires_at(body.get("expiresAt"))
    repo = WatchlistRepository(db)
    watchlist = repo.get_watchlist_for_owner(watchlist_id, user.id if auth_enabled() else None)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    share = repo.update_share_expiration(share_id, user.id if auth_enabled() else None, expires_at)
    if share is None:
        raise HTTPException(status_code=404, detail="Share link not found")

    return _serialize_share_payload(share)


@router.post("/watchlists/{watchlist_id}/shares/{share_id}/rotate")
def rotate_watchlist_share(
    watchlist_id: int,
    share_id: int,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Rotate the token for an existing share."""

    repo = WatchlistRepository(db)
    watchlist = repo.get_watchlist_for_owner(watchlist_id, user.id if auth_enabled() else None)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    share = repo.rotate_share_token(
        share_id,
        user.id if auth_enabled() else None,
        secrets.token_urlsafe(16),
    )
    if share is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    return _serialize_share_payload(share)


@router.post("/watchlists/{watchlist_id}/share-defaults")
def update_watchlist_share_defaults(
    watchlist_id: int,
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Persist default share settings for one watchlist."""

    raw_days = body.get("defaultExpiryDays")
    if raw_days is not None and (not isinstance(raw_days, int) or raw_days <= 0):
        raise HTTPException(status_code=422, detail="defaultExpiryDays must be a positive integer or null")

    watchlist_repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)
    owner_user_id = user.id if auth_enabled() else None
    updated_watchlist = watchlist_repo.update_default_share_duration(
        watchlist_id,
        owner_user_id,
        raw_days,
    )
    if updated_watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return build_watchlist_payload(
        watchlist_repo,
        score_repo,
        current_user=_serialize_current_user(user) if auth_enabled() else None,
        auth_enabled=auth_enabled(),
    )


@router.get("/shared/{share_token}")
def get_shared_watchlist(share_token: str, db: DatabaseConnection = Depends(get_db)) -> dict:
    """View a shared watchlist by its share token."""

    repo = WatchlistRepository(db)
    share = repo.get_share_by_token(share_token)
    if share is None:
        direct_row = db.execute(
            "SELECT expires_at FROM watchlist_shares WHERE share_token = ?",
            (share_token,),
        ).fetchone()
        if direct_row is not None and direct_row["expires_at"]:
            expires_at = datetime.fromisoformat(direct_row["expires_at"])
            if expires_at <= datetime.now(expires_at.tzinfo):
                raise HTTPException(status_code=410, detail="Share link has expired")
        raise HTTPException(status_code=404, detail="Share link not found")

    watchlist = repo.get_watchlist(share.watchlist_id)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    share = repo.record_share_access(share.id) or share

    score_repo = TrendScoreRepository(db)
    return build_shared_watchlist_payload(
        score_repo,
        share,
        watchlist,
        owner_display_name=_resolve_owner_display_name(db, share),
    )


@router.get("/community/watchlists")
def list_public_watchlists(db: DatabaseConnection = Depends(get_db)) -> dict:
    """List all publicly shared watchlists."""

    repo = WatchlistRepository(db)
    score_repo = TrendScoreRepository(db)
    public = repo.list_public_watchlists()
    recent_open_counts = {
        share.id: sum(point.access_count for point in repo.list_share_access_history(share.id, days=7))
        for _, share in public
    }
    return build_public_watchlists_payload(
        public,
        score_repo=score_repo,
        owner_display_names=_resolve_owner_display_names(db, [share for _, share in public]),
        recent_open_counts=recent_open_counts,
    )


@router.get("/community/trends/{trend_id}")
def get_public_trend_page(trend_id: str, db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return public trend data for embedding or sharing."""

    settings = get_settings()
    repository = TrendScoreRepository(db)
    detail_records = repository.list_trend_detail_records(limit=settings.ranking_limit)

    for record in detail_records:
        if record.id == trend_id:
            return {
                "trend": {
                    "id": record.id,
                    "name": record.name,
                    "category": record.category,
                    "status": record.status,
                    "rank": record.rank,
                    "score": {
                        "total": record.score.total_score,
                        "social": record.score.social_score,
                        "developer": record.score.developer_score,
                        "knowledge": record.score.knowledge_score,
                        "search": record.score.search_score,
                        "diversity": record.score.diversity_score,
                    },
                    "sources": record.sources,
                    "history": [
                        {
                            "capturedAt": h.captured_at.isoformat(),
                            "rank": h.rank,
                            "scoreTotal": h.score_total,
                        }
                        for h in record.history
                    ],
                    "relatedTrends": [
                        {
                            "id": r.id,
                            "name": r.name,
                            "rank": r.rank,
                            "scoreTotal": r.score_total,
                        }
                        for r in record.related_trends
                    ],
                },
            }

    raise HTTPException(status_code=404, detail="Trend not found")


def _resolve_owner_display_name(db: DatabaseConnection, share) -> str | None:
    if share.created_by is None:
        return None
    user = UserRepository(db).get_user_by_id(share.created_by)
    return user.display_name if user is not None else None


def _resolve_owner_display_names(db: DatabaseConnection, shares: list) -> dict[int, str]:
    repository = UserRepository(db)
    resolved: dict[int, str] = {}
    for share in shares:
        if share.created_by is None:
            continue
        user = repository.get_user_by_id(share.created_by)
        if user is not None:
            resolved[share.id] = user.display_name
    return resolved


def _parse_expires_at(value: object) -> datetime | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise HTTPException(status_code=422, detail="expiresAt must be an ISO timestamp or null")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="expiresAt must be an ISO timestamp or null") from exc
    if parsed <= datetime.now(parsed.tzinfo):
        raise HTTPException(status_code=422, detail="expiresAt must be in the future")
    return parsed


def _to_utc_iso_or_none(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _serialize_share_payload(share) -> dict[str, object]:
    return {
        "id": share.id,
        "shareToken": share.share_token,
        "public": share.is_public,
        "showCreator": share.show_creator,
        "expiresAt": _to_utc_iso_or_none(share.expires_at),
        "createdAt": share.created_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def _serialize_current_user(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "isAdmin": user.is_admin,
        "createdAt": user.created_at.isoformat(),
    }
