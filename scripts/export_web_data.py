"""Export latest and historical trend payloads for the web app."""

from __future__ import annotations

from datetime import datetime, timezone

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.data.database import connect_database, initialize_database
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
from app.logging import configure_logging

HISTORY_RUN_LIMIT = 10
PIPELINE_RUN_LIMIT = 6


def main() -> None:
    """Export web-facing JSON payloads from stored trend snapshots."""

    configure_logging()
    settings = load_settings()
    connection = connect_database(settings.database_path)
    initialize_database(connection)
    signal_repository = SignalRepository(connection)
    pipeline_run_repository = PipelineRunRepository(connection)
    source_run_repository = SourceIngestionRunRepository(connection)
    repository = TrendScoreRepository(connection)
    generated_at = datetime.now(tz=timezone.utc)
    signals = signal_repository.list_signals()
    pipeline_runs = pipeline_run_repository.list_recent_runs(limit=PIPELINE_RUN_LIMIT)
    source_runs = source_run_repository.list_latest_runs()
    source_run_history = source_run_repository.list_recent_runs(limit_per_source=6)
    latest_captured_at, latest_scores = repository.list_latest_snapshot(limit=settings.ranking_limit)
    history = repository.list_score_history(
        limit_runs=HISTORY_RUN_LIMIT,
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


if __name__ == "__main__":
    main()
