import test from "node:test";
import assert from "node:assert/strict";

import { getRefreshErrorStatus, hasRefreshApi, refreshData } from "@/lib/server/refresh-service";

test("refreshData returns a local revalidation payload when no backend API is configured", async () => {
  const payload = await refreshData({
    apiEnabled: false,
  });

  assert.deepEqual(payload, { ok: true, revalidated: true });
});

test("refreshData delegates to the backend API when API mode is enabled", async () => {
  let calledPath = "";
  let calledBody: unknown = null;

  const payload = await refreshData({
    apiEnabled: true,
    apiPost: async (apiPath, body) => {
      calledPath = apiPath;
      calledBody = body;
      return { ok: true, upstream: true };
    },
  });

  assert.equal(calledPath, "/refresh");
  assert.deepEqual(calledBody, {});
  assert.deepEqual(payload, { ok: true, upstream: true });
});

test("getRefreshErrorStatus maps API errors and defaults to 500", () => {
  assert.equal(getRefreshErrorStatus({}), 500);
});

test("hasRefreshApi reflects the configured backend url", () => {
  const original = process.env.SIGNAL_EYE_API_URL;

  try {
    delete process.env.SIGNAL_EYE_API_URL;
    assert.equal(hasRefreshApi(), false);

    process.env.SIGNAL_EYE_API_URL = "https://example.com";
    assert.equal(hasRefreshApi(), true);
  } finally {
    if (original == null) {
      delete process.env.SIGNAL_EYE_API_URL;
    } else {
      process.env.SIGNAL_EYE_API_URL = original;
    }
  }
});
