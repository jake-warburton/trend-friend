"""CSV export API routes."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.api.dependencies import get_db, get_settings
from app.data.repositories import TrendScoreRepository
from app.exports.csv_export import build_csv_filename, trends_to_csv
from app.exports.serializers import build_trend_explorer_payload

router = APIRouter(tags=["exports"])


@router.get("/export/trends.csv")
def export_trends_csv(db: sqlite3.Connection = Depends(get_db)) -> Response:
    """Return all ranked trends as a downloadable CSV file."""

    settings = get_settings()
    repository = TrendScoreRepository(db)
    explorer_records = repository.list_trend_explorer_records(limit=settings.ranking_limit)
    latest_captured_at, _ = repository.list_latest_snapshot(limit=settings.ranking_limit)
    generated_at = latest_captured_at or datetime.now(tz=timezone.utc)
    payload = build_trend_explorer_payload(generated_at=generated_at, trends=explorer_records)
    csv_content = trends_to_csv(payload.trends)
    filename = build_csv_filename()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
