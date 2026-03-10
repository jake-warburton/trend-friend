"""Community features: shared watchlists and public trend pages."""

from __future__ import annotations

import secrets
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db, get_settings
from app.data.repositories import TrendScoreRepository, WatchlistRepository
from app.watchlists_payloads import (
    build_public_watchlists_payload,
    build_shared_watchlist_payload,
)

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

    score_repo = TrendScoreRepository(db)
    return build_shared_watchlist_payload(score_repo, share, watchlist)


@router.get("/community/watchlists")
def list_public_watchlists(db: sqlite3.Connection = Depends(get_db)) -> dict:
    """List all publicly shared watchlists."""

    repo = WatchlistRepository(db)
    public = repo.list_public_watchlists()

    return build_public_watchlists_payload(public)


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
