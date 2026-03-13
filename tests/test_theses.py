"""Tests for saved thesis matching."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.models import (
    BreakoutPredictionSummary,
    OpportunitySummary,
    TrendAudienceSegment,
    TrendDetailRecord,
    TrendMomentum,
    TrendScoreResult,
    TrendThesis,
)
from app.theses.matching import confidence_bucket_for_value, match_trends_to_theses


def _detail() -> TrendDetailRecord:
    timestamp = datetime(2026, 3, 10, tzinfo=timezone.utc)
    return TrendDetailRecord(
        id="ai-agents",
        name="AI Agents",
        category="ai-machine-learning",
        meta_trend="AI and automation",
        stage="nascent",
        confidence=0.78,
        summary="AI agents are accelerating across developer and search channels.",
        why_now=["Search demand is compounding", "Developers are shipping toolchains"],
        status="breakout",
        volatility="spiking",
        rank=1,
        previous_rank=3,
        rank_change=2,
        first_seen_at=timestamp,
        latest_signal_at=timestamp,
        score=TrendScoreResult(
            topic="ai agents",
            total_score=42.0,
            search_score=12.0,
            social_score=10.0,
            developer_score=12.0,
            knowledge_score=6.0,
            diversity_score=2.0,
            evidence=["AI agents"],
            source_counts={"reddit": 1, "github": 1, "google_trends": 1},
            latest_timestamp=timestamp,
        ),
        momentum=TrendMomentum(previous_rank=3, rank_change=2, absolute_delta=12.0, percent_delta=40.0),
        breakout_prediction=BreakoutPredictionSummary(confidence=0.7, predicted_direction="breakout", signals=["growth"]),
        forecast=None,
        opportunity=OpportunitySummary(
            composite=70.0,
            discovery=75.0,
            seo=68.0,
            content=66.0,
            product=72.0,
            investment=64.0,
            reasoning=["Broad evidence"],
        ),
        source_count=3,
        signal_count=4,
        sources=["google_trends", "github", "reddit"],
        aliases=["Agentic AI"],
        history=[],
        source_breakdown=[],
        source_contributions=[],
        geo_summary=[],
        audience_summary=[
            TrendAudienceSegment(segment_type="audience", label="developer", signal_count=4),
            TrendAudienceSegment(segment_type="market", label="b2b", signal_count=2),
            TrendAudienceSegment(segment_type="language", label="en", signal_count=4),
        ],
        evidence_items=[],
        primary_evidence=None,
        duplicate_candidates=[],
        related_trends=[],
        seasonality=None,
    )


class ThesisMatchingTests(unittest.TestCase):
    def test_matches_across_filters_and_ranks_by_lens(self) -> None:
        thesis = TrendThesis(
            id=1,
            watchlist_id=1,
            name="SEO thesis",
            lens="seo",
            keyword_query="agents",
            source="google_trends",
            category="ai-machine-learning",
            stage="nascent",
            confidence="high",
            meta_trend="AI and automation",
            audience="developer",
            market="b2b",
            language="en",
            geo_country=None,
            minimum_score=20.0,
            hide_recurring=False,
            notify_on_match=True,
            created_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
            updated_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
        )

        matches = match_trends_to_theses([thesis], [_detail()])

        self.assertEqual(matches[1][0].trend_id, "ai-agents")
        self.assertEqual(matches[1][0].lens_score, 68.0)

    def test_confidence_bucket_helper(self) -> None:
        self.assertEqual(confidence_bucket_for_value(0.8), "high")
        self.assertEqual(confidence_bucket_for_value(0.6), "medium")
        self.assertEqual(confidence_bucket_for_value(0.2), "low")


if __name__ == "__main__":
    unittest.main()
