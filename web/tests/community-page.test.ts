import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommunityPage, {
  filterAndSortCommunityWatchlists,
  loadCommunityWatchlists,
} from "@/app/community/page";
import type { PublicWatchlistsResponse } from "@/lib/types";

const originalFetch = global.fetch;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

test("filterAndSortCommunityWatchlists sorts by recent opens and filters popular entries", () => {
  const result = filterAndSortCommunityWatchlists(
    [
      {
        id: 1,
        name: "Alpha",
        itemCount: 3,
        shareToken: "alpha",
        createdAt: "2026-03-08T12:00:00Z",
        updatedAt: "2026-03-08T12:00:00Z",
        recentOpenCount: 1,
        accessCount: 2,
        popularThisWeek: false,
      },
      {
        id: 2,
        name: "Beta Robotics",
        itemCount: 4,
        shareToken: "beta",
        createdAt: "2026-03-09T12:00:00Z",
        updatedAt: "2026-03-09T12:00:00Z",
        recentOpenCount: 5,
        accessCount: 8,
        popularThisWeek: true,
      },
    ],
    { query: "robot", sort: "recent", popularOnly: true },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, "Beta Robotics");
});

test("loadCommunityWatchlists returns the fetched directory payload", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  const payload: PublicWatchlistsResponse = {
    watchlists: [
      {
        id: 1,
        name: "Community List",
        itemCount: 2,
        shareToken: "community-1",
        createdAt: "2026-03-10T12:00:00Z",
        updatedAt: "2026-03-10T12:00:00Z",
        recentOpenCount: 4,
        accessCount: 9,
        popularThisWeek: true,
      },
    ],
  };

  global.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const result = await loadCommunityWatchlists();

  assert.deepEqual(result, payload);
});

test("community page renders public watchlists with analytics copy", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  const payload: PublicWatchlistsResponse = {
    watchlists: [
      {
        id: 1,
        name: "Popular Robotics",
        itemCount: 3,
        shareToken: "popular-robotics",
        ownerDisplayName: "Owner One",
        createdAt: "2026-03-10T12:00:00Z",
        updatedAt: "2026-03-10T12:00:00Z",
        recentOpenCount: 6,
        accessCount: 12,
        lastAccessedAt: "2026-03-10T12:00:00Z",
        popularThisWeek: true,
      },
    ],
  };

  global.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const element = await CommunityPage({
    searchParams: Promise.resolve({ q: "robot", sort: "recent", popular: "true" }),
  });
  const html = renderToStaticMarkup(element);

  assert.match(html, /Browse shared watchlists/);
  assert.match(html, /Popular Robotics/);
  assert.match(html, /Popular this week/);
  assert.match(html, /7 day opens/);
  assert.match(html, /<strong>6<\/strong>/);
  assert.match(html, /Shared by Owner One/);
});

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalAppUrl == null) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});
