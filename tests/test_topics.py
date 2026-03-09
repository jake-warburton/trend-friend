"""Tests for topic normalization and clustering."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.models import NormalizedSignal
from app.topics.cluster import aggregate_topic_signals, merge_similar_topics
from app.topics.extract import extract_candidate_topics
from app.topics.normalize import normalize_topic_name


class TopicNormalizationTests(unittest.TestCase):
    """Topic pipeline behavior should remain deterministic."""

    def test_normalize_topic_name_merges_ai_aliases(self) -> None:
        self.assertEqual(normalize_topic_name("AI"), "ai agents")
        self.assertEqual(normalize_topic_name("artificial intelligence"), "ai agents")

    def test_extract_candidate_topics_filters_noise(self) -> None:
        topics = extract_candidate_topics("AI agents are replacing repetitive office workflows")
        self.assertEqual(topics, ["ai agents"])

    def test_extract_candidate_topics_limits_single_headline_fan_out(self) -> None:
        topics = extract_candidate_topics(
            "Workers report watching Ray Ban Meta shot footage of people using the bathroom"
        )
        self.assertLessEqual(len(topics), 3)

    def test_merge_similar_topics_groups_aliases(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        signals = [
            NormalizedSignal("AI", "reddit", "social", 10.0, timestamp, "AI"),
            NormalizedSignal("artificial intelligence", "github", "developer", 20.0, timestamp, "AI"),
        ]
        clusters = merge_similar_topics(signals)
        self.assertEqual(list(clusters), ["ai agents"])
        self.assertEqual(len(clusters["ai agents"]), 2)

    def test_aggregate_topic_signals_preserves_counts_and_evidence(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        signals = [
            NormalizedSignal("battery recycling", "reddit", "social", 50.0, timestamp, "Battery recycling"),
            NormalizedSignal("battery recycling", "wikipedia", "knowledge", 100.0, timestamp, "Battery recycling"),
        ]
        aggregate = aggregate_topic_signals(signals)[0]
        self.assertEqual(aggregate.topic, "battery recycling")
        self.assertEqual(aggregate.source_counts, {"reddit": 1, "wikipedia": 1})
        self.assertEqual(aggregate.signal_counts, {"social": 1, "knowledge": 1})


if __name__ == "__main__":
    unittest.main()
