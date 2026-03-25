import type { TrendForecast, TrendHistoryPoint } from "@/lib/types";

const DEFAULT_FORECAST_HORIZON = 5;
const SES_ALPHA = 0.4;
const HOLT_ALPHA = 0.4;
const HOLT_BETA = 0.3;
const MIN_FORECAST_POINTS = 4;
const MIN_HOLT_POINTS = 6;
const MAPE_HIGH_CONFIDENCE_MAX = 10.0;
const MAPE_MEDIUM_CONFIDENCE_MAX = 25.0;

export function forecastTrendFromHistory(
  history: TrendHistoryPoint[],
  horizon: number = DEFAULT_FORECAST_HORIZON,
): TrendForecast | null {
  const orderedHistory = [...history].sort(
    (left, right) =>
      new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime(),
  );

  if (orderedHistory.length < MIN_FORECAST_POINTS) {
    return null;
  }

  const values = orderedHistory.map((point) => point.scoreTotal);
  const method = values.length >= MIN_HOLT_POINTS ? "holt" : "ses";
  const predictedScores = runForecast(method, values, horizon);
  const mape = backtestMape(values, method);

  return {
    predictedScores,
    confidence: mapConfidence(mape),
    mape,
    method,
  };
}

function sesForecast(
  history: number[],
  alpha: number = SES_ALPHA,
  horizon: number = DEFAULT_FORECAST_HORIZON,
): number[] {
  if (history.length === 0) {
    return [];
  }

  let level = history[0];
  for (const value of history.slice(1)) {
    level = alpha * value + (1 - alpha) * level;
  }

  return Array.from({ length: horizon }, () => roundToTwoDecimals(level));
}

function holtForecast(
  history: number[],
  alpha: number = HOLT_ALPHA,
  beta: number = HOLT_BETA,
  horizon: number = DEFAULT_FORECAST_HORIZON,
): number[] {
  if (history.length < 2) {
    return sesForecast(history, alpha, horizon);
  }

  let level = history[0];
  let trend = history[1] - history[0];

  for (const value of history.slice(2)) {
    const previousLevel = level;
    level = alpha * value + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
  }

  return Array.from(
    { length: horizon },
    (_, index) => roundToTwoDecimals(level + (index + 1) * trend),
  );
}

function backtestMape(history: number[], method: string): number {
  if (history.length < MIN_FORECAST_POINTS) {
    return 100.0;
  }

  const absolutePercentageErrors: number[] = [];
  const startIndex = Math.max(1, history.length - 3);

  for (let index = startIndex; index < history.length; index += 1) {
    const trainingHistory = history.slice(0, index);
    const actual = history[index];
    if (trainingHistory.length === 0) {
      continue;
    }

    const predicted = runForecast(method, trainingHistory, 1)[0];
    const denominator = Math.max(Math.abs(actual), 1.0);
    absolutePercentageErrors.push((Math.abs(actual - predicted) / denominator) * 100.0);
  }

  if (absolutePercentageErrors.length === 0) {
    return 100.0;
  }

  const meanError =
    absolutePercentageErrors.reduce((total, value) => total + value, 0) /
    absolutePercentageErrors.length;
  return roundToSingleDecimal(meanError);
}

function runForecast(method: string, history: number[], horizon: number): number[] {
  if (method === "holt") {
    return holtForecast(history, HOLT_ALPHA, HOLT_BETA, horizon);
  }

  return sesForecast(history, SES_ALPHA, horizon);
}

function mapConfidence(mape: number): string {
  if (mape < MAPE_HIGH_CONFIDENCE_MAX) {
    return "high";
  }

  if (mape <= MAPE_MEDIUM_CONFIDENCE_MAX) {
    return "medium";
  }

  return "low";
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
