import assert from "node:assert/strict";
import test from "node:test";

import { formatAutoRefreshStatus, hasOverviewChanged } from "@/lib/auto-refresh";

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

test("formatAutoRefreshStatus returns useful user-facing labels", () => {
  assert.equal(formatAutoRefreshStatus("idle", null), "Auto-refresh every minute");
  assert.equal(formatAutoRefreshStatus("checking", null), "Checking for updates...");
  assert.equal(formatAutoRefreshStatus("refreshing", null), "New data found. Updating dashboard...");
  assert.equal(formatAutoRefreshStatus("error", null), "Background refresh unavailable");
});
