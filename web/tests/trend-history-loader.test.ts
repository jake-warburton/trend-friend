import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTrendDetailPayloadKey,
  buildSupabaseTrendHistoryUrl,
  normalizeSupabaseTrendHistoryRows,
} from "@/lib/trends";

test("normalizeSupabaseTrendHistoryRows sorts rows oldest to newest", () => {
  const result = normalizeSupabaseTrendHistoryRows([
    {
      rank_position: 2,
      total_score: 22.4,
      trend_runs: { captured_at: "2026-03-25T10:00:00Z" },
    },
    {
      rank_position: 4,
      total_score: 14.1,
      trend_runs: { captured_at: "2026-03-24T10:00:00Z" },
    },
  ]);

  assert.deepEqual(result, [
    {
      capturedAt: "2026-03-24T10:00:00Z",
      rank: 4,
      scoreTotal: 14.1,
    },
    {
      capturedAt: "2026-03-25T10:00:00Z",
      rank: 2,
      scoreTotal: 22.4,
    },
  ]);
});

test("normalizeSupabaseTrendHistoryRows accepts embedded relation arrays and drops incomplete rows", () => {
  const result = normalizeSupabaseTrendHistoryRows([
    {
      rank_position: 1,
      total_score: 30.6,
      trend_runs: [{ captured_at: "2026-03-25T12:00:00Z" }],
    },
    {
      rank_position: null,
      total_score: 18.3,
      trend_runs: { captured_at: "2026-03-25T08:00:00Z" },
    },
    {
      rank_position: 3,
      total_score: 18.3,
      trend_runs: null,
    },
  ]);

  assert.deepEqual(result, [
    {
      capturedAt: "2026-03-25T12:00:00Z",
      rank: 1,
      scoreTotal: 30.6,
    },
  ]);
});

test("buildSupabaseTrendHistoryUrl targets published snapshot history with pagination", () => {
  const url = new URL(
    buildSupabaseTrendHistoryUrl("large language models", 1000, 2000),
  );

  assert.equal(url.pathname, "/rest/v1/trend_score_snapshots");
  assert.equal(
    url.searchParams.get("select"),
    "rank_position,total_score,trend_runs!inner(captured_at)",
  );
  assert.equal(url.searchParams.get("topic"), "eq.large language models");
  assert.equal(url.searchParams.get("is_published"), "eq.1");
  assert.equal(url.searchParams.get("limit"), "1000");
  assert.equal(url.searchParams.get("offset"), "2000");
});

test("buildTrendDetailPayloadKey targets one published detail payload per trend", () => {
  assert.equal(
    buildTrendDetailPayloadKey("large-language-models"),
    "trend-details/large-language-models.json",
  );
});
