"""Tests for breakout prediction."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone, timedelta

from app.models import TrendHistoryPoint, TrendScoreResult
from app.scoring.predictor import predict_breakouts, BreakoutPrediction


def _make_score(topic: str = "ai agents", total: float = 42.0, sources: int = 3) -> TrendScoreResult:
    source_counts = {f"source_{i}": 2 for i in range(sources)}
    return TrendScoreResult(
        topic=topic,
        total_score=total,
        search_score=total * 0.2,
        social_score=total * 0.3,
        developer_score=total * 0.25,
        knowledge_score=total * 0.15,
        diversity_score=total * 0.1,
        evidence=["Test"],
        source_counts=source_counts,
        latest_timestamp=datetime(2026, 3, 9, tzinfo=timezone.utc),
    )


def _make_history(scores: list[float], start_rank: int = 10) -> list[TrendHistoryPoint]:
    base = datetime(2026, 3, 1, tzinfo=timezone.utc)
    return [
        TrendHistoryPoint(
            captured_at=base + timedelta(hours=i * 12),
            rank=max(1, start_rank - i),
            score_total=s,
        )
        for i, s in enumerate(scores)
    ]


class PredictorTests(unittest.TestCase):
    """Test breakout prediction logic."""

    def test_accelerating_trend_has_high_confidence(self) -> None:
        score = _make_score("ai agents", total=45.0, sources=4)
        history = _make_history([20.0, 28.0, 38.0, 45.0], start_rank=8)
        now = datetime(2026, 3, 9, tzinfo=timezone.utc)

        predictions = predict_breakouts(
            current_scores=[score],
            histories={"ai agents": history},
            current_ranks={"ai agents": 2},
            first_seen={
                "ai agents": datetime(2026, 3, 8, tzinfo=timezone.utc),
            },
            now=now,
        )

        self.assertEqual(len(predictions), 1)
        self.assertGreater(predictions[0].confidence, 0.5)
        self.assertIn(predictions[0].predicted_direction, ("breakout", "rising"))

    def test_stable_trend_has_moderate_confidence(self) -> None:
        score = _make_score("blockchain", total=25.0, sources=2)
        history = _make_history([24.0, 25.0, 25.0, 25.0], start_rank=5)
        now = datetime(2026, 3, 9, tzinfo=timezone.utc)

        predictions = predict_breakouts(
            current_scores=[score],
            histories={"blockchain": history},
            current_ranks={"blockchain": 5},
            first_seen={
                "blockchain": datetime(2026, 2, 1, tzinfo=timezone.utc),
            },
            now=now,
        )

        self.assertEqual(len(predictions), 1)
        self.assertLess(predictions[0].confidence, 0.65)

    def test_declining_trend_has_low_confidence(self) -> None:
        score = _make_score("old tech", total=10.0, sources=1)
        history = _make_history([30.0, 25.0, 18.0, 10.0], start_rank=3)
        now = datetime(2026, 3, 9, tzinfo=timezone.utc)

        predictions = predict_breakouts(
            current_scores=[score],
            histories={"old tech": history},
            current_ranks={"old tech": 15},
            first_seen={
                "old tech": datetime(2026, 1, 1, tzinfo=timezone.utc),
            },
            now=now,
        )

        self.assertEqual(len(predictions), 1)
        self.assertLess(predictions[0].confidence, 0.45)

    def test_no_history_returns_prediction(self) -> None:
        score = _make_score("new topic", total=30.0)
        now = datetime(2026, 3, 9, tzinfo=timezone.utc)

        predictions = predict_breakouts(
            current_scores=[score],
            histories={"new topic": []},
            current_ranks={"new topic": 1},
            first_seen={"new topic": None},
            now=now,
        )

        self.assertEqual(len(predictions), 1)
        self.assertIsInstance(predictions[0], BreakoutPrediction)

    def test_sorted_by_confidence_descending(self) -> None:
        scores = [
            _make_score("low", total=10.0, sources=1),
            _make_score("high", total=50.0, sources=4),
        ]
        now = datetime(2026, 3, 9, tzinfo=timezone.utc)

        predictions = predict_breakouts(
            current_scores=scores,
            histories={
                "low": _make_history([10.0, 10.0], start_rank=20),
                "high": _make_history([30.0, 40.0, 50.0], start_rank=5),
            },
            current_ranks={"low": 20, "high": 1},
            first_seen={
                "low": datetime(2026, 1, 1, tzinfo=timezone.utc),
                "high": datetime(2026, 3, 8, tzinfo=timezone.utc),
            },
            now=now,
        )

        self.assertEqual(len(predictions), 2)
        self.assertGreaterEqual(predictions[0].confidence, predictions[1].confidence)

    def test_signals_populated(self) -> None:
        score = _make_score("ai agents", total=45.0, sources=4)
        history = _make_history([20.0, 30.0, 40.0, 45.0], start_rank=8)
        now = datetime(2026, 3, 9, tzinfo=timezone.utc)

        predictions = predict_breakouts(
            current_scores=[score],
            histories={"ai agents": history},
            current_ranks={"ai agents": 2},
            first_seen={"ai agents": datetime(2026, 3, 8, 12, tzinfo=timezone.utc)},
            now=now,
        )

        self.assertGreater(len(predictions[0].signals), 0)
