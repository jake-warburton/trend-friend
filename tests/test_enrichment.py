"""Tests for external market-footprint enrichment."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from pathlib import Path

from app.config import Settings
from app.data.database import connect_database, initialize_database
from app.data.repositories import TrendScoreRepository
from app.enrichment.base import EnrichmentTarget
from app.enrichment.google_search import GoogleSearchMetricsEnricher
from app.enrichment.service import refresh_external_market_metrics
from app.models import TrendScoreResult


class EnrichmentTests(unittest.TestCase):
    """External enrichment should be deterministic and persistable."""

    def setUp(self) -> None:
        self.database_path = Path("data/test_signal_eye_enrichment.db")
        if self.database_path.exists():
            self.database_path.unlink()
        self.connection = connect_database(self.database_path)
        initialize_database(self.connection)
        self.repository = TrendScoreRepository(self.connection)
        self.settings = Settings(
            app_name="Signal Eye",
            database_url=None,
            database_path=self.database_path,
            enable_postgres_runtime=False,
            web_data_path=Path("web/data"),
            request_timeout_seconds=5,
            max_items_per_source=30,
            reddit_page_limit=3,
            hacker_news_page_limit=3,
            github_page_limit=2,
            ranking_limit=100,
            experimental_ranking_limit=12,
            history_run_limit=72,
            market_enrichment_enabled=True,
            market_enrichment_limit=25,
            github_token=None,
            twitter_bearer_token=None,
            youtube_api_key=None,
            google_search_metrics_url=None,
            google_search_metrics_token=None,
            tiktok_metrics_url=None,
            tiktok_metrics_token=None,
            reddit_user_agent="signal-eye-tests/1.0",
            poll_interval_minutes=30,
            health_file_path=Path("data/last_run.json"),
            refresh_secret=None,
        )

    def tearDown(self) -> None:
        self.connection.close()
        if self.database_path.exists():
            self.database_path.unlink()

    def test_google_search_enricher_fallback_is_deterministic(self) -> None:
        enricher = GoogleSearchMetricsEnricher(self.settings)
        target = EnrichmentTarget(topic="chat gpt", name="ChatGPT", aliases=["chat gpt", "chatgpt"])
        captured_at = datetime(2026, 3, 13, tzinfo=timezone.utc)

        metrics = enricher.enrich(target, captured_at)

        self.assertEqual([metric.metric_key for metric in metrics], ["monthly_searches", "search_interest"])
        self.assertTrue(all(metric.is_estimated for metric in metrics))
        self.assertEqual(metrics[0].captured_at, captured_at)
        self.assertEqual(metrics[0].value_display.endswith("/mo"), True)

    def test_refresh_external_market_metrics_upserts_google_youtube_and_tiktok_metrics(self) -> None:
        captured_at = datetime(2026, 3, 13, tzinfo=timezone.utc)
        score = TrendScoreResult(
            topic="chat gpt",
            total_score=42.0,
            search_score=15.0,
            social_score=12.0,
            developer_score=8.0,
            knowledge_score=4.0,
            diversity_score=3.0,
            evidence=["ChatGPT"],
            source_counts={"google_trends": 1, "twitter": 1},
            latest_timestamp=captured_at,
            display_name="ChatGPT",
        )

        self.repository.append_snapshot([score], captured_at=captured_at)
        refresh_external_market_metrics(self.settings, self.repository, [score], captured_at=captured_at)

        metrics = self.repository.get_topic_market_footprint("chat gpt")
        metric_sources = {metric.source for metric in metrics}

        self.assertIn("google_search", metric_sources)
        self.assertIn("youtube", metric_sources)
        self.assertIn("tiktok", metric_sources)
        self.assertTrue(any(metric.metric_key == "monthly_searches" for metric in metrics))
        self.assertTrue(any(metric.metric_key == "video_views" and metric.source == "youtube" for metric in metrics))
        self.assertTrue(any(metric.metric_key == "video_count" and metric.source == "tiktok" for metric in metrics))


if __name__ == "__main__":
    unittest.main()
