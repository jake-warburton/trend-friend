import test from "node:test";
import assert from "node:assert/strict";

import {
  RefreshConflictError,
  getRefreshErrorStatus,
  refreshData,
} from "@/lib/server/refresh-service";

test("refreshData runs ingestion and export through the local fallback when API mode is disabled", async () => {
  const calls: string[] = [];

  const payload = await refreshData({
    apiEnabled: false,
    acquireLock: () => true,
    releaseLock: () => calls.push("release"),
    runIngestion: async () => {
      calls.push("ingest");
    },
    runExport: async () => {
      calls.push("export");
    },
  });

  assert.deepEqual(payload, { ok: true });
  assert.deepEqual(calls, ["ingest", "export", "release"]);
});

test("refreshData returns a conflict when a local refresh is already in progress", async () => {
  await assert.rejects(
    refreshData({
      apiEnabled: false,
      acquireLock: () => false,
    }),
    RefreshConflictError,
  );
});

test("getRefreshErrorStatus maps refresh conflicts to HTTP 409", () => {
  assert.equal(getRefreshErrorStatus(new RefreshConflictError()), 409);
});
