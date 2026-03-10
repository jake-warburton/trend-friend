import test from "node:test";
import assert from "node:assert/strict";

import {
  listAlerts,
  listPublicWatchlists,
  listWatchlists,
  mutateAlerts,
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

test("listWatchlists forwards auth headers in API mode", async () => {
  const payload = await listWatchlists({
    apiEnabled: true,
    apiHeaders: { cookie: "tf_session=session-token" },
    apiGet: async <T,>(apiPath: string, options?: { headers?: HeadersInit }) => ({
      apiPath,
      cookie: (options?.headers as Record<string, string> | undefined)?.cookie ?? null,
    } as T),
  });

  assert.deepEqual(payload, {
    apiPath: "/watchlists",
    cookie: "tf_session=session-token",
  });
});

test("listAlerts uses the CLI fallback instead of returning an empty list", async () => {
  const payload = await listAlerts(true, {
    apiEnabled: false,
    runScript: async (...args) => ({ args }),
  });

  assert.deepEqual(payload, { args: ["list-alerts", "--unread-only"] });
});

test("mutateAlerts maps mark-read requests to the CLI fallback", async () => {
  const payload = await mutateAlerts(
    {
      action: "mark-read",
      eventIds: [4, 8],
    },
    {
      apiEnabled: false,
      runScript: async (...args) => ({ args }),
    },
  );

  assert.deepEqual(payload, {
    args: ["mark-alerts-read", "--event-id", "4", "--event-id", "8"],
  });
});
