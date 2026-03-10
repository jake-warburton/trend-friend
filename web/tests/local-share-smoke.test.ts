import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { handleShareWatchlistPost } from "@/app/api/watchlists/[watchlistId]/share/route";
import SharedWatchlistPage from "@/app/shared/[token]/page";
import type { SharedWatchlistResponse } from "@/lib/types";

const originalFetch = global.fetch;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

test("local share smoke flow covers share creation and shared page render", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

  const sharedPayload: SharedWatchlistResponse = {
    shareToken: "share-local-123",
    public: true,
    createdAt: "2026-03-10T12:00:00Z",
    watchlist: {
      id: 1,
      name: "Shared Smoke List",
      itemCount: 1,
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      items: [
        {
          trendId: "ai-agents",
          trendName: "AI Agents",
          addedAt: "2026-03-10T12:00:00Z",
          currentScore: 42.5,
          rank: 3,
          rankChange: 2,
          status: "rising",
          category: "technology",
          sources: ["reddit", "hacker_news"],
        },
      ],
    },
  };

  const shareResponse = await handleShareWatchlistPost(
    new Request("http://localhost/api/watchlists/1/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public: true }),
    }),
    { params: Promise.resolve({ watchlistId: "1" }) },
    {
      shareWatchlist: async (watchlistId, isPublic) => ({
        watchlistId,
        public: isPublic,
        shareToken: sharedPayload.shareToken,
      }),
    },
  );

  assert.equal(shareResponse.status, 200);
  assert.deepEqual(await shareResponse.json(), {
    watchlistId: 1,
    public: true,
    shareToken: "share-local-123",
  });

  global.fetch = (async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    assert.match(url, /\/api\/shared\/share-local-123$/);
    return new Response(JSON.stringify(sharedPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const page = await SharedWatchlistPage({
    params: Promise.resolve({ token: sharedPayload.shareToken }),
  });
  const html = renderToStaticMarkup(page);

  assert.match(html, /Shared Smoke List/);
  assert.match(html, /AI Agents/);
  assert.match(html, /Public link/);
});

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalAppUrl == null) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});
