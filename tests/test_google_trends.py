"""Tests for the Google Trends source adapter."""

from __future__ import annotations

import unittest

from app.config import load_settings
from app.sources.google_trends import GoogleTrendsSourceAdapter
from app.topics.extract import signal_type_for_source


class GoogleTrendsAdapterTests(unittest.TestCase):
    """Google Trends adapter normalization and fallback tests."""

    def setUp(self) -> None:
        self.settings = load_settings()
        self.adapter = GoogleTrendsSourceAdapter(self.settings)

    def test_normalize_sample_payload(self) -> None:
        """Sample fallback payload normalizes into valid RawSourceItems."""

        items = self.adapter._normalize_trending(self.adapter.sample_payload())
        self.assertEqual(len(items), 3)
        self.assertEqual(items[0].source, "google_trends")
        self.assertEqual(items[0].title, "AI agents enterprise automation")
        self.assertEqual(items[0].engagement_score, 500000)

    def test_fallback_produces_items(self) -> None:
        """Adapter fallback produces non-empty results."""

        items = self.adapter._normalize_trending(self.adapter.sample_payload())
        self.assertGreater(len(items), 0)
        self.assertEqual(self.adapter.source_name, "google_trends")

    def test_signal_type_maps_to_search(self) -> None:
        """Google Trends source maps to 'search' signal type."""

        self.assertEqual(signal_type_for_source("google_trends"), "search")

    def test_sample_payload_has_required_fields(self) -> None:
        """Sample payload entries contain all required fields."""

        for entry in GoogleTrendsSourceAdapter.sample_payload():
            self.assertIn("id", entry)
            self.assertIn("title", entry)
            self.assertIn("url", entry)
            self.assertIn("traffic", entry)

    def test_normalize_empty_title_skipped(self) -> None:
        """Empty titles are skipped during normalization."""

        payload = [{"id": "gt-empty", "title": "", "url": "", "traffic": 0, "region": "US"}]
        items = self.adapter._normalize_trending(payload)
        self.assertEqual(len(items), 0)
