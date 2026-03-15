"""Tests for the Twitter/X source adapter."""

from __future__ import annotations

import unittest

from app.config import load_settings
from app.sources.twitter import TwitterSourceAdapter
from app.topics.extract import signal_type_for_source


class TwitterAdapterTests(unittest.TestCase):

    def setUp(self) -> None:
        self.settings = load_settings()
        self.adapter = TwitterSourceAdapter(self.settings)

    def test_sample_payload_has_required_fields(self) -> None:
        payload = self.adapter.sample_payload()
        self.assertIn("data", payload)
        tweets = payload["data"]
        self.assertGreater(len(tweets), 0)
        for tweet in tweets:
            self.assertIn("id", tweet)
            self.assertIn("text", tweet)
            self.assertIn("public_metrics", tweet)

    def test_normalize_sample_payload(self) -> None:
        payload = self.adapter.sample_payload()
        items = self.adapter._normalize_sample(payload)
        self.assertEqual(len(items), 3)
        for item in items:
            self.assertEqual(item.source, "twitter")
            self.assertTrue(item.title)
            self.assertTrue(item.url.startswith("https://x.com/"))
            self.assertGreater(item.engagement_score, 0)

    def test_fallback_produces_items(self) -> None:
        """Adapter without DB data falls back to sample data."""
        items = self.adapter.fetch()
        self.assertGreater(len(items), 0)

    def test_signal_type_maps_to_social(self) -> None:
        self.assertEqual(signal_type_for_source("twitter"), "social")

    def test_catalog_reliability_is_0_85(self) -> None:
        from app.sources.catalog import source_reliability_for_source, source_is_experimental
        self.assertAlmostEqual(source_reliability_for_source("twitter"), 0.85)
        self.assertFalse(source_is_experimental("twitter"))
