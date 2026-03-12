import assert from "node:assert/strict";
import test from "node:test";

import { filterAndSortSourceRuns, normalizeSourceRunFilter, normalizeSourceRunSort } from "@/lib/source-runs";
import type { SourceRun } from "@/lib/types";

const RUNS: SourceRun[] = [
  {
    fetchedAt: "2026-03-12T00:00:00Z",
    success: true,
    rawItemCount: 30,
    itemCount: 20,
    keptItemCount: 18,
    yieldRatePercent: 60,
    durationMs: 120,
    usedFallback: false,
    errorMessage: null,
  },
  {
    fetchedAt: "2026-03-11T23:45:00Z",
    success: true,
    rawItemCount: 30,
    itemCount: 10,
    keptItemCount: 2,
    yieldRatePercent: 6.7,
    durationMs: 300,
    usedFallback: true,
    errorMessage: null,
  },
  {
    fetchedAt: "2026-03-11T23:30:00Z",
    success: false,
    rawItemCount: 0,
    itemCount: 0,
    keptItemCount: 0,
    yieldRatePercent: 0,
    durationMs: 900,
    usedFallback: false,
    errorMessage: "timeout",
  },
];

test("normalizeSourceRunFilter and normalizeSourceRunSort fall back safely", () => {
  assert.equal(normalizeSourceRunFilter("fallback"), "fallback");
  assert.equal(normalizeSourceRunFilter("weird"), "all");
  assert.equal(normalizeSourceRunSort("slowest"), "slowest");
  assert.equal(normalizeSourceRunSort("weird"), "newest");
});

test("filterAndSortSourceRuns filters by run class", () => {
  assert.deepEqual(
    filterAndSortSourceRuns(RUNS, "healthy", "newest").map((run) => run.fetchedAt),
    ["2026-03-12T00:00:00Z"],
  );
  assert.deepEqual(
    filterAndSortSourceRuns(RUNS, "fallback", "newest").map((run) => run.fetchedAt),
    ["2026-03-11T23:45:00Z"],
  );
  assert.deepEqual(
    filterAndSortSourceRuns(RUNS, "failed", "newest").map((run) => run.fetchedAt),
    ["2026-03-11T23:30:00Z"],
  );
});

test("filterAndSortSourceRuns sorts by newest, slowest, and lowest yield", () => {
  assert.deepEqual(
    filterAndSortSourceRuns(RUNS, "all", "newest").map((run) => run.fetchedAt),
    ["2026-03-12T00:00:00Z", "2026-03-11T23:45:00Z", "2026-03-11T23:30:00Z"],
  );
  assert.deepEqual(
    filterAndSortSourceRuns(RUNS, "all", "slowest").map((run) => run.fetchedAt),
    ["2026-03-11T23:30:00Z", "2026-03-11T23:45:00Z", "2026-03-12T00:00:00Z"],
  );
  assert.deepEqual(
    filterAndSortSourceRuns(RUNS, "all", "lowest_yield").map((run) => run.fetchedAt),
    ["2026-03-11T23:30:00Z", "2026-03-11T23:45:00Z", "2026-03-12T00:00:00Z"],
  );
});
