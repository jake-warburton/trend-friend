"""Shared web-data export flow."""

from __future__ import annotations

from datetime import datetime, timezone

from app.config import Settings
from app.data.primary import connect_primary_database
from app.data.repositories import (
    PipelineRunRepository,
    SignalRepository,
    SourceIngestionRunRepository,
    TrendScoreRepository,
)
from app.exports.files import write_export_payloads
from app.exports.serializers import (
    build_dashboard_overview_payload,
    build_source_summary_payload,
    build_source_summary_records,
    build_trend_detail_index_payload,
    build_latest_trends_payload,
    build_trend_explorer_payload,
    build_trend_history_payload,
)

PIPELINE_RUN_LIMIT = 6
SOURCE_RUN_HISTORY_LIMIT = 6


def export_web_data_payloads(settings: Settings) -> None:
    """Export web-facing JSON payloads from the configured primary database."""

    connection = connect_primary_database(settings)
    signal_repository = SignalRepository(connection)
    pipeline_run_repository = PipelineRunRepository(connection)
    source_run_repository = SourceIngestionRunRepository(connection)
    repository = TrendScoreRepository(connection)
    generated_at = datetime.now(tz=timezone.utc)
    signals = signal_repository.list_signals()
    pipeline_runs = pipeline_run_repository.list_recent_runs(limit=PIPELINE_RUN_LIMIT)
    source_runs = source_run_repository.list_latest_runs()
    source_run_history = source_run_repository.list_recent_runs(limit_per_source=SOURCE_RUN_HISTORY_LIMIT)
    latest_captured_at, latest_scores = repository.list_latest_snapshot(limit=settings.ranking_limit)
    history = repository.list_score_history(
        limit_runs=settings.history_run_limit,
        per_run_limit=settings.ranking_limit,
    )
    explorer_records = repository.list_trend_explorer_records(limit=settings.ranking_limit)
    detail_records = repository.list_trend_detail_records(limit=settings.ranking_limit)
    connection.close()

    latest_payload = build_latest_trends_payload(
        generated_at=latest_captured_at or generated_at,
        scores=latest_scores,
    )
    history_payload = build_trend_history_payload(generated_at=generated_at, snapshots=history)
    explorer_payload = build_trend_explorer_payload(
        generated_at=latest_captured_at or generated_at,
        trends=explorer_records,
    )
    detail_payload = build_trend_detail_index_payload(
        generated_at=latest_captured_at or generated_at,
        trends=detail_records,
    )
    overview_payload = build_dashboard_overview_payload(
        generated_at=latest_captured_at or generated_at,
        trends=detail_records,
        signals=signals,
        source_runs=source_runs,
        pipeline_runs=pipeline_runs,
    )
    source_summary_payload = build_source_summary_payload(
        generated_at=latest_captured_at or generated_at,
        sources=build_source_summary_records(
            trends=detail_records,
            signals=signals,
            latest_source_runs=source_runs,
            source_run_history=source_run_history,
        ),
    )
    write_export_payloads(
        settings.web_data_path,
        latest_payload,
        history_payload,
        overview_payload,
        explorer_payload,
        detail_payload,
        source_summary_payload,
    )
