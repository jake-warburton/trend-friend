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

    def test_trend_score_repository_stores_history_snapshots(self) -> None:
        repository = TrendScoreRepository(self.connection)
        captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)
        score = TrendScoreResult(
            topic="battery recycling",
            total_score=10.0,
            search_score=0.0,
            social_score=4.0,
            developer_score=3.0,
            knowledge_score=2.0,
            diversity_score=1.0,
            evidence=["Battery recycling"],
            source_counts={"reddit": 1},
            latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
        )
        repository.append_snapshot([score], captured_at=captured_at)
        latest_captured_at, latest_scores = repository.list_latest_snapshot(limit=5)
        history = repository.list_score_history(limit_runs=5, per_run_limit=5)
        self.assertEqual(latest_captured_at, captured_at)
        self.assertEqual(latest_scores, [score])
        self.assertEqual(history, [(captured_at, [score])])


if __name__ == "__main__":
    unittest.main()
