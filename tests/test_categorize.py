"""Tests for topic categorization."""

from __future__ import annotations

import unittest

from app.topics.categorize import categorize_topic, list_categories, DEFAULT_CATEGORY


class CategorizationTests(unittest.TestCase):
    """Verify keyword-based topic categorization."""

    def test_ai_topics_categorized(self) -> None:
        self.assertEqual(categorize_topic("ai agents"), "ai-machine-learning")
        self.assertEqual(categorize_topic("llm fine-tuning"), "ai-machine-learning")
        self.assertEqual(categorize_topic("openai gpt release"), "ai-machine-learning")

    def test_developer_tools_categorized(self) -> None:
        self.assertEqual(categorize_topic("typescript compiler"), "developer-tools")
        self.assertEqual(categorize_topic("new python framework"), "developer-tools")

    def test_fintech_categorized(self) -> None:
        self.assertEqual(categorize_topic("crypto trading platform"), "fintech-crypto")
        self.assertEqual(categorize_topic("bitcoin etf"), "fintech-crypto")

    def test_health_categorized(self) -> None:
        self.assertEqual(categorize_topic("biotech drug discovery"), "health-biotech")
        self.assertEqual(categorize_topic("crispr gene therapy"), "health-biotech")

    def test_energy_categorized(self) -> None:
        self.assertEqual(categorize_topic("battery recycling"), "energy-climate")
        self.assertEqual(categorize_topic("solar panel efficiency"), "energy-climate")

    def test_hardware_categorized(self) -> None:
        self.assertEqual(categorize_topic("robotics manufacturing"), "hardware-robotics")
        self.assertEqual(categorize_topic("quantum processor"), "hardware-robotics")

    def test_science_categorized(self) -> None:
        self.assertEqual(categorize_topic("wikipedia pageviews"), "science-research")

    def test_unknown_falls_back_to_source_heuristic(self) -> None:
        result = categorize_topic("obscure topic xyz", {"github": 3})
        self.assertEqual(result, "developer-tools")

    def test_unknown_without_sources_returns_default(self) -> None:
        result = categorize_topic("obscure topic xyz")
        self.assertEqual(result, DEFAULT_CATEGORY)

    def test_list_categories_includes_default(self) -> None:
        categories = list_categories()
        self.assertIn("ai-machine-learning", categories)
        self.assertIn(DEFAULT_CATEGORY, categories)
        self.assertGreater(len(categories), 10)

    def test_category_not_overly_broad(self) -> None:
        """Common neutral words should not trigger a category match."""
        result = categorize_topic("interesting new thing")
        self.assertEqual(result, DEFAULT_CATEGORY)
