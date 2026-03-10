import assert from "node:assert/strict";
import test from "node:test";

import { hasOverviewChanged } from "@/lib/auto-refresh";

test("hasOverviewChanged detects new dashboard snapshots", () => {
  assert.equal(
    hasOverviewChanged(
      {
        generatedAt: "2026-03-10T12:00:00Z",
        operations: { lastRunAt: "2026-03-10T11:00:00Z" },
      },
      {
        generatedAt: "2026-03-10T12:05:00Z",
        operations: { lastRunAt: "2026-03-10T12:04:00Z" },
      },
    ),
    true,
  );
});

test("hasOverviewChanged returns false when nothing changed", () => {
  assert.equal(
    hasOverviewChanged(
      {
        generatedAt: "2026-03-10T12:00:00Z",
        operations: { lastRunAt: "2026-03-10T11:00:00Z" },
      },
      {
        generatedAt: "2026-03-10T12:00:00Z",
        operations: { lastRunAt: "2026-03-10T11:00:00Z" },
      },
    ),
    false,
  );
});
