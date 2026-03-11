"""Source health API routes."""

from __future__ import annotations
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db, get_settings
from app.data.connection import DatabaseConnection
from app.data.repositories import (
    SignalRepository,
    SourceIngestionRunRepository,
    TrendScoreRepository,
)
from app.exports.serializers import (
    build_source_summary_payload,
    build_source_summary_records,
)

router = APIRouter(tags=["sources"])


@router.get("/sources")
def list_sources(db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return source health summaries."""

    settings = get_settings()
    signal_repository = SignalRepository(db)
    source_run_repository = SourceIngestionRunRepository(db)
    score_repository = TrendScoreRepository(db)
    latest_captured_at, _ = score_repository.list_latest_snapshot(limit=settings.ranking_limit)
    generated_at = latest_captured_at or datetime.now(tz=timezone.utc)
    detail_records = score_repository.list_trend_detail_records(limit=settings.ranking_limit)
    signals = signal_repository.list_signals()
    source_runs = source_run_repository.list_latest_runs()
    source_run_history = source_run_repository.list_recent_runs(limit_per_source=6)
    records = build_source_summary_records(
        trends=detail_records,
        signals=signals,
        latest_source_runs=source_runs,
        source_run_history=source_run_history,
    )
    payload = build_source_summary_payload(generated_at=generated_at, sources=records)
    return payload.to_dict()


@router.get("/sources/{source_id}")
def get_source_detail(source_id: str, db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return detail data for a single source."""

    settings = get_settings()
    signal_repository = SignalRepository(db)
    source_run_repository = SourceIngestionRunRepository(db)
    score_repository = TrendScoreRepository(db)
    latest_captured_at, _ = score_repository.list_latest_snapshot(limit=settings.ranking_limit)
    generated_at = latest_captured_at or datetime.now(tz=timezone.utc)
    detail_records = score_repository.list_trend_detail_records(limit=settings.ranking_limit)
    signals = signal_repository.list_signals()
    source_runs = source_run_repository.list_latest_runs()
    source_run_history = source_run_repository.list_recent_runs(limit_per_source=6)
    records = build_source_summary_records(
        trends=detail_records,
        signals=signals,
        latest_source_runs=source_runs,
        source_run_history=source_run_history,
    )
    payload = build_source_summary_payload(generated_at=generated_at, sources=records)
    payload_dict = payload.to_dict()
    for source in payload_dict.get("sources", []):
        if source.get("source") == source_id:
            return source
    raise HTTPException(status_code=404, detail="Source not found")
