import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import SharedWatchlistPage, { loadSharedWatchlist } from "@/app/shared/[token]/page";
import type { SharedWatchlistResponse } from "@/lib/types";

const originalFetch = global.fetch;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

test("loadSharedWatchlist returns null for a 404 response", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  global.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;

  const payload = await loadSharedWatchlist("missing-token");

  assert.equal(payload, null);
});

test("shared page renders the fetched watchlist", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  const responsePayload: SharedWatchlistResponse = {
    shareToken: "share-123",
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
          rank: 3,
          rankChange: 2,
          status: "rising",
          category: "technology",
          sources: ["reddit", "hacker_news"],
        },
      ],
    },
  };

  global.fetch = (async () =>
    new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const element = await SharedWatchlistPage({
    params: Promise.resolve({ token: "share-123" }),
  });
  const html = renderToStaticMarkup(element);

  assert.match(html, /Shared List/);
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
