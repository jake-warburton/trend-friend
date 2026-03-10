"""Community features: shared watchlists and public trend pages."""

from __future__ import annotations

import secrets
import sqlite3
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db, get_settings
from app.data.repositories import TrendScoreRepository, WatchlistRepository

router = APIRouter(tags=["community"])


@router.post("/watchlists/{watchlist_id}/share")
def share_watchlist(
    watchlist_id: int,
    body: dict,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    """Create a share link for a watchlist."""

    repo = WatchlistRepository(db)
    watchlist = repo.get_watchlist(watchlist_id)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    is_public = body.get("public", False)
    token = secrets.token_urlsafe(16)
    share = repo.create_share(
        watchlist_id=watchlist_id,
        share_token=token,
        is_public=is_public,
    )

    return {
        "shareToken": share.share_token,
        "public": share.is_public,
        "createdAt": share.created_at.isoformat(),
    }


@router.get("/shared/{share_token}")
def get_shared_watchlist(share_token: str, db: sqlite3.Connection = Depends(get_db)) -> dict:
    """View a shared watchlist by its share token."""

    repo = WatchlistRepository(db)
    share = repo.get_share_by_token(share_token)
    if share is None:
        raise HTTPException(status_code=404, detail="Share link not found")

    watchlist = repo.get_watchlist(share.watchlist_id)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    # Enrich items with current scores
    settings = get_settings()
    score_repo = TrendScoreRepository(db)
    latest_scores = score_repo.list_scores(limit=100)
    score_by_slug = {_slugify(s.topic): s for s in latest_scores}

    return {
        "watchlist": {
            "name": watchlist.name,
            "itemCount": len(watchlist.items),
            "createdAt": _to_utc_iso(watchlist.created_at),
            "items": [
                {
                    "trendId": item.trend_id,
                    "trendName": item.trend_name,
                    "addedAt": _to_utc_iso(item.added_at),
                    "currentScore": round(score_by_slug[item.trend_id].total_score, 1)
                    if item.trend_id in score_by_slug
                    else None,
                }
                for item in watchlist.items
            ],
        },
        "shareToken": share.share_token,
        "public": share.is_public,
    }


@router.get("/community/watchlists")
def list_public_watchlists(db: sqlite3.Connection = Depends(get_db)) -> dict:
    """List all publicly shared watchlists."""

    repo = WatchlistRepository(db)
    public = repo.list_public_watchlists()

    return {
        "watchlists": [
            {
                "name": watchlist.name,
                "itemCount": len(watchlist.items),
                "shareToken": share.share_token,
                "createdAt": _to_utc_iso(watchlist.created_at),
            }
            for watchlist, share in public
        ],
    }


@router.get("/community/trends/{trend_id}")
def get_public_trend_page(trend_id: str, db: sqlite3.Connection = Depends(get_db)) -> dict:
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


def _to_utc_iso(dt: object) -> str:
    from datetime import datetime
    if isinstance(dt, datetime):
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(dt)


def _slugify(topic: str) -> str:
    normalized = "".join(c.lower() if c.isalnum() else "-" for c in topic)
    return "-".join(part for part in normalized.split("-") if part) or "trend"
