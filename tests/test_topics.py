"""Tests for topic normalization and clustering."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.models import NormalizedSignal, RawSourceItem
from app.topics.cluster import aggregate_topic_signals, merge_similar_topics
from app.topics.extract import build_signals_from_items, extract_candidate_topics
from app.topics.geo import (
    GEO_CONFIDENCE_EXPLICIT,
    GEO_CONFIDENCE_INFERRED_BROAD,
    GEO_CONFIDENCE_REINFORCED,
    GEO_CONFIDENCE_INFERRED_REGION,
    GEO_CONFIDENCE_MINIMUM,
    assign_geo_flags,
)
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
            "PostHog/posthog PostHog is an all-in-one developer platform for building successful products.",
            source_name="github",
        )
        self.assertEqual(topics, ["posthog"])
        self.assertEqual(
            extract_candidate_topics("elixir-lang/elixir Elixir is a dynamic, functional language", source_name="github"),
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

    def test_extract_candidate_topics_prefers_domain_phrase_over_discussion_framing(self) -> None:
        self.assertEqual(
            extract_candidate_topics(
                "If a startup asks you to build them a sales strategy during the interview process, walk away immediately"
            )[0],
            "sales strategy",
        )

    def test_extract_candidate_topics_ranks_domain_phrase_ahead_of_earlier_generic_bigram(self) -> None:
        self.assertEqual(
            extract_candidate_topics(
                "Founders discuss pricing models while vertical SaaS analytics adoption accelerates"
            )[:2],
            ["saas analytics", "pricing models"],
        )

    def test_extract_candidate_topics_detects_high_signal_trigrams(self) -> None:
        self.assertEqual(
            extract_candidate_topics("Model Context Protocol servers are proliferating across developer tooling")[0],
            "model context protocol",
        )
        self.assertEqual(
            extract_candidate_topics("Battery energy storage systems are getting cheaper in Europe")[0],
            "battery energy storage",
        )

    def test_extract_candidate_topics_prefers_canonical_trigram_over_weaker_fragments(self) -> None:
        topics = extract_candidate_topics(
            "Retrieval augmented generation pipelines now power more enterprise search products"
        )
        self.assertIn("retrieval augmented generation", topics)
        self.assertNotEqual(topics[0], "enterprise search")

    def test_extract_candidate_topics_uses_tighter_limits_for_hacker_news(self) -> None:
        topics = extract_candidate_topics(
            "Founders discuss pricing models while vertical SaaS analytics adoption accelerates",
            source_name="hacker_news",
        )
        self.assertEqual(topics, ["saas analytics"])

    def test_extract_candidate_topics_prefers_canonical_google_trends_terms_with_less_fanout(self) -> None:
        topics = extract_candidate_topics(
            "Retrieval augmented generation enterprise search",
            source_name="google_trends",
        )
        self.assertEqual(topics, ["retrieval augmented generation", "enterprise search"])

    def test_extract_candidate_topics_skips_unigram_fallback_for_noisy_headline_sources(self) -> None:
        self.assertEqual(
            extract_candidate_topics("Watching people build", source_name="hacker_news"),
            [],
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

    def test_aggregate_topic_signals_preserves_display_name_from_evidence(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        signals = [
            NormalizedSignal(
                "macbook neo",
                "google_trends",
                "search",
                100.0,
                timestamp,
                "MacBook NEO benchmark leak points to a spring release",
            )
        ]
        aggregate = aggregate_topic_signals(signals)[0]
        self.assertEqual(aggregate.display_name, "MacBook NEO")

    def test_aggregate_topic_signals_title_cases_non_acronym_words(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        signals = [
            NormalizedSignal(
                "ai agents",
                "reddit",
                "social",
                100.0,
                timestamp,
                "AI agents are replacing repetitive office workflows",
            )
        ]
        aggregate = aggregate_topic_signals(signals)[0]
        self.assertEqual(aggregate.display_name, "AI Agents")

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

    def test_build_signals_from_items_carries_explicit_geo_flags(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        signals = build_signals_from_items(
            [
                RawSourceItem(
                    source="google_trends",
                    external_id="gt-1",
                    title="AI agents enterprise automation",
                    url="https://example.com",
                    timestamp=timestamp,
                    engagement_score=100.0,
                    metadata={"region": "US"},
                )
            ]
        )
        self.assertEqual(signals[0].geo_country_code, "US")
        self.assertEqual(signals[0].evidence_url, "https://example.com")
        self.assertIn("enterprise", signals[0].audience_flags)
        self.assertIn("b2b", signals[0].market_flags)
        self.assertIn("geo:explicit", signals[0].geo_flags)
        self.assertIn("geo:country:US", signals[0].geo_flags)

    def test_build_signals_from_items_infers_geo_flags_from_title(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        signals = build_signals_from_items(
            [
                RawSourceItem(
                    source="reddit",
                    external_id="r-1",
                    title="AI agents surge in London startups",
                    url="https://example.com",
                    timestamp=timestamp,
                    engagement_score=10.0,
                )
            ]
        )
        self.assertEqual(signals[0].geo_country_code, "GB")
        self.assertIn("founder", signals[0].audience_flags)
        self.assertIn("europe-market", signals[0].market_flags)
        self.assertEqual(signals[0].geo_detection_mode, "inferred")
        self.assertIn("geo:region:London", signals[0].geo_flags)


class GeoQualityControlTests(unittest.TestCase):
    """Geo tagging should be conservative with confidence thresholds."""

    def test_confidence_constants_are_ordered(self) -> None:
        self.assertGreater(GEO_CONFIDENCE_EXPLICIT, GEO_CONFIDENCE_INFERRED_REGION)
        self.assertGreater(GEO_CONFIDENCE_INFERRED_REGION, GEO_CONFIDENCE_INFERRED_BROAD)
        self.assertGreater(GEO_CONFIDENCE_INFERRED_BROAD, GEO_CONFIDENCE_MINIMUM)

    def test_explicit_metadata_gets_high_confidence(self) -> None:
        item = RawSourceItem(
            source="google_trends",
            external_id="gt-1",
            title="AI agents",
            url="https://example.com",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=100.0,
            metadata={"region": "US"},
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.confidence, GEO_CONFIDENCE_EXPLICIT)
        self.assertEqual(result.detection_mode, "explicit")

    def test_inferred_region_gets_medium_confidence(self) -> None:
        item = RawSourceItem(
            source="reddit",
            external_id="r-1",
            title="Tech hiring picks up in London",
            url="https://example.com",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=10.0,
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.confidence, GEO_CONFIDENCE_INFERRED_REGION)
        self.assertEqual(result.detection_mode, "inferred")
        self.assertEqual(result.country_code, "GB")

    def test_inferred_broad_region_gets_lower_confidence(self) -> None:
        item = RawSourceItem(
            source="reddit",
            external_id="r-2",
            title="EV subsidies rise across Europe",
            url="https://example.com",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=10.0,
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.confidence, GEO_CONFIDENCE_INFERRED_BROAD)
        self.assertIsNone(result.country_code)
        self.assertEqual(result.region, "Europe")

    def test_locale_metadata_can_infer_country(self) -> None:
        item = RawSourceItem(
            source="reddit",
            external_id="r-locale",
            title="AI regulation gets tougher",
            url="https://example.com",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=10.0,
            metadata={"locale": "en_GB"},
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.country_code, "GB")
        self.assertEqual(result.confidence, GEO_CONFIDENCE_EXPLICIT)

    def test_url_country_domain_can_infer_country(self) -> None:
        item = RawSourceItem(
            source="reddit",
            external_id="r-domain",
            title="Developers debate chip exports",
            url="https://www.bbc.co.uk/news/technology",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=10.0,
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.country_code, "GB")
        self.assertEqual(result.confidence, GEO_CONFIDENCE_INFERRED_BROAD)

    def test_combined_text_and_url_hints_raise_confidence(self) -> None:
        item = RawSourceItem(
            source="reddit",
            external_id="r-combined",
            title="London AI startup hiring rebounds",
            url="https://www.bbc.co.uk/news/technology",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=10.0,
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.country_code, "GB")
        self.assertEqual(result.confidence, GEO_CONFIDENCE_REINFORCED)

    def test_additional_country_aliases_expand_coverage(self) -> None:
        item = RawSourceItem(
            source="reddit",
            external_id="r-libya",
            title="Solar projects accelerate in Libya",
            url="https://example.com",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=10.0,
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.country_code, "LY")
        self.assertEqual(result.region, "Libya")
        self.assertEqual(result.confidence, GEO_CONFIDENCE_INFERRED_REGION)

    def test_no_geo_for_ambiguous_text(self) -> None:
        """Titles without geo references should return zero confidence."""
        item = RawSourceItem(
            source="hacker_news",
            external_id="hn-1",
            title="Show HN: Build serverless functions with Rust",
            url="https://example.com",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=50.0,
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.confidence, 0.0)
        self.assertIsNone(result.country_code)

    def test_no_false_positive_for_us_substring(self) -> None:
        """'us' should only match as a whole word, not inside 'focus' or 'bus'."""
        item = RawSourceItem(
            source="reddit",
            external_id="r-3",
            title="Focus on what matters: building a bus notification app",
            url="https://example.com",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=10.0,
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.confidence, 0.0)

    def test_no_false_positive_for_uk_substring(self) -> None:
        """'uk' should not match inside 'ukulele'."""
        item = RawSourceItem(
            source="hacker_news",
            external_id="hn-2",
            title="A ukulele tuner written in WebAssembly",
            url="https://example.com",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            engagement_score=20.0,
        )
        result = assign_geo_flags(item)
        self.assertEqual(result.confidence, 0.0)

    def test_all_inferred_confidences_exceed_minimum(self) -> None:
        """Every inferred assignment must clear the minimum threshold."""
        self.assertGreaterEqual(GEO_CONFIDENCE_INFERRED_BROAD, GEO_CONFIDENCE_MINIMUM)
        self.assertGreaterEqual(GEO_CONFIDENCE_INFERRED_REGION, GEO_CONFIDENCE_MINIMUM)


if __name__ == "__main__":
    unittest.main()
