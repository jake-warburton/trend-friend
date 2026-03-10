"""Tests for derived seasonality classification."""

from __future__ import annotations

import unittest

from app.scoring.seasonality import classify_seasonality


class SeasonalityTests(unittest.TestCase):
    """Recurrence classification should stay conservative and deterministic."""

    def test_classify_recurring_topic_from_large_gaps(self) -> None:
        result = classify_seasonality(appearance_count=6, total_runs=12, gaps=[0, 3, 1, 4, 0])

        self.assertEqual(result.tag, "recurring")
        self.assertEqual(result.recurrence_count, 2)
        self.assertGreater(result.confidence, 0.7)

    def test_classify_evergreen_topic_from_dense_presence(self) -> None:
        result = classify_seasonality(appearance_count=9, total_runs=10, gaps=[0, 1, 0, 1, 0, 0, 1, 0])

        self.assertEqual(result.tag, "evergreen")
        self.assertEqual(result.recurrence_count, 0)
        self.assertGreaterEqual(result.avg_gap_runs, 0.0)

    def test_insufficient_history_returns_untagged(self) -> None:
        result = classify_seasonality(appearance_count=4, total_runs=6, gaps=[3, 2])

        self.assertIsNone(result.tag)
        self.assertEqual(result.confidence, 0.0)


if __name__ == "__main__":
    unittest.main()
