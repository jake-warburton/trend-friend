"""Tests for web export payload generation."""

from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from app.exports.files import write_export_payloads
from app.exports.serializers import build_latest_trends_payload, build_trend_history_payload
from app.models import TrendScoreResult


class ExportPayloadTests(unittest.TestCase):
    """Web export payloads should remain stable and JSON-serializable."""

    def setUp(self) -> None:
        self.export_directory = Path("data/test-web-exports")
        if self.export_directory.exists():
            for path in self.export_directory.iterdir():
                path.unlink()
            self.export_directory.rmdir()

    def tearDown(self) -> None:
        if self.export_directory.exists():
            for path in self.export_directory.iterdir():
                path.unlink()
            self.export_directory.rmdir()

    def test_build_latest_trends_payload_uses_api_style_keys(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        score = build_score("ai agents")
        payload = build_latest_trends_payload(generated_at=generated_at, scores=[score]).to_dict()
        self.assertEqual(payload["generatedAt"], "2026-03-09T21:08:16Z")
        self.assertEqual(payload["trends"][0]["id"], "ai-agents")
        self.assertEqual(payload["trends"][0]["name"], "AI Agents")
        self.assertEqual(payload["trends"][0]["latestSignalAt"], "2026-03-08T00:00:00Z")

    def test_write_export_payloads_writes_latest_and_history_files(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        latest_payload = build_latest_trends_payload(generated_at=generated_at, scores=[build_score("ai agents")])
        history_payload = build_trend_history_payload(
            generated_at=generated_at,
            snapshots=[(generated_at, [build_score("battery recycling")])],
        )
        write_export_payloads(self.export_directory, latest_payload, history_payload)
        latest_data = json.loads((self.export_directory / "latest-trends.json").read_text(encoding="utf-8"))
        history_data = json.loads((self.export_directory / "trend-history.json").read_text(encoding="utf-8"))
        self.assertEqual(latest_data["trends"][0]["name"], "AI Agents")
        self.assertEqual(history_data["snapshots"][0]["trends"][0]["name"], "Battery Recycling")


def build_score(topic: str) -> TrendScoreResult:
    """Create a stable score fixture."""

    return TrendScoreResult(
        topic=topic,
        total_score=42.4,
        search_score=0.0,
        social_score=18.2,
        developer_score=16.1,
        knowledge_score=6.4,
        diversity_score=1.7,
        evidence=[f"{topic} evidence"],
        source_counts={"github": 1, "reddit": 1},
        latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
    )
