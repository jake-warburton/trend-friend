"""Short-horizon forecasting helpers for trend score histories."""

from __future__ import annotations

from statistics import fmean

from app.models import TrendForecast, TrendHistoryPoint

DEFAULT_FORECAST_HORIZON = 5
SES_ALPHA = 0.4
HOLT_ALPHA = 0.4
HOLT_BETA = 0.3
MIN_FORECAST_POINTS = 4
MIN_HOLT_POINTS = 6
MAPE_HIGH_CONFIDENCE_MAX = 10.0
MAPE_MEDIUM_CONFIDENCE_MAX = 25.0


def ses_forecast(history: list[float], alpha: float = SES_ALPHA, horizon: int = DEFAULT_FORECAST_HORIZON) -> list[float]:
    """Return a simple exponential smoothing projection for oldest-first values."""

    if not history:
        return []

    level = history[0]
    for value in history[1:]:
        level = alpha * value + (1 - alpha) * level
    return [round(level, 2)] * horizon


def holt_forecast(
    history: list[float],
    alpha: float = HOLT_ALPHA,
    beta: float = HOLT_BETA,
    horizon: int = DEFAULT_FORECAST_HORIZON,
) -> list[float]:
    """Return a Holt linear forecast for oldest-first values."""

    if len(history) < 2:
        return ses_forecast(history, alpha=alpha, horizon=horizon)

    level = history[0]
    trend = history[1] - history[0]
    for value in history[2:]:
        previous_level = level
        level = alpha * value + (1 - alpha) * (level + trend)
        trend = beta * (level - previous_level) + (1 - beta) * trend
    return [round(level + (step + 1) * trend, 2) for step in range(horizon)]


def backtest_mape(history: list[float], method: str) -> float:
    """Estimate forecast error by predicting held-out trailing points."""

    if len(history) < MIN_FORECAST_POINTS:
        return 100.0

    absolute_percentage_errors: list[float] = []
    start_index = max(1, len(history) - 3)
    for index in range(start_index, len(history)):
        training_history = history[:index]
        actual = history[index]
        if not training_history:
            continue
        predicted = _run_forecast(method, training_history, horizon=1)[0]
        denominator = max(abs(actual), 1.0)
        absolute_percentage_errors.append(abs(actual - predicted) / denominator * 100.0)

    if not absolute_percentage_errors:
        return 100.0
    return round(fmean(absolute_percentage_errors), 1)


def forecast_trend(
    history: list[TrendHistoryPoint],
    *,
    horizon: int = DEFAULT_FORECAST_HORIZON,
) -> TrendForecast | None:
    """Return a forecast for an oldest-first trend history when enough points exist."""

    ordered_history = sorted(history, key=lambda point: point.captured_at)
    if len(ordered_history) < MIN_FORECAST_POINTS:
        return None

    values = [point.score_total for point in ordered_history]
    method = "holt" if len(values) >= MIN_HOLT_POINTS else "ses"
    predicted_scores = _run_forecast(method, values, horizon=horizon)
    mape = backtest_mape(values, method)
    return TrendForecast(
        predicted_scores=predicted_scores,
        confidence=_map_confidence(mape),
        mape=mape,
        method=method,
    )


def describe_forecast_direction(forecast: TrendForecast | None, current_score: float) -> str | None:
    """Return a compact explorer-facing direction label when confidence is usable."""

    if forecast is None or forecast.confidence == "low" or not forecast.predicted_scores:
        return None

    projected_change = forecast.predicted_scores[-1] - current_score
    if projected_change > 0.1:
        return "accelerating"
    if projected_change < -0.1:
        return "decelerating"
    return "steady"


def _run_forecast(method: str, history: list[float], horizon: int) -> list[float]:
    """Run the configured forecast method."""

    if method == "holt":
        return holt_forecast(history, horizon=horizon)
    return ses_forecast(history, horizon=horizon)


def _map_confidence(mape: float) -> str:
    """Return a conservative confidence label from forecast error."""

    if mape < MAPE_HIGH_CONFIDENCE_MAX:
        return "high"
    if mape <= MAPE_MEDIUM_CONFIDENCE_MAX:
        return "medium"
    return "low"
