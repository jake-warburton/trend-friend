"""Pipeline refresh API route."""

from __future__ import annotations

import logging
import threading

from fastapi import APIRouter, Header, HTTPException

from app.api.dependencies import get_settings
from app.config import Settings
from app.jobs.compute_scores import run_trend_pipeline

router = APIRouter(tags=["refresh"])
LOGGER = logging.getLogger(__name__)

_refresh_lock = threading.Lock()


@router.post("/refresh")
def trigger_refresh(
    x_trend_friend_refresh_secret: str | None = Header(default=None, alias="X-Trend-Friend-Refresh-Secret"),
) -> dict:
    """Run the ingestion and scoring pipeline.

    Only one refresh can run at a time. Returns 409 if a refresh is
    already in progress.
    """

    settings = get_settings()
    _verify_refresh_secret(settings, x_trend_friend_refresh_secret)

    if not acquire_refresh_lock():
        raise HTTPException(status_code=409, detail="A refresh is already in progress")

    try:
        ranked_scores = run_trend_pipeline(settings)
        _export_web_data(settings)
        return {
            "ok": True,
            "rankedTrends": len(ranked_scores),
            "topTrend": ranked_scores[0].topic if ranked_scores else None,
        }
    except Exception as error:
        LOGGER.exception("Refresh failed: %s", error)
        raise HTTPException(status_code=500, detail=str(error)) from error
    finally:
        release_refresh_lock()


def acquire_refresh_lock() -> bool:
    """Acquire the global refresh lock without blocking."""

    return _refresh_lock.acquire(blocking=False)


def release_refresh_lock() -> None:
    """Release the global refresh lock when held."""

    if _refresh_lock.locked():
        _refresh_lock.release()


def _verify_refresh_secret(settings: Settings, provided_secret: str | None) -> None:
    """Require the configured refresh secret when present."""

    if not settings.refresh_secret:
        return
    if provided_secret != settings.refresh_secret:
        raise HTTPException(status_code=403, detail="Invalid refresh secret")


def _export_web_data(settings: Settings) -> None:
    """Re-export JSON files for the Next.js frontend (backward compatibility)."""

    from app.exports.web_data import export_web_data_payloads

    export_web_data_payloads(settings)
