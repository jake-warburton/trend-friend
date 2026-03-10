import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommunityPage, {
  createCommunityUrlBuilder,
  filterAndSortCommunityWatchlists,
  loadCommunityWatchlists,
  listCommunityLocationOptions,
  listCommunitySourceOptions,
  paginateCommunityWatchlists,
} from "@/app/community/page";
import type { PublicWatchlistsResponse } from "@/lib/types";

const originalFetch = global.fetch;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

test("filterAndSortCommunityWatchlists supports source, location, and popular filters", () => {
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
        sourceContributions: [
          {
            source: "reddit",
            signalCount: 2,
            latestSignalAt: "2026-03-08T12:00:00Z",
            estimatedScore: 3,
            scoreSharePercent: 35,
            score: {
              total: 3,
              social: 3,
              developer: 0,
              knowledge: 0,
              search: 0,
              diversity: 0,
            },
          },
        ],
        geoSummary: [
          {
            label: "United States",
            countryCode: "US",
            region: null,
            signalCount: 2,
            explicitCount: 2,
            inferredCount: 0,
            averageConfidence: 1,
          },
        ],
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
        sourceContributions: [
          {
            source: "github",
            signalCount: 3,
            latestSignalAt: "2026-03-09T12:00:00Z",
            estimatedScore: 6,
            scoreSharePercent: 60,
            score: {
              total: 6,
              social: 0,
              developer: 6,
              knowledge: 0,
              search: 0,
              diversity: 0,
            },
          },
        ],
        geoSummary: [
          {
            label: "United Kingdom",
            countryCode: "GB",
            region: null,
            signalCount: 3,
            explicitCount: 1,
            inferredCount: 2,
            averageConfidence: 0.7,
          },
        ],
      },
    ],
    {
      query: "robot",
      sort: "recent",
      source: "github",
      location: "United Kingdom",
      popularOnly: true,
    },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, "Beta Robotics");
});

test("community helpers derive source and location option lists", () => {
  const watchlists: PublicWatchlistsResponse["watchlists"] = [
    {
      id: 1,
      name: "Robotics",
      itemCount: 2,
      shareToken: "robotics",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      sourceContributions: [
        {
          source: "github",
          signalCount: 2,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 5,
          scoreSharePercent: 50,
          score: { total: 5, social: 0, developer: 5, knowledge: 0, search: 0, diversity: 0 },
        },
      ],
      geoSummary: [
        {
          label: "United Kingdom",
          countryCode: "GB",
          region: null,
          signalCount: 2,
          explicitCount: 1,
          inferredCount: 1,
          averageConfidence: 0.8,
        },
      ],
    },
    {
      id: 2,
      name: "AI Search",
      itemCount: 2,
      shareToken: "ai-search",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      sourceContributions: [
        {
          source: "google_trends",
          signalCount: 4,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 7,
          scoreSharePercent: 70,
          score: { total: 7, social: 0, developer: 0, knowledge: 0, search: 7, diversity: 0 },
        },
      ],
      geoSummary: [
        {
          label: "United States",
          countryCode: "US",
          region: null,
          signalCount: 4,
          explicitCount: 4,
          inferredCount: 0,
          averageConfidence: 1,
        },
      ],
    },
  ];

  assert.deepEqual(listCommunitySourceOptions(watchlists), [
    { value: "github", label: "GitHub" },
    { value: "google_trends", label: "Google Trends" },
  ]);
  assert.deepEqual(listCommunityLocationOptions(watchlists), [
    { value: "United Kingdom", label: "United Kingdom" },
    { value: "United States", label: "United States" },
  ]);
});

test("pagination slices community watchlists and builds preserved URLs", () => {
  const watchlists = Array.from({ length: 11 }, (_, index) => ({
    id: index + 1,
    name: `Watchlist ${index + 1}`,
    itemCount: 2,
    shareToken: `share-${index + 1}`,
    createdAt: "2026-03-10T12:00:00Z",
    updatedAt: "2026-03-10T12:00:00Z",
  }));

  const page = paginateCommunityWatchlists(watchlists, 2);
  const buildUrl = createCommunityUrlBuilder({
    q: "robot",
    sort: "total",
    source: "github",
    location: "United Kingdom",
    popular: true,
  });

  assert.equal(page.currentPage, 2);
  assert.equal(page.totalPages, 2);
  assert.equal(page.pageItems.length, 2);
  assert.equal(page.pageItems[0]?.name, "Watchlist 10");
  assert.equal(buildUrl(2), "/community?q=robot&sort=total&source=github&location=United+Kingdom&popular=true&page=2");
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
        sourceContributions: [
          {
            source: "github",
            signalCount: 4,
            latestSignalAt: "2026-03-10T12:00:00Z",
            estimatedScore: 8,
            scoreSharePercent: 66.7,
            score: {
              total: 8,
              social: 0,
              developer: 8,
              knowledge: 0,
              search: 0,
              diversity: 0,
            },
          },
        ],
        geoSummary: [
          {
            label: "United Kingdom",
            countryCode: "GB",
            region: null,
            signalCount: 4,
            explicitCount: 2,
            inferredCount: 2,
            averageConfidence: 0.75,
          },
        ],
      },
    ],
  };

  global.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const element = await CommunityPage({
    searchParams: Promise.resolve({
      q: "robot",
      sort: "recent",
      source: "github",
      location: "United Kingdom",
      popular: "true",
      page: "1",
    }),
  });
  const html = renderToStaticMarkup(element);

  assert.match(html, /Browse shared watchlists/);
  assert.match(html, /Popular Robotics/);
  assert.match(html, /Popular this week/);
  assert.match(html, /Source/);
  assert.match(html, /Location/);
  assert.match(html, /7 day opens/);
  assert.match(html, /<strong>6<\/strong>/);
  assert.match(html, /Shared by Owner One/);
  assert.match(html, /Showing 1-1 of 1 public watchlists/);
});

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalAppUrl == null) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});
