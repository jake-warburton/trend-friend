"""Tests for short-horizon trend forecasting."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from app.models import TrendHistoryPoint
from app.scoring.forecast import (
    backtest_mape,
    describe_forecast_direction,
    forecast_trend,
    holt_forecast,
    ses_forecast,
)


def _make_history(scores: list[float]) -> list[TrendHistoryPoint]:
    base = datetime(2026, 3, 1, tzinfo=timezone.utc)
    return [
        TrendHistoryPoint(
            captured_at=base + timedelta(hours=index * 12),
            rank=max(1, 10 - index),
            score_total=score,
        )
        for index, score in enumerate(scores)
    ]


class ForecastTests(unittest.TestCase):
    """Forecast helpers should stay deterministic and conservative."""

    def test_ses_forecast_matches_expected_projection(self) -> None:
        self.assertEqual(ses_forecast([10.0, 20.0, 30.0, 40.0], alpha=0.4, horizon=3), [28.24, 28.24, 28.24])

    def test_holt_forecast_matches_expected_projection(self) -> None:
        self.assertEqual(holt_forecast([10.0, 15.0, 21.0, 28.0, 36.0, 45.0], horizon=3), [49.5, 56.95, 64.4])

    def test_backtest_mape_is_low_for_smooth_series(self) -> None:
        mape = backtest_mape([10.0, 15.0, 21.0, 28.0, 36.0, 45.0], method="holt")
        self.assertLess(mape, 15.0)

    def test_forecast_trend_returns_none_for_short_history(self) -> None:
        self.assertIsNone(forecast_trend(_make_history([10.0, 12.0, 15.0])))

    def test_forecast_trend_uses_holt_for_longer_histories(self) -> None:
        forecast = forecast_trend(_make_history([10.0, 15.0, 21.0, 28.0, 36.0, 45.0]))
        self.assertIsNotNone(forecast)
        assert forecast is not None
        self.assertEqual(forecast.method, "holt")
        self.assertEqual(len(forecast.predicted_scores), 5)
        self.assertEqual(forecast.confidence, "medium")

    def test_describe_forecast_direction_only_flags_medium_or_high_confidence(self) -> None:
        forecast = forecast_trend(_make_history([10.0, 15.0, 21.0, 28.0, 36.0, 45.0]))
        assert forecast is not None
        self.assertEqual(describe_forecast_direction(forecast, current_score=45.0), "accelerating")

        low_confidence = forecast_trend(_make_history([10.0, 25.0, 11.0, 30.0]))
        assert low_confidence is not None
        self.assertIsNone(describe_forecast_direction(low_confidence, current_score=30.0))


if __name__ == "__main__":
    unittest.main()
