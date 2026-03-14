import assert from "node:assert/strict";
import test from "node:test";

import { metadata } from "@/app/explore/page";
import { handleExploreBootstrapGet } from "@/app/api/explore/bootstrap/route";
import { loadExploreInitialData } from "@/lib/trends";

test("explore page metadata is specific to the explorer route", () => {
  assert.equal(metadata.title, "Explore Trends | Signal Eye");
  assert.match(metadata.description ?? "", /emerging trends/i);
});

test("explore initial loader only returns overview and explorer payloads", async () => {
  const payload = await loadExploreInitialData();

  assert.deepEqual(Object.keys(payload).sort(), ["explorer", "overview"]);
  assert.ok(Array.isArray(payload.explorer.trends));
  assert.equal(typeof payload.overview.generatedAt, "string");
});

test("explore bootstrap route returns deferred datasets", async () => {
  const response = await handleExploreBootstrapGet(undefined, {
    loadDeferredData: async () => ({
      history: {
        generatedAt: "2026-03-10T12:00:00Z",
        snapshots: [],
      },
      details: {
        generatedAt: "2026-03-10T12:00:00Z",
        trends: [],
      },
      sourceSummary: {
        generatedAt: "2026-03-10T12:00:00Z",
        sources: [],
        familyHistory: [],
      },
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    history: object;
    details: object;
    sourceSummary: object;
  };
  assert.deepEqual(Object.keys(payload).sort(), [
    "details",
    "history",
    "sourceSummary",
  ]);
});
