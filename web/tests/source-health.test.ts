import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSourceFamilyInsights,
  buildSourceFamilyHistoryInsights,
  buildSourceContributionInsights,
  buildSourceWatchlist,
  getSourceFreshnessBadge,
  summarizeTopSourceDrivers,
} from "@/lib/source-health";

test("buildSourceWatchlist prioritizes failed and fallback sources", () => {
  const items = buildSourceWatchlist([
    {
      source: "reddit",
      family: "community",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 80,
      rawItemCount: 30,
    },
    {
      source: "github",
      family: "developer",
      status: "degraded",
      usedFallback: true,
      errorMessage: null,
      yieldRatePercent: 100,
      rawItemCount: 10,
    },
    {
      source: "hacker_news",
      family: "community",
      status: "stale",
      usedFallback: false,
      errorMessage: "timeout",
      yieldRatePercent: 0,
      rawItemCount: 0,
    },
  ]);

  assert.deepEqual(
    items.map((item) => [item.source, item.severity, item.detail]),
    [
      ["hacker_news", "critical", "Latest run failed"],
      ["github", "warning", "Latest run used fallback data"],
    ],
  );
});

test("buildSourceContributionInsights merges source health with contribution detail", () => {
  const items = buildSourceContributionInsights(
    [
      {
        source: "github",
        signalCount: 8,
        latestSignalAt: "2026-03-11T21:00:00Z",
        estimatedScore: 9.2,
        scoreSharePercent: 46.2,
        score: { total: 9.2, social: 0, developer: 7.8, knowledge: 0, search: 1.4, diversity: 0 },
      },
      {
        source: "reddit",
        signalCount: 5,
        latestSignalAt: "2026-03-11T20:55:00Z",
        estimatedScore: 4.7,
        scoreSharePercent: 23.5,
        score: { total: 4.7, social: 4.2, developer: 0, knowledge: 0.5, search: 0, diversity: 0 },
      },
    ],
    [
      {
        source: "github",
        family: "developer",
        status: "healthy",
        latestFetchAt: "2026-03-11T21:01:00Z",
        latestSuccessAt: "2026-03-11T21:01:00Z",
        latestItemCount: 30,
        keptItemCount: 18,
        durationMs: 120,
        usedFallback: false,
        errorMessage: null,
        yieldRatePercent: 60,
        rawItemCount: 30,
      },
      {
        source: "reddit",
        family: "community",
        status: "degraded",
        latestFetchAt: "2026-03-11T21:01:00Z",
        latestSuccessAt: "2026-03-11T21:01:00Z",
        latestItemCount: 30,
        keptItemCount: 2,
        durationMs: 120,
        usedFallback: true,
        errorMessage: null,
        yieldRatePercent: 6,
        rawItemCount: 30,
      },
    ],
  );

  assert.deepEqual(
    items.map((item) => [item.source, item.statusLabel, item.fetchSummary, item.warning]),
    [
      ["github", "Healthy", "Latest healthy fetch kept 18 of 30 items", null],
      ["reddit", "Degraded", "Latest successful fetch used fallback data", "Latest successful fetch used fallback sample data."],
    ],
  );
  assert.equal(items[0]?.mixSummary, "Developer 7.8 · Search 1.4");
});

test("summarizeTopSourceDrivers explains score concentration", () => {
  const summary = summarizeTopSourceDrivers([
    {
      source: "github",
      signalCount: 8,
      latestSignalAt: "2026-03-11T21:00:00Z",
      estimatedScore: 9.2,
      scoreSharePercent: 46.2,
      score: { total: 9.2, social: 0, developer: 7.8, knowledge: 0, search: 1.4, diversity: 0 },
    },
    {
      source: "reddit",
      signalCount: 5,
      latestSignalAt: "2026-03-11T20:55:00Z",
      estimatedScore: 4.7,
      scoreSharePercent: 23.5,
      score: { total: 4.7, social: 4.2, developer: 0, knowledge: 0.5, search: 0, diversity: 0 },
    },
  ]);

  assert.equal(summary, "GitHub and Reddit account for 69.7% of this score.");
});

test("getSourceFreshnessBadge classifies recent and stale source fetches", () => {
  const now = new Date("2026-03-12T00:00:00Z");

  assert.deepEqual(
    getSourceFreshnessBadge("2026-03-11T23:40:00Z", now),
    { tone: "fresh", label: "Fresh" },
  );
  assert.deepEqual(
    getSourceFreshnessBadge("2026-03-11T22:20:00Z", now),
    { tone: "aging", label: "100m old" },
  );
  assert.deepEqual(
    getSourceFreshnessBadge("2026-03-11T19:00:00Z", now),
    { tone: "stale", label: "5h old" },
  );
});

test("buildSourceWatchlist flags low-yield but otherwise healthy sources", () => {
  const items = buildSourceWatchlist([
    {
      source: "reddit",
      family: "community",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 25,
      rawItemCount: 20,
    },
    {
      source: "google_trends",
      family: "search",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 45,
      rawItemCount: 20,
    },
    {
      source: "wikipedia",
      family: "knowledge",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 80,
      rawItemCount: 5,
    },
  ]);

  assert.deepEqual(
    items.map((item) => [item.source, item.severity, item.detail]),
    [
      ["reddit", "warning", "Low kept yield from recent fetches"],
      ["google_trends", "info", "Mixed kept yield from recent fetches"],
    ],
  );
});

test("buildSourceFamilyInsights groups sources into sortable family rollups", () => {
  const families = buildSourceFamilyInsights([
    {
      source: "reddit",
      family: "community",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 40,
      rawItemCount: 20,
      signalCount: 18,
      trendCount: 6,
    },
    {
      source: "hacker_news",
      family: "community",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 60,
      rawItemCount: 10,
      signalCount: 12,
      trendCount: 4,
    },
    {
      source: "github",
      family: "developer",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 70,
      rawItemCount: 10,
      signalCount: 20,
      trendCount: 5,
    },
  ]);

  assert.deepEqual(
    families.map((family) => [family.family, family.sourceCount, family.signalCount, family.trendCount, Math.round(family.averageYieldRatePercent)]),
    [
      ["community", 2, 30, 10, 50],
      ["developer", 1, 20, 5, 70],
    ],
  );
});

test("buildSourceFamilyHistoryInsights summarizes recent family health from run history", () => {
  const families = buildSourceFamilyHistoryInsights([
    {
      source: "reddit",
      family: "community",
      status: "healthy",
      latestFetchAt: "2026-03-13T10:00:00Z",
      latestSuccessAt: "2026-03-13T10:00:00Z",
      rawItemCount: 20,
      latestItemCount: 10,
      keptItemCount: 8,
      yieldRatePercent: 40,
      durationMs: 100,
      rawTopicCount: 0,
      mergedTopicCount: 0,
      duplicateTopicCount: 0,
      duplicateTopicRate: 0,
      usedFallback: false,
      errorMessage: null,
      signalCount: 18,
      trendCount: 6,
      runHistory: [
        {
          fetchedAt: "2026-03-13T10:00:00Z",
          success: true,
          rawItemCount: 20,
          itemCount: 10,
          keptItemCount: 8,
          yieldRatePercent: 40,
          durationMs: 100,
          rawTopicCount: 0,
          mergedTopicCount: 0,
          duplicateTopicCount: 0,
          duplicateTopicRate: 0,
          usedFallback: false,
          errorMessage: null,
        },
        {
          fetchedAt: "2026-03-13T09:00:00Z",
          success: true,
          rawItemCount: 20,
          itemCount: 12,
          keptItemCount: 9,
          yieldRatePercent: 45,
          durationMs: 100,
          rawTopicCount: 0,
          mergedTopicCount: 0,
          duplicateTopicCount: 0,
          duplicateTopicRate: 0,
          usedFallback: true,
          errorMessage: null,
        },
      ],
      topTrends: [],
    },
    {
      source: "github",
      family: "developer",
      status: "healthy",
      latestFetchAt: "2026-03-13T10:05:00Z",
      latestSuccessAt: "2026-03-13T10:05:00Z",
      rawItemCount: 12,
      latestItemCount: 9,
      keptItemCount: 7,
      yieldRatePercent: 58,
      durationMs: 100,
      rawTopicCount: 0,
      mergedTopicCount: 0,
      duplicateTopicCount: 0,
      duplicateTopicRate: 0,
      usedFallback: false,
      errorMessage: null,
      signalCount: 20,
      trendCount: 5,
      runHistory: [
        {
          fetchedAt: "2026-03-13T10:05:00Z",
          success: true,
          rawItemCount: 12,
          itemCount: 9,
          keptItemCount: 7,
          yieldRatePercent: 58,
          durationMs: 100,
          rawTopicCount: 0,
          mergedTopicCount: 0,
          duplicateTopicCount: 0,
          duplicateTopicRate: 0,
          usedFallback: false,
          errorMessage: null,
        },
      ],
      topTrends: [],
    },
  ]);

  assert.deepEqual(
    families.map((family) => [family.family, family.healthySourceCount, Math.round(family.recentAverageYieldRatePercent), Math.round(family.recentSuccessRatePercent)]),
    [
      ["community", 1, 43, 50],
      ["developer", 1, 58, 100],
    ],
  );
});
