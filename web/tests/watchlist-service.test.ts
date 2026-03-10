import test from "node:test";
import assert from "node:assert/strict";

import {
  listPublicWatchlists,
  listWatchlists,
  mutateWatchlists,
  shareWatchlist,
} from "@/lib/server/watchlist-service";

test("listWatchlists falls back to the CLI service when API mode is disabled", async () => {
  const payload = await listWatchlists({
    apiEnabled: false,
    runScript: async (...args) => ({ args }),
  });

  assert.deepEqual(payload, { args: ["list"] });
});

test("mutateWatchlists maps add-item requests to CLI arguments", async () => {
  const payload = await mutateWatchlists(
    {
      action: "add-item",
      watchlistId: 7,
      trendId: "ai-agents",
      trendName: "AI Agents",
    },
    {
      apiEnabled: false,
      runScript: async (...args) => ({ args }),
    },
  );

  assert.deepEqual(payload, {
    args: ["add-item", "--watchlist-id", "7", "--trend-id", "ai-agents", "--trend-name", "AI Agents"],
  });
});

test("shareWatchlist maps public shares to the CLI fallback", async () => {
  const payload = await shareWatchlist(3, true, {
    apiEnabled: false,
    runScript: async (...args) => ({ args }),
  });

  assert.deepEqual(payload, {
    args: ["share-watchlist", "--watchlist-id", "3", "--public"],
  });
});

test("listPublicWatchlists uses the API contract when API mode is enabled", async () => {
  const payload = await listPublicWatchlists({
    apiEnabled: true,
    apiGet: async <T,>(apiPath: string) => ({ apiPath } as T),
  });

  assert.deepEqual(payload, { apiPath: "/community/watchlists" });
});
