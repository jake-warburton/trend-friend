"""Tests for CSV export module."""

from __future__ import annotations

import csv
import io
import unittest
from datetime import datetime, timezone

from app.exports.csv_export import CSV_COLUMNS, build_csv_filename, trends_to_csv
from app.exports.serializers import build_trend_explorer_payload
from app.models import (
    TrendAudienceSegment,
    TrendExplorerRecord,
    TrendHistoryPoint,
    TrendMomentum,
    TrendScoreResult,
)


class CsvExportTests(unittest.TestCase):
    """CSV export functions should produce well-formed output."""

    def test_trends_to_csv_includes_header_row(self) -> None:
        csv_text = trends_to_csv([])
        reader = csv.reader(io.StringIO(csv_text))
        header = next(reader)
        self.assertEqual(header, CSV_COLUMNS)

    def test_trends_to_csv_includes_trend_data(self) -> None:
        generated_at = datetime(2026, 3, 10, 12, 0, 0, tzinfo=timezone.utc)
        payload = build_trend_explorer_payload(
            generated_at=generated_at,
            trends=[_build_explorer_record()],
        )
        csv_text = trends_to_csv(payload.trends)
        reader = csv.reader(io.StringIO(csv_text))
        header = next(reader)
        row = next(reader)

        self.assertEqual(header, CSV_COLUMNS)
        self.assertEqual(row[0], "1")  # rank
        self.assertEqual(row[1], "AI Agents")  # name
        self.assertEqual(row[2], "artificial-intelligence")  # category
        self.assertEqual(row[3], "breakout")  # status
        self.assertEqual(row[4], "spiking")  # volatility
        self.assertEqual(row[5], "42.4")  # score total
        self.assertEqual(row[12], "3")  # rank_change
        self.assertEqual(row[13], "40.2")  # momentum_pct
        self.assertEqual(row[14], "2")  # source_count
        self.assertEqual(row[15], "2")  # signal_count
        self.assertIn("reddit", row[16])  # sources
        self.assertEqual(row[17], "developer")
        self.assertEqual(row[18], "b2b")
        self.assertEqual(row[19], "EN")

    def test_trends_to_csv_handles_null_rank_change(self) -> None:
        record = _build_explorer_record()
        record = TrendExplorerRecord(
            id=record.id,
            name=record.name,
            category=record.category,
            meta_trend=record.meta_trend,
            stage=record.stage,
            confidence=record.confidence,
            summary=record.summary,
            status=record.status,
            volatility=record.volatility,
            rank=record.rank,
            previous_rank=None,
            rank_change=None,
            first_seen_at=record.first_seen_at,
            latest_signal_at=record.latest_signal_at,
            score=record.score,
            momentum=TrendMomentum(
                previous_rank=None,
                rank_change=None,
                absolute_delta=None,
                percent_delta=None,
            ),
            source_count=record.source_count,
            signal_count=record.signal_count,
            recent_history=record.recent_history,
        )
        generated_at = datetime(2026, 3, 10, 12, 0, 0, tzinfo=timezone.utc)
        payload = build_trend_explorer_payload(
            generated_at=generated_at,
            trends=[record],
        )
        csv_text = trends_to_csv(payload.trends)
        reader = csv.reader(io.StringIO(csv_text))
        next(reader)  # skip header
        row = next(reader)
        self.assertEqual(row[12], "")  # rank_change should be empty

    def test_trends_to_csv_quotes_sources_with_commas(self) -> None:
        generated_at = datetime(2026, 3, 10, 12, 0, 0, tzinfo=timezone.utc)
        payload = build_trend_explorer_payload(
            generated_at=generated_at,
            trends=[_build_explorer_record()],
        )
        csv_text = trends_to_csv(payload.trends)
        # csv module should properly quote the sources field
        reader = csv.reader(io.StringIO(csv_text))
        next(reader)
        row = next(reader)
        # The sources field should be properly parsed (comma inside quotes)
        self.assertEqual(len(row), len(CSV_COLUMNS))

    def test_empty_trends_produces_header_only(self) -> None:
        csv_text = trends_to_csv([])
        lines = csv_text.strip().split("\n")
        self.assertEqual(len(lines), 1)

    def test_build_csv_filename_contains_date(self) -> None:
        filename = build_csv_filename()
        self.assertTrue(filename.startswith("signal-eye-export-"))
        self.assertTrue(filename.endswith(".csv"))
        # Should contain a date-like pattern
        date_part = filename.replace("signal-eye-export-", "").replace(".csv", "")
        self.assertEqual(len(date_part), 10)  # YYYY-MM-DD


def _build_explorer_record() -> TrendExplorerRecord:
    """Create a test explorer record."""

    return TrendExplorerRecord(
        id="ai-agents",
        name="AI Agents",
        category="artificial-intelligence",
        meta_trend="AI and automation",
        stage="breakout",
        confidence=0.86,
        summary="AI Agents is a breakout artificial intelligence trend validated by 2 signals across 2 sources.",
        status="breakout",
        volatility="spiking",
        rank=1,
        previous_rank=4,
        rank_change=3,
        first_seen_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        latest_signal_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
        score=TrendScoreResult(
            topic="ai agents",
            total_score=42.4,
            search_score=5.0,
            social_score=15.0,
            developer_score=10.0,
            knowledge_score=6.2,
            advertising_score=0.0,
            diversity_score=6.2,
            evidence=["Evidence 1", "Evidence 2"],
            source_counts={"reddit": 1, "github": 1},
            latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
        ),
        momentum=TrendMomentum(
            previous_rank=4,
            rank_change=3,
            absolute_delta=12.3,
            percent_delta=40.2,
        ),
        source_count=2,
        signal_count=2,
        recent_history=[
            TrendHistoryPoint(
                captured_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
                rank=4,
                score_total=31.1,
            ),
        ],
        audience_summary=[
            TrendAudienceSegment(segment_type="audience", label="developer", signal_count=2),
            TrendAudienceSegment(segment_type="market", label="b2b", signal_count=1),
            TrendAudienceSegment(segment_type="language", label="EN", signal_count=2),
        ],
        primary_evidence=None,
    )
