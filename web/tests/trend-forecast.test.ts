import assert from "node:assert/strict";
import test from "node:test";

import { forecastTrendFromHistory } from "@/lib/trend-forecast";
import type { TrendHistoryPoint } from "@/lib/types";

const SHORT_HISTORY: TrendHistoryPoint[] = [
  { capturedAt: "2026-03-12T00:00:00.000Z", rank: 5, scoreTotal: 18 },
  { capturedAt: "2026-03-13T00:00:00.000Z", rank: 4, scoreTotal: 22 },
  { capturedAt: "2026-03-14T00:00:00.000Z", rank: 3, scoreTotal: 27 },
];

const SES_HISTORY: TrendHistoryPoint[] = [
  { capturedAt: "2026-03-12T00:00:00.000Z", rank: 5, scoreTotal: 18 },
  { capturedAt: "2026-03-13T00:00:00.000Z", rank: 4, scoreTotal: 22 },
  { capturedAt: "2026-03-14T00:00:00.000Z", rank: 3, scoreTotal: 27 },
  { capturedAt: "2026-03-15T00:00:00.000Z", rank: 2, scoreTotal: 31 },
];

const HOLT_HISTORY: TrendHistoryPoint[] = [
  { capturedAt: "2026-03-12T00:00:00.000Z", rank: 6, scoreTotal: 18 },
  { capturedAt: "2026-03-13T00:00:00.000Z", rank: 5, scoreTotal: 22 },
  { capturedAt: "2026-03-14T00:00:00.000Z", rank: 4, scoreTotal: 27 },
  { capturedAt: "2026-03-15T00:00:00.000Z", rank: 3, scoreTotal: 31 },
  { capturedAt: "2026-03-16T00:00:00.000Z", rank: 2, scoreTotal: 36 },
  { capturedAt: "2026-03-17T00:00:00.000Z", rank: 1, scoreTotal: 42 },
];

test("forecastTrendFromHistory returns null when there are not enough points", () => {
  assert.equal(forecastTrendFromHistory(SHORT_HISTORY), null);
});

test("forecastTrendFromHistory uses SES for short histories", () => {
  const forecast = forecastTrendFromHistory(SES_HISTORY);

  assert.ok(forecast);
  assert.equal(forecast.method, "ses");
  assert.deepEqual(forecast.predictedScores, [25.94, 25.94, 25.94, 25.94, 25.94]);
});

test("forecastTrendFromHistory uses Holt for longer histories", () => {
  const forecast = forecastTrendFromHistory(HOLT_HISTORY);

  assert.ok(forecast);
  assert.equal(forecast.method, "holt");
  assert.deepEqual(forecast.predictedScores, [46.18, 51.48, 56.78, 62.07, 67.37]);
  assert.equal(forecast.confidence, "high");
});
