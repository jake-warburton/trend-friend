"""Read and write exported trend payloads."""

from __future__ import annotations

import json
from pathlib import Path

from app.exports.contracts import (
    AdIntelligencePayload,
    DashboardOverviewPayload,
    LatestTrendsPayload,
    SourceSummaryPayload,
    TrendDetailIndexPayload,
    trend_detail_record_to_dict,
    TrendExplorerPayload,
    TrendHistoryPayload,
)

OVERVIEW_V2_FILENAME = "dashboard-overview.v2.json"
LATEST_TRENDS_FILENAME = "latest-trends.json"
TREND_HISTORY_FILENAME = "trend-history.json"
TREND_EXPLORER_V2_FILENAME = "trend-explorer.v2.json"
TREND_DETAIL_INDEX_V2_FILENAME = "trend-detail-index.v2.json"
TREND_DETAILS_DIRECTORY = "trend-details"
SOURCE_SUMMARY_V2_FILENAME = "source-summary.v2.json"
AD_INTELLIGENCE_FILENAME = "ad-intelligence.json"


def write_export_payloads(
    export_directory: Path,
    latest_payload: LatestTrendsPayload,
    history_payload: TrendHistoryPayload,
    overview_payload: DashboardOverviewPayload | None = None,
    explorer_payload: TrendExplorerPayload | None = None,
    detail_payload: TrendDetailIndexPayload | None = None,
    source_summary_payload: SourceSummaryPayload | None = None,
    ad_intelligence_payload: AdIntelligencePayload | None = None,
) -> None:
    """Write the latest and historical payloads for the web app."""

    export_directory.mkdir(parents=True, exist_ok=True)
    write_json(export_directory / LATEST_TRENDS_FILENAME, latest_payload.to_dict())
    write_json(export_directory / TREND_HISTORY_FILENAME, history_payload.to_dict())
    if overview_payload is not None:
        write_json(export_directory / OVERVIEW_V2_FILENAME, overview_payload.to_dict())
    if explorer_payload is not None:
        write_json(export_directory / TREND_EXPLORER_V2_FILENAME, explorer_payload.to_dict())
    if detail_payload is not None:
        write_json(export_directory / TREND_DETAIL_INDEX_V2_FILENAME, detail_payload.to_dict())
        write_trend_detail_payloads(export_directory, detail_payload)
    if source_summary_payload is not None:
        write_json(export_directory / SOURCE_SUMMARY_V2_FILENAME, source_summary_payload.to_dict())
    if ad_intelligence_payload is not None:
        write_json(export_directory / AD_INTELLIGENCE_FILENAME, ad_intelligence_payload.to_dict())


def write_json(path: Path, payload: dict[str, object]) -> None:
    """Write formatted JSON to disk."""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def build_trend_detail_filename(slug: str) -> str:
    """Return the relative filename for one serialized trend detail payload."""

    return f"{TREND_DETAILS_DIRECTORY}/{slug}.json"


def write_trend_detail_payloads(
    export_directory: Path,
    detail_payload: TrendDetailIndexPayload,
) -> None:
    """Write one JSON file per trend detail record."""

    for trend in detail_payload.trends:
        write_json(
            export_directory / build_trend_detail_filename(trend.id),
            trend_detail_record_to_dict(trend),
        )
