"""Tests for the ad intelligence pipeline: keyword rotation, merge, 30-day cutoff.

No SerpApi calls are made — everything is mocked/unit-tested.
"""

from __future__ import annotations

import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from app.sources.google_keyword_planner import (
    GoogleKeywordPlannerSourceAdapter,
    _KEYWORDS_PER_RUN,
)
from app.exports.serializers import (
    build_ad_intelligence_payload,
    merge_ad_intelligence_payloads,
)


# ── _pick_keywords_for_run ──────────────────────────────────────


class TestPickKeywordsForRun(unittest.TestCase):
    """Verify keyword selection logic without hitting SerpApi."""

    def test_picks_up_to_limit(self):
        topics = [f"topic-{i}" for i in range(20)]
        result = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(topics)
        self.assertEqual(len(result), _KEYWORDS_PER_RUN)

    def test_returns_empty_when_no_topics(self):
        result = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run([])
        self.assertEqual(result, [])

    def test_skips_already_scraped(self):
        topics = ["AI", "Rust", "Go", "Python", "React", "Vue", "Svelte",
                  "Docker", "K8s", "Terraform", "Ansible", "Jenkins"]
        scraped = {"ai", "rust", "go"}
        result = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            topics, already_scraped=scraped,
        )
        self.assertEqual(len(result), _KEYWORDS_PER_RUN)
        # None of the already-scraped keywords should appear
        for kw in result:
            self.assertNotIn(kw.lower(), scraped)
        # First unseen topic should be first
        self.assertEqual(result[0], "Python")

    def test_skips_case_insensitive(self):
        topics = ["AI", "Machine Learning", "SaaS"]
        scraped = {"ai", "machine learning"}
        result = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            topics, already_scraped=scraped,
        )
        self.assertEqual(result, ["SaaS"])

    def test_fewer_topics_than_limit(self):
        topics = ["AI", "Rust"]
        result = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(topics)
        self.assertEqual(result, ["AI", "Rust"])

    def test_all_scraped_falls_back_to_top(self):
        """When every topic has been scraped, re-scrape the top ones."""
        topics = ["AI", "Rust", "Go", "Python"]
        scraped = {"ai", "rust", "go", "python"}
        result = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            topics, already_scraped=scraped,
        )
        self.assertEqual(result, topics[:_KEYWORDS_PER_RUN])

    def test_exactly_limit_unseen(self):
        topics = [f"t{i}" for i in range(_KEYWORDS_PER_RUN + 3)]
        scraped = {f"t{i}" for i in range(3)}
        result = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            topics, already_scraped=scraped,
        )
        self.assertEqual(len(result), _KEYWORDS_PER_RUN)
        for kw in result:
            self.assertNotIn(kw.lower(), scraped)

    def test_preserves_topic_order(self):
        """Keywords should come out in the same order as the trend ranking."""
        topics = ["Z-trend", "A-trend", "M-trend"]
        result = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(topics)
        self.assertEqual(result, ["Z-trend", "A-trend", "M-trend"])


# ── merge_ad_intelligence_payloads ──────────────────────────────


class TestMergeAdIntelligencePayloads(unittest.TestCase):
    """Verify payload merge logic: accumulation, dedup, scrapedAt stamps."""

    def _make_keyword(self, keyword, density=10, scraped_at="2026-03-01T00:00:00Z"):
        return {
            "keyword": keyword,
            "cpc": 0,
            "searchVolume": 0,
            "competitionLevel": "LOW",
            "adDensity": density,
            "platforms": ["google_keyword_planner"],
            "topAdvertisers": [],
            "trendId": None,
            "scrapedAt": scraped_at,
        }

    def _make_advertiser(self, name, platform, ad_count=1):
        return {
            "name": name,
            "platform": platform,
            "adCount": ad_count,
            "adFormats": ["text"],
            "regions": ["US"],
        }

    def _make_platform(self, platform, ad_count=1, kw=0, adv=0):
        return {
            "platform": platform,
            "adCount": ad_count,
            "keywordCount": kw,
            "advertiserCount": adv,
        }

    def test_new_keywords_are_added(self):
        existing = {
            "generatedAt": "2026-03-01T00:00:00Z",
            "topKeywords": [self._make_keyword("AI")],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        new = {
            "generatedAt": "2026-03-08T00:00:00Z",
            "topKeywords": [self._make_keyword("Rust")],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        merged = merge_ad_intelligence_payloads(existing, new)
        keywords = {kw["keyword"] for kw in merged["topKeywords"]}
        self.assertIn("AI", keywords)
        self.assertIn("Rust", keywords)
        self.assertEqual(len(merged["topKeywords"]), 2)

    def test_duplicate_keyword_uses_newer(self):
        existing = {
            "generatedAt": "2026-03-01T00:00:00Z",
            "topKeywords": [self._make_keyword("AI", density=5, scraped_at="2026-03-01T00:00:00Z")],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        new = {
            "generatedAt": "2026-03-08T00:00:00Z",
            "topKeywords": [self._make_keyword("AI", density=20, scraped_at="2026-03-08T00:00:00Z")],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        merged = merge_ad_intelligence_payloads(existing, new)
        self.assertEqual(len(merged["topKeywords"]), 1)
        self.assertEqual(merged["topKeywords"][0]["adDensity"], 20)
        self.assertEqual(merged["topKeywords"][0]["scrapedAt"], "2026-03-08T00:00:00Z")

    def test_scraped_at_stamped_on_new_keywords(self):
        existing = {
            "generatedAt": "2026-03-01T00:00:00Z",
            "topKeywords": [],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        new = {
            "generatedAt": "2026-03-08T12:00:00Z",
            "topKeywords": [self._make_keyword("AI", scraped_at="")],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        merged = merge_ad_intelligence_payloads(existing, new)
        # scrapedAt should be set to the new payload's generatedAt
        self.assertEqual(merged["topKeywords"][0]["scrapedAt"], "2026-03-08T12:00:00Z")

    def test_existing_keywords_keep_their_scraped_at(self):
        old_kw = self._make_keyword("AI", scraped_at="2026-02-20T00:00:00Z")
        existing = {
            "generatedAt": "2026-02-20T00:00:00Z",
            "topKeywords": [old_kw],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        new = {
            "generatedAt": "2026-03-08T00:00:00Z",
            "topKeywords": [self._make_keyword("Rust")],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        merged = merge_ad_intelligence_payloads(existing, new)
        ai_kw = next(kw for kw in merged["topKeywords"] if kw["keyword"] == "AI")
        self.assertEqual(ai_kw["scrapedAt"], "2026-02-20T00:00:00Z")

    def test_max_keywords_limit(self):
        existing = {
            "generatedAt": "2026-03-01T00:00:00Z",
            "topKeywords": [self._make_keyword(f"old-{i}") for i in range(25)],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        new = {
            "generatedAt": "2026-03-08T00:00:00Z",
            "topKeywords": [self._make_keyword(f"new-{i}") for i in range(10)],
            "topAdvertisers": [],
            "platformSummary": [],
        }
        merged = merge_ad_intelligence_payloads(existing, new, max_keywords=20)
        self.assertLessEqual(len(merged["topKeywords"]), 20)

    def test_advertisers_accumulate(self):
        existing = {
            "generatedAt": "2026-03-01T00:00:00Z",
            "topKeywords": [],
            "topAdvertisers": [self._make_advertiser("Google", "google_ads_transparency", 50)],
            "platformSummary": [],
        }
        new = {
            "generatedAt": "2026-03-08T00:00:00Z",
            "topKeywords": [],
            "topAdvertisers": [
                self._make_advertiser("Google", "google_ads_transparency", 60),
                self._make_advertiser("Meta", "facebook_ad_library", 10),
            ],
            "platformSummary": [],
        }
        merged = merge_ad_intelligence_payloads(existing, new)
        self.assertEqual(len(merged["topAdvertisers"]), 2)
        google = next(a for a in merged["topAdvertisers"] if a["name"] == "Google")
        self.assertEqual(google["adCount"], 60)  # max of old/new

    def test_advertiser_formats_and_regions_union(self):
        existing = {
            "generatedAt": "2026-03-01T00:00:00Z",
            "topKeywords": [],
            "topAdvertisers": [{
                "name": "Acme",
                "platform": "google_ads_transparency",
                "adCount": 5,
                "adFormats": ["text", "image"],
                "regions": ["US"],
            }],
            "platformSummary": [],
        }
        new = {
            "generatedAt": "2026-03-08T00:00:00Z",
            "topKeywords": [],
            "topAdvertisers": [{
                "name": "Acme",
                "platform": "google_ads_transparency",
                "adCount": 8,
                "adFormats": ["video"],
                "regions": ["GB"],
            }],
            "platformSummary": [],
        }
        merged = merge_ad_intelligence_payloads(existing, new)
        acme = merged["topAdvertisers"][0]
        self.assertEqual(sorted(acme["adFormats"]), ["image", "text", "video"])
        self.assertEqual(sorted(acme["regions"]), ["GB", "US"])

    def test_platform_summary_accumulates_ad_count(self):
        existing = {
            "generatedAt": "2026-03-01T00:00:00Z",
            "topKeywords": [],
            "topAdvertisers": [],
            "platformSummary": [self._make_platform("google_keyword_planner", ad_count=4, kw=4)],
        }
        new = {
            "generatedAt": "2026-03-08T00:00:00Z",
            "topKeywords": [],
            "topAdvertisers": [],
            "platformSummary": [self._make_platform("google_keyword_planner", ad_count=8, kw=8)],
        }
        merged = merge_ad_intelligence_payloads(existing, new)
        plat = merged["platformSummary"][0]
        self.assertEqual(plat["adCount"], 12)  # 4 + 8
        self.assertEqual(plat["keywordCount"], 8)  # max

    def test_generated_at_uses_new(self):
        existing = {"generatedAt": "2026-03-01T00:00:00Z", "topKeywords": [], "topAdvertisers": [], "platformSummary": []}
        new = {"generatedAt": "2026-03-08T00:00:00Z", "topKeywords": [], "topAdvertisers": [], "platformSummary": []}
        merged = merge_ad_intelligence_payloads(existing, new)
        self.assertEqual(merged["generatedAt"], "2026-03-08T00:00:00Z")

    def test_empty_existing(self):
        existing = {"generatedAt": "", "topKeywords": [], "topAdvertisers": [], "platformSummary": []}
        new = {
            "generatedAt": "2026-03-08T00:00:00Z",
            "topKeywords": [self._make_keyword("AI")],
            "topAdvertisers": [self._make_advertiser("Google", "google_ads_transparency")],
            "platformSummary": [self._make_platform("google_keyword_planner")],
        }
        merged = merge_ad_intelligence_payloads(existing, new)
        self.assertEqual(len(merged["topKeywords"]), 1)
        self.assertEqual(len(merged["topAdvertisers"]), 1)
        self.assertEqual(len(merged["platformSummary"]), 1)


# ── 30-day cutoff logic ─────────────────────────────────────────


class TestThirtyDayCutoff(unittest.TestCase):
    """Verify that the pipeline correctly identifies keywords scraped <30 days ago."""

    def _simulate_cutoff(self, keywords_with_dates):
        """Simulate the cutoff logic from compute_scores.py."""
        now = datetime.now(tz=timezone.utc)
        cutoff = now - timedelta(days=30)
        already_scraped = set()
        for kw in keywords_with_dates:
            scraped_at = kw.get("scrapedAt", "")
            if scraped_at:
                try:
                    scraped_dt = datetime.fromisoformat(scraped_at.replace("Z", "+00:00"))
                    if scraped_dt > cutoff:
                        already_scraped.add(kw["keyword"].lower())
                except (ValueError, TypeError):
                    pass
        return already_scraped

    def test_recent_keyword_is_excluded(self):
        now = datetime.now(tz=timezone.utc)
        recent = (now - timedelta(days=5)).isoformat()
        keywords = [{"keyword": "AI", "scrapedAt": recent}]
        scraped = self._simulate_cutoff(keywords)
        self.assertIn("ai", scraped)

    def test_old_keyword_is_not_excluded(self):
        now = datetime.now(tz=timezone.utc)
        old = (now - timedelta(days=31)).isoformat()
        keywords = [{"keyword": "AI", "scrapedAt": old}]
        scraped = self._simulate_cutoff(keywords)
        self.assertNotIn("ai", scraped)

    def test_exactly_30_days_is_not_excluded(self):
        now = datetime.now(tz=timezone.utc)
        exactly_30 = (now - timedelta(days=30)).isoformat()
        keywords = [{"keyword": "AI", "scrapedAt": exactly_30}]
        scraped = self._simulate_cutoff(keywords)
        self.assertNotIn("ai", scraped)

    def test_missing_scraped_at_is_not_excluded(self):
        keywords = [{"keyword": "AI"}]
        scraped = self._simulate_cutoff(keywords)
        self.assertNotIn("ai", scraped)

    def test_empty_scraped_at_is_not_excluded(self):
        keywords = [{"keyword": "AI", "scrapedAt": ""}]
        scraped = self._simulate_cutoff(keywords)
        self.assertNotIn("ai", scraped)

    def test_invalid_scraped_at_is_not_excluded(self):
        keywords = [{"keyword": "AI", "scrapedAt": "not-a-date"}]
        scraped = self._simulate_cutoff(keywords)
        self.assertNotIn("ai", scraped)

    def test_mix_of_recent_and_old(self):
        now = datetime.now(tz=timezone.utc)
        keywords = [
            {"keyword": "AI", "scrapedAt": (now - timedelta(days=5)).isoformat()},
            {"keyword": "Rust", "scrapedAt": (now - timedelta(days=35)).isoformat()},
            {"keyword": "Go", "scrapedAt": (now - timedelta(days=15)).isoformat()},
            {"keyword": "Python"},  # no scrapedAt
        ]
        scraped = self._simulate_cutoff(keywords)
        self.assertEqual(scraped, {"ai", "go"})

    def test_z_suffix_timestamp(self):
        now = datetime.now(tz=timezone.utc)
        recent = (now - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        keywords = [{"keyword": "AI", "scrapedAt": recent}]
        scraped = self._simulate_cutoff(keywords)
        self.assertIn("ai", scraped)


# ── End-to-end: pick + cutoff integration ────────────────────────


class TestPickWithCutoffIntegration(unittest.TestCase):
    """Simulate the full daily flow: load existing, compute cutoff, pick batch."""

    def test_day1_scrapes_top_8(self):
        trends = [f"trend-{i}" for i in range(20)]
        already_scraped = set()  # nothing scraped yet
        batch = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            trends, already_scraped,
        )
        self.assertEqual(batch, trends[:8])

    def test_day2_skips_day1_keywords(self):
        trends = [f"trend-{i}" for i in range(20)]
        # Simulate: day 1 scraped trend-0 through trend-7
        already_scraped = {f"trend-{i}" for i in range(8)}
        batch = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            trends, already_scraped,
        )
        self.assertEqual(batch, [f"trend-{i}" for i in range(8, 16)])

    def test_day3_skips_day1_and_day2(self):
        trends = [f"trend-{i}" for i in range(20)]
        already_scraped = {f"trend-{i}" for i in range(16)}
        batch = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            trends, already_scraped,
        )
        # Only 4 unseen left (16-19), so batch is just those 4
        self.assertEqual(batch, [f"trend-{i}" for i in range(16, 20)])

    def test_all_scraped_refreshes_top(self):
        trends = [f"trend-{i}" for i in range(20)]
        already_scraped = {f"trend-{i}" for i in range(20)}
        batch = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            trends, already_scraped,
        )
        # Falls back to top 8
        self.assertEqual(batch, trends[:8])

    def test_trend_ranking_changes_between_runs(self):
        """If trends reorder between runs, we still skip already-scraped ones."""
        # Day 1: trends are A, B, C, D, E, F, G, H, I, J
        day1_trends = list("ABCDEFGHIJ")
        batch1 = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            day1_trends, set(),
        )
        self.assertEqual(batch1, list("ABCDEFGH"))

        # Day 2: ranking shifts — X, Y, Z are new; A dropped out
        scraped = {k.lower() for k in batch1}
        day2_trends = ["X", "B", "Y", "C", "Z", "D", "E", "F", "G", "H", "I", "J"]
        batch2 = GoogleKeywordPlannerSourceAdapter._pick_keywords_for_run(
            day2_trends, scraped,
        )
        # Should pick X, Y, Z (new) plus I, J (unseen from original set)
        self.assertIn("X", batch2)
        self.assertIn("Y", batch2)
        self.assertIn("Z", batch2)
        self.assertIn("I", batch2)
        self.assertIn("J", batch2)
        # Should NOT include B, C, D etc (already scraped)
        for kw in batch2:
            self.assertNotIn(kw.lower(), scraped)


# ── _fetch_keywords mock ────────────────────────────────────────


class TestFetchKeywordsMocked(unittest.TestCase):
    """Verify _fetch_keywords calls SerpApi correctly, without making real calls."""

    def _make_adapter(self, trend_topics, already_scraped=None, serpapi_key="fake-key"):
        settings = MagicMock()
        settings.serpapi_key = serpapi_key
        settings._ad_intel_trend_topics = trend_topics
        settings._ad_intel_already_scraped = already_scraped or set()
        settings.max_items_per_source = 50

        adapter = GoogleKeywordPlannerSourceAdapter.__new__(GoogleKeywordPlannerSourceAdapter)
        adapter.settings = settings
        adapter.raw_item_count = 0
        adapter.kept_item_count = 0
        return adapter

    def test_no_serpapi_key_raises(self):
        adapter = self._make_adapter(["AI"], serpapi_key="")
        with self.assertRaises(RuntimeError) as ctx:
            adapter._fetch_keywords()
        self.assertIn("SERPAPI_KEY", str(ctx.exception))

    def test_no_trends_raises(self):
        adapter = self._make_adapter([])
        with self.assertRaises(RuntimeError) as ctx:
            adapter._fetch_keywords()
        self.assertIn("No trend topics", str(ctx.exception))

    @patch.object(GoogleKeywordPlannerSourceAdapter, "_check_serpapi_budget")
    def test_calls_serpapi_for_each_keyword(self, mock_budget):
        adapter = self._make_adapter(["AI", "Rust", "Go"])
        call_log = []

        def fake_get_json(url, headers=None):
            call_log.append(url)
            return {
                "ads_results": [{"channel": {"name": "TestCo"}, "title": "Ad", "description": "desc", "position_on_page": 1}],
            }

        adapter.get_json = fake_get_json
        items = adapter._fetch_keywords()

        self.assertEqual(len(call_log), 3)
        self.assertEqual(len(items), 3)
        # Verify URLs use YouTube engine
        self.assertIn("engine=youtube", call_log[0])
        self.assertIn("search_query=AI", call_log[0])
        self.assertIn("search_query=Rust", call_log[1])
        self.assertIn("search_query=Go", call_log[2])

    @patch.object(GoogleKeywordPlannerSourceAdapter, "_check_serpapi_budget")
    def test_skips_already_scraped(self, mock_budget):
        adapter = self._make_adapter(
            ["AI", "Rust", "Go", "Python", "React", "Vue", "Svelte", "Docker", "K8s"],
            already_scraped={"ai", "rust", "go"},
        )
        call_log = []

        def fake_get_json(url, headers=None):
            call_log.append(url)
            return {"ads_results": []}

        adapter.get_json = fake_get_json
        items = adapter._fetch_keywords()

        # Should NOT call for AI, Rust, Go
        for url in call_log:
            self.assertNotIn("search_query=AI", url)
            self.assertNotIn("search_query=Rust", url)
            self.assertNotIn("search_query=Go", url)
        # Should call for Python onward
        self.assertIn("search_query=Python", call_log[0])

    @patch.object(GoogleKeywordPlannerSourceAdapter, "_check_serpapi_budget")
    def test_handles_serpapi_failure_gracefully(self, mock_budget):
        adapter = self._make_adapter(["AI", "Rust"])

        def flaky_get_json(url, headers=None):
            if "search_query=AI" in url:
                raise ConnectionError("Network error")
            return {"ads_results": [{"channel": {"name": "Co"}, "title": "x", "position_on_page": 1}]}

        adapter.get_json = flaky_get_json
        items = adapter._fetch_keywords()

        # AI failed, but Rust should still succeed
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].metadata["search_keyword"], "Rust")

    @patch.object(GoogleKeywordPlannerSourceAdapter, "_check_serpapi_budget")
    def test_metadata_shape(self, mock_budget):
        adapter = self._make_adapter(["AI"])

        def fake_get_json(url, headers=None):
            return {
                "ads_results": [
                    {"channel": {"name": "OpenAI"}, "title": "ChatGPT", "description": "AI assistant", "position_on_page": 1},
                    {"channel": {"name": "Google"}, "title": "Gemini", "description": "Google AI", "position_on_page": 4},
                ],
            }

        adapter.get_json = fake_get_json
        items = adapter._fetch_keywords()
        self.assertEqual(len(items), 1)

        meta = items[0].metadata
        self.assertEqual(meta["search_keyword"], "AI")
        self.assertEqual(meta["ad_count"], 2)
        self.assertEqual(meta["youtube_ad_count"], 2)
        self.assertTrue(meta["has_ads"])
        self.assertEqual(meta["competition_level"], "MEDIUM")  # 2 ads = MEDIUM
        self.assertEqual(meta["top_advertisers"], ["OpenAI", "Google"])
        self.assertEqual(len(meta["ad_copies"]), 2)
        self.assertEqual(meta["ad_copies"][0]["advertiser"], "OpenAI")
        self.assertEqual(meta["ad_copies"][0]["platform"], "youtube")

    @patch.object(GoogleKeywordPlannerSourceAdapter, "_check_serpapi_budget")
    def test_competition_levels(self, mock_budget):
        """Verify competition heuristic: 0=NONE, 1=LOW, 2-4=MEDIUM, 5+=HIGH."""
        adapter = self._make_adapter(["a", "b", "c", "d"])

        def make_ads(n):
            return [{"channel": {"name": f"co{i}"}, "title": "x", "position_on_page": i} for i in range(n)]

        responses = {
            "a": {"ads_results": []},
            "b": {"ads_results": make_ads(1)},
            "c": {"ads_results": make_ads(3)},
            "d": {"ads_results": make_ads(6)},
        }

        def fake_get_json(url, headers=None):
            for kw, resp in responses.items():
                if f"search_query={kw}" in url:
                    return resp
            return {"ads_results": []}

        adapter.get_json = fake_get_json
        items = adapter._fetch_keywords()

        levels = {item.metadata["search_keyword"]: item.metadata["competition_level"] for item in items}
        self.assertEqual(levels["a"], "NONE")
        self.assertEqual(levels["b"], "LOW")
        self.assertEqual(levels["c"], "MEDIUM")
        self.assertEqual(levels["d"], "HIGH")


# ── Budget guard ─────────────────────────────────────────────────


class TestBudgetGuard(unittest.TestCase):
    """Verify _check_serpapi_budget prevents calls when budget is low."""

    def _make_adapter(self):
        adapter = GoogleKeywordPlannerSourceAdapter.__new__(GoogleKeywordPlannerSourceAdapter)
        settings = MagicMock()
        settings.serpapi_key = "fake-key"
        adapter.settings = settings
        return adapter

    @patch("urllib.request.urlopen")
    def test_passes_when_budget_sufficient(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({"total_searches_left": 100}).encode()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        adapter = self._make_adapter()
        adapter._check_serpapi_budget(min_remaining=20)  # should not raise

    @patch("urllib.request.urlopen")
    def test_raises_when_budget_too_low(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({"total_searches_left": 5}).encode()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        adapter = self._make_adapter()
        with self.assertRaises(RuntimeError) as ctx:
            adapter._check_serpapi_budget(min_remaining=20)
        self.assertIn("budget too low", str(ctx.exception))
        self.assertIn("5 searches remaining", str(ctx.exception))

    @patch("urllib.request.urlopen")
    def test_proceeds_when_budget_check_network_fails(self, mock_urlopen):
        mock_urlopen.side_effect = ConnectionError("no internet")
        adapter = self._make_adapter()
        # Should NOT raise — just log a warning and proceed
        adapter._check_serpapi_budget(min_remaining=20)


if __name__ == "__main__":
    unittest.main()
