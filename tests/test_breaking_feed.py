"""Tests for the breaking feed mini-pipeline."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone, timedelta


class BreakingScoreTests(unittest.TestCase):

    def test_basic_score_calculation(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        score = compute_breaking_score(
            tier="high",
            total_engagement=1000.0,
            age_minutes=30.0,
            account_count=1,
        )
        # tier_weight=2.0, log10(1001)~=3.0, recency=1-30/120=0.75, corroboration=1.0
        self.assertGreater(score, 4.0)
        self.assertLess(score, 5.0)

    def test_corroboration_boost(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        single = compute_breaking_score("high", 1000.0, 30.0, 1)
        multi = compute_breaking_score("high", 1000.0, 30.0, 3)
        # corroboration_boost for 3 accounts = 1.0 + 0.5*2 = 2.0
        self.assertAlmostEqual(multi / single, 2.0, places=1)

    def test_corroboration_capped_at_3(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        five = compute_breaking_score("high", 1000.0, 30.0, 5)
        ten = compute_breaking_score("high", 1000.0, 30.0, 10)
        self.assertAlmostEqual(five, ten)

    def test_medium_tier_lower_than_high(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        high = compute_breaking_score("high", 1000.0, 30.0, 1)
        medium = compute_breaking_score("medium", 1000.0, 30.0, 1)
        self.assertAlmostEqual(high / medium, 2.0, places=1)

    def test_recency_clamped_at_minimum(self) -> None:
        from app.jobs.breaking_feed import compute_breaking_score
        old = compute_breaking_score("high", 1000.0, 200.0, 1)
        self.assertGreater(old, 0.0)


class BreakingFeedGroupingTests(unittest.TestCase):

    def test_group_tweets_by_topic(self) -> None:
        from app.jobs.breaking_feed import group_tweets_by_topic
        tweets_with_topics = [
            ({"account_handle": "BBCBreaking", "tweet_id": "1", "text": "Breaking: tariffs", "timestamp": "2026-03-15T10:00:00Z", "engagement": 5000.0, "metadata": '{"tier": "high"}'}, ["tariffs"]),
            ({"account_handle": "CNN", "tweet_id": "2", "text": "New tariffs announced", "timestamp": "2026-03-15T10:05:00Z", "engagement": 3000.0, "metadata": '{"tier": "high"}'}, ["tariffs"]),
            ({"account_handle": "elonmusk", "tweet_id": "3", "text": "SpaceX launch tomorrow", "timestamp": "2026-03-15T10:10:00Z", "engagement": 8000.0, "metadata": '{"tier": "high"}'}, ["spacex"]),
        ]
        groups = group_tweets_by_topic(tweets_with_topics)
        self.assertEqual(len(groups), 2)
        self.assertIn("tariffs", groups)
        self.assertEqual(len(groups["tariffs"]), 2)
        self.assertIn("spacex", groups)
        self.assertEqual(len(groups["spacex"]), 1)
