"""Read and write exported trend payloads."""

from __future__ import annotations

import json
from pathlib import Path

from app.exports.contracts import LatestTrendsPayload, TrendHistoryPayload

LATEST_TRENDS_FILENAME = "latest-trends.json"
TREND_HISTORY_FILENAME = "trend-history.json"


def write_export_payloads(
    export_directory: Path,
    latest_payload: LatestTrendsPayload,
    history_payload: TrendHistoryPayload,
) -> None:
    """Write the latest and historical payloads for the web app."""

    export_directory.mkdir(parents=True, exist_ok=True)
    write_json(export_directory / LATEST_TRENDS_FILENAME, latest_payload.to_dict())
    write_json(export_directory / TREND_HISTORY_FILENAME, history_payload.to_dict())


def write_json(path: Path, payload: dict[str, object]) -> None:
    """Write formatted JSON to disk."""

    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
