import assert from "node:assert/strict";
import test from "node:test";

import { buildAxisLayout, buildTrendScoreChartData } from "@/components/trend-score-chart";
import type { TrendForecast, TrendHistoryPoint } from "@/lib/types";

const DAILY_HISTORY: TrendHistoryPoint[] = [
  {
    capturedAt: "2026-03-07T00:00:00.000Z",
    rank: 4,
    scoreTotal: 20.4,
  },
  {
    capturedAt: "2026-03-08T00:00:00.000Z",
    rank: 1,
    scoreTotal: 42.4,
  },
  {
    capturedAt: "2026-03-09T00:00:00.000Z",
    rank: 1,
    scoreTotal: 47.4,
  },
];

const WEEKLY_HISTORY: TrendHistoryPoint[] = [
  {
    capturedAt: "2026-03-02T00:00:00.000Z",
    rank: 4,
    scoreTotal: 20.4,
  },
  {
    capturedAt: "2026-03-09T00:00:00.000Z",
    rank: 1,
    scoreTotal: 42.4,
  },
];

const MONTHLY_HISTORY: TrendHistoryPoint[] = [
  {
    capturedAt: "2026-01-01T00:00:00.000Z",
    rank: 4,
    scoreTotal: 20.4,
  },
  {
    capturedAt: "2026-02-01T00:00:00.000Z",
    rank: 1,
    scoreTotal: 42.4,
  },
];

const YEARLY_HISTORY: TrendHistoryPoint[] = [
  {
    capturedAt: "2025-01-01T00:00:00.000Z",
    rank: 4,
    scoreTotal: 20.4,
  },
  {
    capturedAt: "2026-01-01T00:00:00.000Z",
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
  const data = buildTrendScoreChartData(DAILY_HISTORY, "day", FORECAST);

  assert.equal(data.length, 6);
  assert.equal(data[0]?.axisLabel, "7 Mar");
  assert.equal(data[1]?.axisLabel, "8 Mar");
  assert.equal(data[0]?.axisValue, "2026-03-07T00:00:00.000Z");
  assert.equal(data[0]?.date, "7 Mar 2026");
  assert.equal(data[0]?.forecast, 20.4);
  assert.equal(data[0]?.isProjected, false);
  assert.equal(data[2]?.score, 47.4);
  assert.equal(data[2]?.forecast, 47.4);
  assert.equal(data[2]?.isProjected, false);
  assert.equal(data[3]?.date, "Run +1");
  assert.equal(data[3]?.axisLabel, "Run +1");
  assert.equal(data[3]?.axisValue, "forecast-1");
  assert.equal(data[3]?.score, null);
  assert.equal(data[3]?.forecast, 47.2);
  assert.equal(data[3]?.isProjected, true);
  assert.equal(data[5]?.forecast, 56.0);
});

test("buildTrendScoreChartData formats weekly, monthly, and yearly buckets for the axis and tooltip", () => {
  const weekly = buildTrendScoreChartData(WEEKLY_HISTORY, "week", null);
  const monthly = buildTrendScoreChartData(MONTHLY_HISTORY, "month", null);
  const yearly = buildTrendScoreChartData(YEARLY_HISTORY, "year", null);

  assert.equal(weekly[0]?.axisLabel, "2 Mar");
  assert.equal(weekly[0]?.date, "2 Mar 2026 to 8 Mar 2026");
  assert.equal(monthly[0]?.axisLabel, "Jan 2026");
  assert.equal(monthly[0]?.date, "Jan 2026");
  assert.equal(yearly[0]?.axisLabel, "2025");
  assert.equal(yearly[0]?.date, "2025");
});

test("buildTrendScoreChartData falls back to history-only data without a forecast", () => {
  const data = buildTrendScoreChartData(DAILY_HISTORY, "day", null);

  assert.equal(data.length, 3);
  assert.equal(data[0]?.forecast, 20.4);
  assert.equal(data[2]?.forecast, 47.4);
});

test("buildAxisLayout rotates dense date labels and adds chart space", () => {
  assert.deepEqual(buildAxisLayout(5), {
    chartHeight: 260,
    bottomMargin: 0,
    axisHeight: 30,
    tickAngle: 0,
    tickTextAnchor: "middle",
    tickMargin: 6,
    minTickGap: 12,
  });

  assert.deepEqual(buildAxisLayout(13), {
    chartHeight: 290,
    bottomMargin: 22,
    axisHeight: 48,
    tickAngle: -35,
    tickTextAnchor: "end",
    tickMargin: 10,
    minTickGap: 4,
  });
});
