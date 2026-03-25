"""Trend API routes."""

from __future__ import annotations
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db, get_settings
from app.data.connection import DatabaseConnection
from app.data.repositories import SignalRepository, TrendScoreRepository
from app.exports.serializers import (
    build_latest_trends_payload,
    build_trend_detail_index_payload,
    build_trend_explorer_payload,
    build_trend_history_payload,
)

router = APIRouter(tags=["trends"])


@router.get("/trends")
def list_trends(db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return the explorer list of trends."""

    settings = get_settings()
    repository = TrendScoreRepository(db)
    latest_captured_at, _ = repository.list_latest_snapshot(limit=settings.ranking_limit)
    generated_at = latest_captured_at or datetime.now(tz=timezone.utc)
    explorer_records = repository.list_trend_explorer_records(limit=settings.ranking_limit)
    payload = build_trend_explorer_payload(generated_at=generated_at, trends=explorer_records)
    return payload.to_dict()


@router.get("/trends/latest")
def list_latest_trends(db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return the simple ranked trend list."""

    settings = get_settings()
    repository = TrendScoreRepository(db)
    latest_captured_at, latest_scores = repository.list_latest_snapshot(limit=settings.ranking_limit)
    generated_at = latest_captured_at or datetime.now(tz=timezone.utc)
    payload = build_latest_trends_payload(generated_at=generated_at, scores=latest_scores)
    return payload.to_dict()


@router.get("/trends/history")
def list_trend_history(db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return historical trend snapshots."""

    settings = get_settings()
    repository = TrendScoreRepository(db)
    generated_at = datetime.now(tz=timezone.utc)
    history = repository.list_score_history(
        limit_runs=settings.history_run_limit,
        per_run_limit=settings.ranking_limit,
    )
    payload = build_trend_history_payload(generated_at=generated_at, snapshots=history)
    return payload.to_dict()


@router.get("/trends/{slug}")
def get_trend_detail(slug: str, db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return detail data for a single trend."""

    settings = get_settings()
    repository = TrendScoreRepository(db)
    latest_captured_at, _ = repository.list_latest_snapshot(limit=settings.ranking_limit)
    generated_at = latest_captured_at or datetime.now(tz=timezone.utc)
    detail_records = repository.list_trend_detail_records(limit=settings.ranking_limit)
    payload = build_trend_detail_index_payload(generated_at=generated_at, trends=detail_records)
    payload_dict = payload.to_dict()
    for trend in payload_dict.get("trends", []):
        if trend.get("id") == slug:
            return trend
    raise HTTPException(status_code=404, detail="Trend not found")
