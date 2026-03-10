import assert from "node:assert/strict";
import test from "node:test";

import { WatchlistServiceError } from "@/lib/server/watchlist-service";
import { handleShareWatchlistPost } from "@/app/api/watchlists/[watchlistId]/share/route";
import { handleRevokeSharePost } from "@/app/api/watchlists/[watchlistId]/shares/[shareId]/revoke/route";
import { handleSharedWatchlistGet } from "@/app/api/shared/[token]/route";

test("share watchlist route returns the share payload", async () => {
  const request = new Request("http://localhost/api/watchlists/12/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public: true }),
  });

  const response = await handleShareWatchlistPost(
    request,
    { params: Promise.resolve({ watchlistId: "12" }) },
    {
      shareWatchlist: async (watchlistId, isPublic) => ({
        watchlistId,
        public: isPublic,
        shareToken: "share-123",
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    watchlistId: 12,
    public: true,
    shareToken: "share-123",
  });
});

test("share watchlist route preserves not-found status", async () => {
  const request = new Request("http://localhost/api/watchlists/999/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public: false }),
  });

  const response = await handleShareWatchlistPost(
    request,
    { params: Promise.resolve({ watchlistId: "999" }) },
    {
      shareWatchlist: async () => {
        throw new WatchlistServiceError(404, "Watchlist not found");
      },
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Watchlist not found" });
});

test("shared watchlist route returns the shared payload", async () => {
  const request = new Request("http://localhost/api/shared/share-123");

  const response = await handleSharedWatchlistGet(
    request,
    { params: Promise.resolve({ token: "share-123" }) },
    {
      getSharedWatchlist: async (token) => ({
        shareToken: token,
        public: true,
        createdAt: "2026-03-10T12:00:00Z",
        watchlist: {
          id: 1,
          name: "Shared List",
          itemCount: 1,
          createdAt: "2026-03-10T12:00:00Z",
          updatedAt: "2026-03-10T12:00:00Z",
          items: [
            {
              trendId: "ai-agents",
              trendName: "AI Agents",
              addedAt: "2026-03-10T12:00:00Z",
              currentScore: 42.5,
            },
          ],
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { watchlist: { name: string }; shareToken: string };
  assert.equal(payload.shareToken, "share-123");
  assert.equal(payload.watchlist.name, "Shared List");
});

test("revoke share route returns ok payload", async () => {
  const request = new Request("http://localhost/api/watchlists/12/shares/3/revoke", {
    method: "POST",
  });

  const response = await handleRevokeSharePost(
    request,
    { params: Promise.resolve({ watchlistId: "12", shareId: "3" }) },
    {
      mutateWatchlists: async () => ({ ok: true }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});
