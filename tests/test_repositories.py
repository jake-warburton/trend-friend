"""Tests for repository persistence behavior."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from pathlib import Path

from app.data.database import connect_database, initialize_database
from app.data.repositories import (
    PipelineRunRepository,
    SignalRepository,
    SourceIngestionRunRepository,
    TrendScoreRepository,
)
from app.models import NormalizedSignal, PipelineRun, SourceIngestionRun, TrendScoreResult


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

    def test_source_ingestion_run_repository_returns_latest_runs_per_source(self) -> None:
        repository = SourceIngestionRunRepository(self.connection)
        repository.append_runs(
            [
                SourceIngestionRun(
                    source="reddit",
                    fetched_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
                    success=True,
                    item_count=10,
                    duration_ms=120,
                ),
                SourceIngestionRun(
                    source="reddit",
                    fetched_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
                    success=False,
                    item_count=0,
                    duration_ms=950,
                    error_message="timeout",
                ),
                SourceIngestionRun(
                    source="github",
                    fetched_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
                    success=True,
                    item_count=4,
                    duration_ms=80,
                    used_fallback=True,
                ),
            ]
        )

        runs = repository.list_latest_runs()

        self.assertEqual(len(runs), 2)
        reddit_run = next(run for run in runs if run.source == "reddit")
        self.assertFalse(reddit_run.success)
        self.assertEqual(reddit_run.error_message, "timeout")
        github_run = next(run for run in runs if run.source == "github")
        self.assertTrue(github_run.used_fallback)
        self.assertEqual(github_run.duration_ms, 80)

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

    def test_pipeline_run_repository_returns_recent_runs(self) -> None:
        repository = PipelineRunRepository(self.connection)
        repository.append_run(
            PipelineRun(
                captured_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
                duration_ms=1800,
                source_count=4,
                successful_source_count=4,
                failed_source_count=0,
                signal_count=40,
                ranked_trend_count=10,
                top_topic="ai agents",
                top_score=41.2,
            )
        )
        repository.append_run(
            PipelineRun(
                captured_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
                duration_ms=2200,
                source_count=4,
                successful_source_count=3,
                failed_source_count=1,
                signal_count=32,
                ranked_trend_count=9,
                top_topic="battery recycling",
                top_score=28.4,
            )
        )

        runs = repository.list_recent_runs(limit=5)

        self.assertEqual(len(runs), 2)
        self.assertEqual(runs[0].captured_at, datetime(2026, 3, 9, tzinfo=timezone.utc))
        self.assertEqual(runs[0].failed_source_count, 1)
        self.assertEqual(runs[1].top_topic, "ai agents")

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

    def test_trend_score_repository_builds_explorer_records_with_movement(self) -> None:
        repository = TrendScoreRepository(self.connection)
        previous_captured_at = datetime(2026, 3, 8, tzinfo=timezone.utc)
        latest_captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)

        repository.append_snapshot(
            [
                build_score(topic="battery recycling", total_score=20.0),
                build_score(topic="ai agents", total_score=10.0),
            ],
            captured_at=previous_captured_at,
        )
        repository.append_snapshot(
            [
                build_score(topic="ai agents", total_score=30.0),
                build_score(topic="battery recycling", total_score=25.0),
            ],
            captured_at=latest_captured_at,
        )

        records = repository.list_trend_explorer_records(limit=5)
        ai_agents = next(record for record in records if record.id == "ai-agents")

        self.assertEqual(ai_agents.rank, 1)
        self.assertEqual(ai_agents.previous_rank, 2)
        self.assertEqual(ai_agents.rank_change, 1)
        self.assertEqual(ai_agents.first_seen_at, previous_captured_at)
        self.assertEqual(ai_agents.momentum.absolute_delta, 20.0)
        self.assertEqual(ai_agents.momentum.percent_delta, 200.0)
        self.assertEqual(ai_agents.source_count, 2)
        self.assertEqual(ai_agents.signal_count, 2)

    def test_trend_score_repository_builds_detail_records_with_signal_breakdown(self) -> None:
        repository = TrendScoreRepository(self.connection)
        signal_repository = SignalRepository(self.connection)
        previous_captured_at = datetime(2026, 3, 8, tzinfo=timezone.utc)
        latest_captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)

        signal_repository.replace_signals(
            [
                NormalizedSignal("ai agents", "reddit", "social", 12.0, latest_captured_at, "Reddit evidence"),
                NormalizedSignal("ai agents", "github", "developer", 9.0, previous_captured_at, "GitHub evidence"),
            ]
        )
        repository.append_snapshot(
            [build_score(topic="ai agents", total_score=10.0)],
            captured_at=previous_captured_at,
        )
        repository.append_snapshot(
            [build_score(topic="ai agents", total_score=30.0)],
            captured_at=latest_captured_at,
        )

        records = repository.list_trend_detail_records(limit=5)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].history[0].captured_at, previous_captured_at)
        self.assertEqual(records[0].source_breakdown[0].source, "github")
        self.assertEqual(records[0].evidence_items[0].evidence, "Reddit evidence")


def build_score(topic: str, total_score: float) -> TrendScoreResult:
    """Create a stable score fixture."""

    return TrendScoreResult(
        topic=topic,
        total_score=total_score,
        search_score=0.0,
        social_score=10.0,
        developer_score=8.0,
        knowledge_score=6.0,
        diversity_score=2.0,
        evidence=[f"{topic} evidence"],
        source_counts={"reddit": 1, "github": 1},
        latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
    )


if __name__ == "__main__":
    unittest.main()
