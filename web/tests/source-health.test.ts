import assert from "node:assert/strict";
import test from "node:test";

import { buildSourceWatchlist } from "@/lib/source-health";

test("buildSourceWatchlist prioritizes failed and fallback sources", () => {
  const items = buildSourceWatchlist([
    {
      source: "reddit",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 80,
      rawItemCount: 30,
    },
    {
      source: "github",
      status: "degraded",
      usedFallback: true,
      errorMessage: null,
      yieldRatePercent: 100,
      rawItemCount: 10,
    },
    {
      source: "hacker_news",
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

test("buildSourceWatchlist flags low-yield but otherwise healthy sources", () => {
  const items = buildSourceWatchlist([
    {
      source: "reddit",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 25,
      rawItemCount: 20,
    },
    {
      source: "google_trends",
      status: "healthy",
      usedFallback: false,
      errorMessage: null,
      yieldRatePercent: 45,
      rawItemCount: 20,
    },
    {
      source: "wikipedia",
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
