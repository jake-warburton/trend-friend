"""CSV export for trend data."""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from app.exports.contracts import TrendExplorerRecordPayload

CSV_COLUMNS = [
    "rank",
    "name",
    "category",
    "status",
    "volatility",
    "score",
    "social_score",
    "developer_score",
    "knowledge_score",
    "search_score",
    "diversity_score",
    "rank_change",
    "momentum_pct",
    "source_count",
    "signal_count",
    "sources",
    "audience_segments",
    "market_segments",
    "language_segments",
    "forecast_direction",
    "first_seen",
    "latest_signal",
]


def trends_to_csv(trends: list[TrendExplorerRecordPayload]) -> str:
    """Convert explorer trend records to a CSV string."""

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)

    for trend in trends:
        writer.writerow([
            trend.rank,
            trend.name,
            trend.category,
            trend.status,
            trend.volatility,
            trend.score.total,
            trend.score.social,
            trend.score.developer,
            trend.score.knowledge,
            trend.score.search,
            trend.score.diversity,
            trend.rank_change if trend.rank_change is not None else "",
            trend.momentum.percent_delta if trend.momentum.percent_delta is not None else "",
            trend.coverage.source_count,
            trend.coverage.signal_count,
            ",".join(trend.sources),
            _summarize_segments(trend.audience_summary, "audience"),
            _summarize_segments(trend.audience_summary, "market"),
            _summarize_segments(trend.audience_summary, "language"),
            trend.forecast_direction or "",
            trend.first_seen_at or "",
            trend.latest_signal_at,
        ])

    return output.getvalue()


def build_csv_filename() -> str:
    """Build a timestamped CSV filename."""

    date_stamp = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    return f"trend-friend-export-{date_stamp}.csv"


def _summarize_segments(segments: list[object], segment_type: str) -> str:
    labels = [
        str(getattr(segment, "label"))
        for segment in segments
        if getattr(segment, "segment_type", None) == segment_type
    ]
    return ",".join(labels)
