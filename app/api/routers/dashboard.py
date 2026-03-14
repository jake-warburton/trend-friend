"""Dashboard overview API route."""

from __future__ import annotations
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.dependencies import get_db, get_settings
from app.data.connection import DatabaseConnection
from app.data.repositories import (
    PipelineRunRepository,
    SignalRepository,
    SourceIngestionRunRepository,
    TrendScoreRepository,
)
from app.exports.serializers import (
    build_dashboard_overview_payload,
    build_source_summary_records,
)

router = APIRouter(tags=["dashboard"])

PIPELINE_RUN_LIMIT = 6


@router.get("/dashboard/overview")
def get_dashboard_overview(db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return the dashboard landing page payload."""

    settings = get_settings()
    signal_repository = SignalRepository(db)
    pipeline_run_repository = PipelineRunRepository(db)
    source_run_repository = SourceIngestionRunRepository(db)
    score_repository = TrendScoreRepository(db)
    generated_at = datetime.now(tz=timezone.utc)

    signals = signal_repository.list_signals()
    pipeline_runs = pipeline_run_repository.list_recent_runs(limit=PIPELINE_RUN_LIMIT)
    source_runs = source_run_repository.list_latest_runs()
    latest_captured_at, _ = score_repository.list_latest_snapshot(limit=settings.ranking_limit)
    _, experimental_scores = score_repository.list_latest_experimental_snapshot(
        limit=settings.experimental_ranking_limit
    )
    detail_records = score_repository.list_trend_detail_records(limit=settings.ranking_limit)

    payload = build_dashboard_overview_payload(
        generated_at=latest_captured_at or generated_at,
        trends=detail_records,
        experimental_trends=experimental_scores,
        signals=signals,
        source_runs=source_runs,
        pipeline_runs=pipeline_runs,
    )
    return payload.to_dict()
