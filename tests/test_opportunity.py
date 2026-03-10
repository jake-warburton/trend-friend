"""Tests for opportunity scoring."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.models import TrendMomentum, TrendScoreResult
from app.scoring.opportunity import score_opportunities, OpportunityScore


def _make_score(
    topic: str = "ai agents",
    total: float = 42.0,
    social: float = 15.0,
    developer: float = 12.0,
    sources: int = 3,
    evidence_count: int = 4,
) -> TrendScoreResult:
    return TrendScoreResult(
        topic=topic,
        total_score=total,
        search_score=total * 0.2,
        social_score=social,
        developer_score=developer,
        knowledge_score=total * 0.15,
        diversity_score=total * 0.1,
        evidence=[f"Evidence {i}" for i in range(evidence_count)],
        source_counts={f"source_{i}": 2 for i in range(sources)},
        latest_timestamp=datetime(2026, 3, 9, tzinfo=timezone.utc),
    )


class OpportunityTests(unittest.TestCase):
    """Test opportunity scoring logic."""

    def test_high_social_trend_has_content_opportunity(self) -> None:
        score = _make_score("viral topic", total=40.0, social=25.0, sources=4, evidence_count=6)
        results = score_opportunities(
            scores=[score],
            ranks={"viral topic": 1},
            momenta={},
            statuses={"viral topic": "breakout"},
        )
        self.assertEqual(len(results), 1)
        self.assertGreater(results[0].content, 0.5)

    def test_high_dev_trend_has_product_opportunity(self) -> None:
        score = _make_score("dev framework", total=45.0, developer=20.0, sources=3)
        results = score_opportunities(
            scores=[score],
            ranks={"dev framework": 2},
            momenta={},
            statuses={"dev framework": "rising"},
        )
        self.assertEqual(len(results), 1)
        self.assertGreater(results[0].product, 0.4)

    def test_growing_trend_has_investment_signal(self) -> None:
        score = _make_score("fast grower", total=35.0, sources=4)
        momentum = TrendMomentum(
            previous_rank=8,
            rank_change=5,
            absolute_delta=10.0,
            percent_delta=40.0,
        )
        results = score_opportunities(
            scores=[score],
            ranks={"fast grower": 3},
            momenta={"fast grower": momentum},
            statuses={"fast grower": "breakout"},
        )
        self.assertEqual(len(results), 1)
        self.assertGreater(results[0].investment, 0.4)

    def test_weak_trend_has_low_composite(self) -> None:
        score = _make_score("niche topic", total=8.0, social=2.0, developer=1.0, sources=1, evidence_count=1)
        results = score_opportunities(
            scores=[score],
            ranks={"niche topic": 20},
            momenta={},
            statuses={"niche topic": "cooling"},
        )
        self.assertEqual(len(results), 1)
        self.assertLess(results[0].composite, 0.4)

    def test_sorted_by_composite_descending(self) -> None:
        scores = [
            _make_score("low", total=10.0, social=2.0, developer=1.0, sources=1),
            _make_score("high", total=50.0, social=20.0, developer=15.0, sources=4),
        ]
        results = score_opportunities(
            scores=scores,
            ranks={"low": 20, "high": 1},
            momenta={},
            statuses={},
        )
        self.assertEqual(len(results), 2)
        self.assertGreaterEqual(results[0].composite, results[1].composite)

    def test_reasoning_populated(self) -> None:
        score = _make_score("ai agents", total=45.0, social=18.0, developer=14.0, sources=4, evidence_count=6)
        results = score_opportunities(
            scores=[score],
            ranks={"ai agents": 1},
            momenta={},
            statuses={"ai agents": "breakout"},
        )
        self.assertGreater(len(results[0].reasoning), 0)

    def test_returns_opportunity_score_type(self) -> None:
        score = _make_score()
        results = score_opportunities(
            scores=[score],
            ranks={"ai agents": 1},
            momenta={},
            statuses={},
        )
        self.assertIsInstance(results[0], OpportunityScore)
        self.assertGreaterEqual(results[0].composite, 0.0)
        self.assertLessEqual(results[0].composite, 1.0)
