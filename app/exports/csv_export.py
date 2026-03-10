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
    "score",
    "social_score",
    "developer_score",
    "knowledge_score",
    "search_score",
    "diversity_score",
    "rank_change",
    "sources",
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
            trend.score.total,
            trend.score.social,
            trend.score.developer,
            trend.score.knowledge,
            trend.score.search,
            trend.score.diversity,
            trend.rank_change if trend.rank_change is not None else "",
            ",".join(trend.sources),
            trend.first_seen_at or "",
            trend.latest_signal_at,
        ])

    return output.getvalue()


def build_csv_filename() -> str:
    """Build a timestamped CSV filename."""

    date_stamp = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    return f"trend-friend-export-{date_stamp}.csv"
