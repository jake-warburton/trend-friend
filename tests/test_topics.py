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

    def test_extract_candidate_topics_prefers_repository_topic_for_github_titles(self) -> None:
        topics = extract_candidate_topics(
            "PostHog/posthog PostHog is an all-in-one developer platform for building successful products."
        )
        self.assertEqual(topics, ["posthog"])
        self.assertEqual(
            extract_candidate_topics("elixir-lang/elixir Elixir is a dynamic, functional language"),
            ["elixir"],
        )

    def test_extract_candidate_topics_skips_low_signal_leading_bigrams(self) -> None:
        topics = extract_candidate_topics(
            "Ireland shuts last coal plant, becomes 15th coal-free country in Europe (2025)"
        )
        self.assertEqual(topics[0], "coal plant")

    def test_extract_candidate_topics_skips_numeric_and_wrapper_bigrams(self) -> None:
        self.assertEqual(extract_candidate_topics("2026 Iran war"), ["iran war"])
        self.assertEqual(extract_candidate_topics("List of Muppets"), ["muppets"])
        self.assertEqual(extract_candidate_topics("Men's T20 World Cup")[0], "world cup")

    def test_extract_candidate_topics_finds_stronger_trailing_phrase_in_question_titles(self) -> None:
        topics = extract_candidate_topics(
            "Is legal the same as legitimate: AI reimplementation and the erosion of copyleft"
        )
        self.assertIn("ai reimplementation", topics)
        self.assertIn("copyleft erosion", topics)

    def test_extract_candidate_topics_skips_weak_headline_leads(self) -> None:
        self.assertEqual(
            extract_candidate_topics("OpenAI is walking away from expanding its Stargate data center with Oracle")[
                :2
            ],
            ["stargate data", "data center"],
        )
        self.assertEqual(extract_candidate_topics("Show HN: Remotely use my guitar tuner"), ["guitar tuner"])
        self.assertEqual(
            extract_candidate_topics("Launch HN: Terminal Use (YC W26) – Vercel for filesystem-based agents"),
            ["vercel filesystem"],
        )
        self.assertEqual(extract_candidate_topics("JSLinux Now Supports x86_64"), ["jslinux"])
        self.assertEqual(extract_candidate_topics("Two Years of Emacs Solo")[0], "emacs solo")
        self.assertEqual(
            extract_candidate_topics(
                "Redox OS has adopted a Certificate of Origin policy and a strict no-LLM policy"
            )[0],
            "certificate origin",
        )
        self.assertEqual(
            extract_candidate_topics("Show HN: I Was Here – Draw on street view, others can find your drawings")[0],
            "street view",
        )
        self.assertEqual(extract_candidate_topics("Getting Started in Common Lisp")[0], "common lisp")
        self.assertEqual(
            extract_candidate_topics("Graphing how the 10k* most common English words define each other")[0],
            "english words",
        )

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

    def test_aggregate_topic_signals_merges_overlapping_same_headline_variants(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        signals = [
            NormalizedSignal(
                "coal plant",
                "hacker_news",
                "social",
                100.0,
                timestamp,
                "Ireland shuts last coal plant, becomes 15th coal-free country in Europe (2025)",
            ),
            NormalizedSignal(
                "coal free",
                "hacker_news",
                "social",
                100.0,
                timestamp,
                "Ireland shuts last coal plant, becomes 15th coal-free country in Europe (2025)",
            ),
        ]
        aggregates = aggregate_topic_signals(signals)
        self.assertEqual(len(aggregates), 1)
        self.assertEqual(aggregates[0].topic, "coal plant")
        self.assertEqual(aggregates[0].signal_counts, {"social": 2})


if __name__ == "__main__":
    unittest.main()
