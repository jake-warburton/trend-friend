"""Tests for repository persistence behavior."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from pathlib import Path

from app.data.database import connect_database, initialize_database
from app.data.repositories import SignalRepository, TrendScoreRepository
from app.models import NormalizedSignal, TrendScoreResult


class RepositoryTests(unittest.TestCase):
    """SQLite repositories should round-trip the shared models."""

    def setUp(self) -> None:
        self.database_path = Path("data/test_trend_friend.db")
        if self.database_path.exists():
            self.database_path.unlink()
        self.connection = connect_database(self.database_path)
        initialize_database(self.connection)

    def tearDown(self) -> None:
        self.connection.close()
        if self.database_path.exists():
            self.database_path.unlink()

    def test_signal_repository_round_trip(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        signals = [
            NormalizedSignal("ai agents", "reddit", "social", 42.0, timestamp, "AI agents"),
            NormalizedSignal("battery recycling", "wikipedia", "knowledge", 55.0, timestamp, "Battery recycling"),
        ]
        repository = SignalRepository(self.connection)
        repository.replace_signals(signals)
        stored_signals = repository.list_signals()
        self.assertEqual(stored_signals, signals)

    def test_trend_score_repository_round_trip(self) -> None:
        score = TrendScoreResult(
            topic="ai agents",
            total_score=44.2,
            search_score=0.0,
            social_score=20.0,
            developer_score=12.0,
            knowledge_score=8.2,
            diversity_score=4.0,
            evidence=["AI agents"],
            source_counts={"reddit": 1, "github": 1},
            latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
        )
        repository = TrendScoreRepository(self.connection)
        repository.replace_scores([score])
        stored_scores = repository.list_scores(limit=5)
        self.assertEqual(stored_scores, [score])


if __name__ == "__main__":
    unittest.main()
