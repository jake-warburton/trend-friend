import assert from "node:assert/strict";
import test from "node:test";

import { buildTrendScoreChartData } from "@/components/trend-score-chart";
import type { TrendForecast, TrendHistoryPoint } from "@/lib/types";

const HISTORY: TrendHistoryPoint[] = [
  {
    capturedAt: "2026-03-07T00:00:00Z",
    rank: 4,
    scoreTotal: 20.4,
  },
  {
    capturedAt: "2026-03-08T00:00:00Z",
    rank: 1,
    scoreTotal: 42.4,
  },
];

const FORECAST: TrendForecast = {
  predictedScores: [47.2, 51.6, 56.0],
  confidence: "medium",
  mape: 13.7,
  method: "holt",
};

test("buildTrendScoreChartData appends forecast points after the latest history point", () => {
  const data = buildTrendScoreChartData(HISTORY, FORECAST);

  assert.equal(data.length, 5);
  assert.equal(data[1]?.score, 42.4);
  assert.equal(data[1]?.forecast, 42.4);
  assert.equal(data[2]?.date, "Run +1");
  assert.equal(data[2]?.score, null);
  assert.equal(data[2]?.forecast, 47.2);
  assert.equal(data[4]?.forecast, 56.0);
});

test("buildTrendScoreChartData falls back to history-only data without a forecast", () => {
  const data = buildTrendScoreChartData(HISTORY, null);

  assert.equal(data.length, 2);
  assert.equal(data[0]?.forecast, null);
  assert.equal(data[1]?.forecast, null);
});
