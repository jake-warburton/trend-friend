"""Tests for pipeline quality diagnostics."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.models import NormalizedSignal, SourceIngestionRun, TopicAggregate, TrendScoreResult
from app.scoring.quality import (
    calculate_pipeline_quality_metrics,
    calculate_source_family_snapshots,
    calculate_source_quality_metrics,
)


class PipelineQualityTests(unittest.TestCase):
    """Quality metrics should explain duplicate pressure and evidence breadth."""

    def test_calculate_pipeline_quality_metrics_tracks_duplicate_pressure(self) -> None:
        timestamp = datetime(2026, 3, 12, tzinfo=timezone.utc)
        signals = [
            NormalizedSignal("ai agents", "reddit", "social", 20.0, timestamp, "AI agents are automating office tasks"),
            NormalizedSignal("ai agent", "github", "developer", 15.0, timestamp, "Open-source AI agent framework"),
            NormalizedSignal("battery recycling", "reddit", "social", 10.0, timestamp, "Battery recycling capacity rises"),
        ]
        aggregates = [
            TopicAggregate(
                topic="ai agents",
                source_counts={"reddit": 1, "github": 1},
                signal_counts={"social": 1, "developer": 1},
                total_signal_value=35.0,
                average_signal_value=17.5,
                latest_timestamp=timestamp,
                evidence=["AI agents are automating office tasks", "Open-source AI agent framework"],
            ),
            TopicAggregate(
                topic="battery recycling",
                source_counts={"reddit": 1},
                signal_counts={"social": 1},
                total_signal_value=10.0,
                average_signal_value=10.0,
                latest_timestamp=timestamp,
                evidence=["Battery recycling capacity rises"],
            ),
        ]
        ranked_scores = [
            TrendScoreResult(
                topic="ai agents",
                total_score=50.0,
                search_score=0.0,
                social_score=20.0,
                developer_score=20.0,
                knowledge_score=0.0,
                advertising_score=0.0,
                diversity_score=10.0,
                evidence=["AI agents are automating office tasks", "Open-source AI agent framework"],
                source_counts={"reddit": 1, "github": 1},
                latest_timestamp=timestamp,
            ),
            TrendScoreResult(
                topic="battery recycling",
                total_score=10.0,
                search_score=0.0,
                social_score=10.0,
                developer_score=0.0,
                knowledge_score=0.0,
                advertising_score=0.0,
                diversity_score=0.0,
                evidence=["Battery recycling capacity rises"],
                source_counts={"reddit": 1},
                latest_timestamp=timestamp,
            ),
        ]

        metrics = calculate_pipeline_quality_metrics(signals, aggregates, ranked_scores)

        self.assertEqual(metrics.raw_topic_count, 3)
        self.assertEqual(metrics.merged_topic_count, 2)
        self.assertEqual(metrics.duplicate_topic_count, 1)
        self.assertEqual(metrics.duplicate_topic_rate, 33.3)
        self.assertEqual(metrics.multi_source_trend_count, 1)
        self.assertEqual(metrics.low_evidence_trend_count, 1)

    def test_calculate_source_quality_metrics_tracks_duplicate_pressure_per_source(self) -> None:
        timestamp = datetime(2026, 3, 12, tzinfo=timezone.utc)
        signals = [
            NormalizedSignal("ai agents", "reddit", "social", 20.0, timestamp, "AI agents are automating office tasks"),
            NormalizedSignal("battery recycling", "reddit", "social", 10.0, timestamp, "Battery recycling capacity rises"),
            NormalizedSignal("battery recycle", "reddit", "social", 8.0, timestamp, "Battery recycling capacity rises"),
            NormalizedSignal("vector database", "github", "developer", 15.0, timestamp, "Vector database benchmark"),
        ]
        aggregates = [
            TopicAggregate(
                topic="ai agents",
                source_counts={"reddit": 1},
                signal_counts={"social": 1},
                total_signal_value=20.0,
                average_signal_value=20.0,
                latest_timestamp=timestamp,
                evidence=["AI agents are automating office tasks"],
            ),
            TopicAggregate(
                topic="battery recycling",
                source_counts={"reddit": 2},
                signal_counts={"social": 2},
                total_signal_value=18.0,
                average_signal_value=9.0,
                latest_timestamp=timestamp,
                evidence=["Battery recycling capacity rises"],
            ),
            TopicAggregate(
                topic="vector database",
                source_counts={"github": 1},
                signal_counts={"developer": 1},
                total_signal_value=15.0,
                average_signal_value=15.0,
                latest_timestamp=timestamp,
                evidence=["Vector database benchmark"],
            ),
        ]

        metrics = calculate_source_quality_metrics(signals, aggregates)

        self.assertEqual(metrics["reddit"].raw_topic_count, 3)
        self.assertEqual(metrics["reddit"].merged_topic_count, 2)
        self.assertEqual(metrics["reddit"].duplicate_topic_count, 1)

    def test_calculate_source_family_snapshots_tracks_family_impact(self) -> None:
        timestamp = datetime(2026, 3, 12, tzinfo=timezone.utc)
        snapshots = calculate_source_family_snapshots(
            captured_at=timestamp,
            signals=[
                NormalizedSignal("ai agents", "reddit", "social", 20.0, timestamp, "AI agents on Reddit"),
                NormalizedSignal("ai agents", "github", "developer", 15.0, timestamp, "AI agents on GitHub"),
                NormalizedSignal("browser copilots", "chrome_web_store", "distribution", 10.0, timestamp, "Browser copilots"),
            ],
            source_runs=[
                SourceIngestionRun(
                    source="reddit",
                    fetched_at=timestamp,
                    success=True,
                    raw_item_count=20,
                    item_count=10,
                    kept_item_count=8,
                    duration_ms=120,
                ),
                SourceIngestionRun(
                    source="github",
                    fetched_at=timestamp,
                    success=True,
                    raw_item_count=12,
                    item_count=6,
                    kept_item_count=6,
                    duration_ms=90,
                ),
                SourceIngestionRun(
                    source="chrome_web_store",
                    fetched_at=timestamp,
                    success=False,
                    raw_item_count=8,
                    item_count=0,
                    kept_item_count=0,
                    duration_ms=220,
                    error_message="timeout",
                ),
            ],
            ranked_scores=[
                TrendScoreResult(
                    topic="ai agents",
                    total_score=42.0,
                    search_score=0.0,
                    social_score=20.0,
                    developer_score=18.0,
                    knowledge_score=0.0,
                    advertising_score=0.0,
                    diversity_score=4.0,
                    evidence=["AI agents on Reddit", "AI agents on GitHub"],
                    source_counts={"reddit": 1, "github": 1},
                    latest_timestamp=timestamp,
                ),
                TrendScoreResult(
                    topic="browser copilots",
                    total_score=18.0,
                    search_score=0.0,
                    social_score=0.0,
                    developer_score=0.0,
                    knowledge_score=0.0,
                    advertising_score=0.0,
                    diversity_score=0.0,
                    evidence=["Browser copilots"],
                    source_counts={"chrome_web_store": 1},
                    latest_timestamp=timestamp,
                ),
            ],
        )

        snapshot_by_family = {snapshot.family: snapshot for snapshot in snapshots}
        self.assertEqual(snapshot_by_family["community"].trend_count, 1)
        self.assertEqual(snapshot_by_family["community"].corroborated_trend_count, 1)
        self.assertEqual(snapshot_by_family["developer"].top_ranked_trend_count, 1)
        self.assertEqual(snapshot_by_family["launch"].healthy_source_count, 0)
        self.assertEqual(snapshot_by_family["launch"].success_rate_percent, 0.0)


if __name__ == "__main__":
    unittest.main()
