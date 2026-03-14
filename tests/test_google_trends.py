"""Tests for the Google Trends source adapter."""

from __future__ import annotations

import unittest

from app.config import load_settings
from app.sources.google_trends import GoogleTrendsSourceAdapter, _REGIONS
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

    def test_parse_rss_sets_geo_metadata(self) -> None:
        """Parsed RSS items carry explicit geo metadata for the region."""

        rss_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss">
          <channel>
            <item>
              <title>Test Trend</title>
              <link>https://example.com</link>
              <pubDate>Tue, 10 Mar 2026 00:00:00 +0000</pubDate>
              <ht:approx_traffic>200,000+</ht:approx_traffic>
            </item>
          </channel>
        </rss>"""
        items = self.adapter._parse_rss(rss_xml, geo="GB", country_code="GB", limit=10)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].geo_country_code, "GB")
        self.assertEqual(items[0].geo_detection_mode, "explicit")
        self.assertAlmostEqual(items[0].geo_confidence, 0.95)
        self.assertEqual(items[0].metadata["region"], "GB")
        self.assertIn("gt-gb-", items[0].external_id)

    def test_parse_traffic_handles_variants(self) -> None:
        """Traffic parser handles comma-separated and plus-suffixed numbers."""

        self.assertEqual(self.adapter._parse_traffic("500,000+"), 500000.0)
        self.assertEqual(self.adapter._parse_traffic("1,000,000"), 1000000.0)
        self.assertEqual(self.adapter._parse_traffic("0"), 0.0)
        self.assertEqual(self.adapter._parse_traffic("invalid"), 0.0)

    def test_fetch_all_regions_uses_expanded_default_region_scope(self) -> None:
        """Default Google Trends breadth should cover more than the original four markets."""

        class TestAdapter(GoogleTrendsSourceAdapter):
            def __init__(self, settings):
                super().__init__(settings)
                self.requested_regions: list[str] = []

            def _fetch_rss(self, geo: str, country_code: str, limit: int):
                self.requested_regions.append(geo)
                return []

        adapter = TestAdapter(self.settings)
        adapter._fetch_all_regions()

        self.assertEqual(adapter.requested_regions, [region[0] for region in _REGIONS])
        self.assertGreater(len(adapter.requested_regions), 8)
        self.assertIn("US", adapter.requested_regions)
        self.assertIn("BR", adapter.requested_regions)
        self.assertIn("KR", adapter.requested_regions)
