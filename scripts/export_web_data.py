"""Export latest and historical trend payloads for the web app."""

from __future__ import annotations

from datetime import datetime, timezone

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.data.database import connect_database, initialize_database
from app.data.repositories import TrendScoreRepository
from app.exports.files import write_export_payloads
from app.exports.serializers import build_latest_trends_payload, build_trend_history_payload
from app.logging import configure_logging

HISTORY_RUN_LIMIT = 10


def main() -> None:
    """Export web-facing JSON payloads from stored trend snapshots."""

    configure_logging()
    settings = load_settings()
    connection = connect_database(settings.database_path)
    initialize_database(connection)
    repository = TrendScoreRepository(connection)
    generated_at = datetime.now(tz=timezone.utc)
    latest_captured_at, latest_scores = repository.list_latest_snapshot(limit=settings.ranking_limit)
    history = repository.list_score_history(
        limit_runs=HISTORY_RUN_LIMIT,
        per_run_limit=settings.ranking_limit,
    )
    connection.close()

    latest_payload = build_latest_trends_payload(
        generated_at=latest_captured_at or generated_at,
        scores=latest_scores,
    )
    history_payload = build_trend_history_payload(generated_at=generated_at, snapshots=history)
    write_export_payloads(settings.web_data_path, latest_payload, history_payload)


if __name__ == "__main__":
    main()
