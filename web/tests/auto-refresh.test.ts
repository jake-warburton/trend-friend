import assert from "node:assert/strict";
import test from "node:test";

import { detectChangedTrendIds, hasOverviewChanged } from "@/lib/auto-refresh";

test("hasOverviewChanged detects new dashboard snapshots", () => {
  assert.equal(
    hasOverviewChanged(
      { generatedAt: "2026-03-11T10:00:00Z", operations: { lastRunAt: "2026-03-11T10:00:00Z" } },
      { generatedAt: "2026-03-11T10:05:00Z", operations: { lastRunAt: "2026-03-11T10:05:00Z" } },
    ),
    true,
  );
});

test("hasOverviewChanged returns false when nothing changed", () => {
  assert.equal(
    hasOverviewChanged(
      { generatedAt: "2026-03-11T10:00:00Z", operations: { lastRunAt: "2026-03-11T10:00:00Z" } },
      { generatedAt: "2026-03-11T10:00:00Z", operations: { lastRunAt: "2026-03-11T10:00:00Z" } },
    ),
    false,
  );
});

test("detectChangedTrendIds returns new and changed trends", () => {
  assert.deepEqual(
    detectChangedTrendIds(
      [
        { id: "ai-agents", rank: 1, score: { total: 42 } },
        { id: "deepmd-kit", rank: 2, score: { total: 31 } },
      ],
      [
        { id: "ai-agents", rank: 2, score: { total: 42 } },
        { id: "deepmd-kit", rank: 2, score: { total: 33 } },
        { id: "macbook-neo", rank: 3, score: { total: 20 } },
      ],
    ),
    ["ai-agents", "deepmd-kit", "macbook-neo"],
  );
});
