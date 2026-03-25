import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTrendChartHistory,
  compressTrendChartHistory,
  determineTrendHistoryGranularity,
} from "@/lib/trend-history";
import type { TrendHistoryPoint, TrendHistoryResponse } from "@/lib/types";

const DETAIL_HISTORY: TrendHistoryPoint[] = [
  {
    capturedAt: "2026-03-12T12:00:00Z",
    rank: 3,
    scoreTotal: 18.2,
  },
  {
    capturedAt: "2026-03-12T13:00:00Z",
    rank: 2,
    scoreTotal: 24.4,
  },
];

const SNAPSHOT_HISTORY: TrendHistoryResponse = {
  generatedAt: "2026-03-12T14:00:00Z",
  snapshots: [
    {
      capturedAt: "2026-03-12T14:00:00Z",
      trends: [
        {
          id: "ai-agents",
          name: "AI Agents",
          rank: 1,
          score: {
            total: 31.7,
            social: 0,
            developer: 0,
            knowledge: 0,
            search: 0,
            advertising: 0,
            diversity: 0,
          },
          sources: [],
          evidence: [],
          latestSignalAt: "2026-03-12T14:00:00Z",
        },
      ],
    },
    {
      capturedAt: "2026-03-12T11:00:00Z",
      trends: [
        {
          id: "ai-agents",
          name: "AI Agents",
          rank: 4,
          score: {
            total: 12.8,
            social: 0,
            developer: 0,
            knowledge: 0,
            search: 0,
            advertising: 0,
            diversity: 0,
          },
          sources: [],
          evidence: [],
          latestSignalAt: "2026-03-12T11:00:00Z",
        },
      ],
    },
  ],
};

test("buildTrendChartHistory merges detail and snapshot history into one chronological series", () => {
  const result = buildTrendChartHistory(
    "ai-agents",
    SNAPSHOT_HISTORY,
    DETAIL_HISTORY,
  );

  assert.deepEqual(
    result.map((point) => point.capturedAt),
    [
      "2026-03-12T11:00:00Z",
      "2026-03-12T12:00:00Z",
      "2026-03-12T13:00:00Z",
      "2026-03-12T14:00:00Z",
    ],
  );
  assert.equal(result[0]?.scoreTotal, 12.8);
  assert.equal(result[3]?.scoreTotal, 31.7);
});

test("buildTrendChartHistory deduplicates overlapping points by timestamp", () => {
  const result = buildTrendChartHistory("ai-agents", SNAPSHOT_HISTORY, [
    ...DETAIL_HISTORY,
    {
      capturedAt: "2026-03-12T14:00:00Z",
      rank: 99,
      scoreTotal: 99,
    },
  ]);

  assert.equal(result.length, 4);
  assert.equal(result[3]?.rank, 1);
  assert.equal(result[3]?.scoreTotal, 31.7);
});

test("buildTrendChartHistory returns the detail history when snapshots do not contain the trend", () => {
  const result = buildTrendChartHistory(
    "missing-trend",
    SNAPSHOT_HISTORY,
    DETAIL_HISTORY,
  );

  assert.deepEqual(result, DETAIL_HISTORY);
});

test("determineTrendHistoryGranularity keeps shorter ranges at daily averages", () => {
  const granularity = determineTrendHistoryGranularity([
    {
      capturedAt: "2026-03-08T08:00:00Z",
      rank: 8,
      scoreTotal: 10,
    },
    {
      capturedAt: "2026-03-08T20:00:00Z",
      rank: 7,
      scoreTotal: 12,
    },
    {
      capturedAt: "2026-03-12T10:00:00Z",
      rank: 2,
      scoreTotal: 30,
    },
  ]);

  assert.equal(granularity, "day");
});

test("compressTrendChartHistory averages all runs within each day, including the latest day", () => {
  const result = compressTrendChartHistory([
    {
      capturedAt: "2026-03-11T08:00:00Z",
      rank: 4,
      scoreTotal: 20,
    },
    {
      capturedAt: "2026-03-11T16:00:00Z",
      rank: 3,
      scoreTotal: 24,
    },
    {
      capturedAt: "2026-03-12T10:00:00Z",
      rank: 2,
      scoreTotal: 30,
    },
    {
      capturedAt: "2026-03-12T18:00:00Z",
      rank: 2,
      scoreTotal: 26,
    },
  ]);

  assert.deepEqual(result, [
    {
      capturedAt: "2026-03-11T00:00:00.000Z",
      rank: 4,
      scoreTotal: 22,
    },
    {
      capturedAt: "2026-03-12T00:00:00.000Z",
      rank: 2,
      scoreTotal: 28,
    },
  ]);
});

test("determineTrendHistoryGranularity chooses weekly buckets once daily buckets would be too dense", () => {
  const history: TrendHistoryPoint[] = [];

  for (let day = 0; day < 120; day += 1) {
    const date = new Date(Date.UTC(2026, 0, 1));
    date.setUTCDate(date.getUTCDate() + day);
    history.push({
      capturedAt: date.toISOString(),
      rank: 10,
      scoreTotal: 20 + day,
    });
  }

  assert.equal(determineTrendHistoryGranularity(history), "week");
});

test("determineTrendHistoryGranularity chooses month and year buckets for very long histories", () => {
  const monthlyHistory: TrendHistoryPoint[] = [];
  for (let day = 0; day < 800; day += 1) {
    const date = new Date(Date.UTC(2020, 0, 1));
    date.setUTCDate(date.getUTCDate() + day);
    monthlyHistory.push({
      capturedAt: date.toISOString(),
      rank: 5,
      scoreTotal: 50,
    });
  }

  const yearlyHistory: TrendHistoryPoint[] = [];
  for (let day = 0; day < 5000; day += 1) {
    const date = new Date(Date.UTC(2010, 0, 1));
    date.setUTCDate(date.getUTCDate() + day);
    yearlyHistory.push({
      capturedAt: date.toISOString(),
      rank: 3,
      scoreTotal: 70,
    });
  }

  assert.equal(determineTrendHistoryGranularity(monthlyHistory), "month");
  assert.equal(determineTrendHistoryGranularity(yearlyHistory), "year");
});

test("compressTrendChartHistory averages scores inside weekly buckets for longer histories", () => {
  const result = compressTrendChartHistory(
    [
      {
        capturedAt: "2026-01-05T12:00:00Z",
        rank: 6,
        scoreTotal: 10,
      },
      {
        capturedAt: "2026-01-06T12:00:00Z",
        rank: 4,
        scoreTotal: 20,
      },
      {
        capturedAt: "2026-01-13T12:00:00Z",
        rank: 2,
        scoreTotal: 40,
      },
      {
        capturedAt: "2026-05-10T12:00:00Z",
        rank: 1,
        scoreTotal: 80,
      },
    ],
    3,
  );

  assert.deepEqual(
    result.map((point) => point.capturedAt),
    [
      "2026-01-05T00:00:00.000Z",
      "2026-01-12T00:00:00.000Z",
      "2026-05-04T00:00:00.000Z",
    ],
  );
  assert.equal(result[0]?.scoreTotal, 15);
  assert.equal(result[0]?.rank, 5);
});
