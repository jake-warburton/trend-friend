"""Tests for the Twitter/X source adapter."""

from __future__ import annotations

import unittest

from app.config import load_settings
from app.sources.twitter import TwitterSourceAdapter
from app.topics.extract import signal_type_for_source


class TwitterAdapterTests(unittest.TestCase):
    """Test the Twitter source adapter."""

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
            self.assertIn("created_at", tweet)
            self.assertIn("public_metrics", tweet)

    def test_normalize_sample_payload(self) -> None:
        payload = self.adapter.sample_payload()
        items = self.adapter._normalize_search(payload)
        self.assertEqual(len(items), 3)
        for item in items:
            self.assertEqual(item.source, "twitter")
            self.assertTrue(item.title)
            self.assertTrue(item.url.startswith("https://x.com/"))
            self.assertGreater(item.engagement_score, 0)

    def test_fallback_produces_items(self) -> None:
        """Adapter without a bearer token falls back to sample data."""
        items = self.adapter.fetch()
        self.assertGreater(len(items), 0)
        self.assertTrue(self.adapter.used_fallback)

    def test_normalize_empty_text_skipped(self) -> None:
        payload = {"data": [{"id": "tw-empty", "text": "", "created_at": "2026-03-09T12:00:00Z"}]}
        items = self.adapter._normalize_search(payload)
        self.assertEqual(len(items), 0)

    def test_engagement_score_calculation(self) -> None:
        payload = {
            "data": [
                {
                    "id": "tw-calc",
                    "text": "Test tweet",
                    "created_at": "2026-03-09T12:00:00Z",
                    "public_metrics": {
                        "like_count": 100,
                        "retweet_count": 50,
                        "reply_count": 10,
                    },
                }
            ]
        }
        items = self.adapter._normalize_search(payload)
        self.assertEqual(len(items), 1)
        # engagement = likes + retweets*2 + replies = 100 + 100 + 10 = 210
        self.assertAlmostEqual(items[0].engagement_score, 210.0)

    def test_signal_type_maps_to_social(self) -> None:
        self.assertEqual(signal_type_for_source("twitter"), "social")
