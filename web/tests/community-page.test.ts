import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommunityPage, {
  buildCommunityFilterRemovalUrl,
  buildCommunityEmptyStateSuggestions,
  createCommunityUrlBuilder,
  filterAndSortCommunityWatchlists,
  listCommunityCategoryOptions,
  listActiveCommunityFilters,
  listCommunityPresetSections,
  loadCommunityWatchlists,
  listCommunityLocationOptions,
  listCommunitySourceOptions,
  listCommunityStatusOptions,
  paginateCommunityWatchlists,
} from "@/app/community/page";
import type { PublicWatchlistsResponse } from "@/lib/types";

const originalFetch = global.fetch;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

test("filterAndSortCommunityWatchlists supports category, status, source, location, and popular filters", () => {
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
        categories: ["general-tech"],
        statuses: ["steady"],
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
        categories: ["hardware-robotics"],
        statuses: ["breakout"],
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
      category: "hardware-robotics",
      status: "breakout",
      source: "github",
      location: "United Kingdom",
      popularOnly: true,
    },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, "Beta Robotics");
});

test("community helpers derive category, status, source, and location option lists", () => {
  const watchlists: PublicWatchlistsResponse["watchlists"] = [
    {
      id: 1,
      name: "Robotics",
      itemCount: 2,
      shareToken: "robotics",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["hardware-robotics"],
      statuses: ["breakout"],
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
      categories: ["ai-machine-learning"],
      statuses: ["rising"],
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
    {
      id: 3,
      name: "Robotics Europe",
      itemCount: 2,
      shareToken: "robotics-europe",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["hardware-robotics"],
      statuses: ["steady"],
      sourceContributions: [
        {
          source: "github",
          signalCount: 1,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 3,
          scoreSharePercent: 40,
          score: { total: 3, social: 0, developer: 3, knowledge: 0, search: 0, diversity: 0 },
        },
      ],
      geoSummary: [
        {
          label: "United Kingdom",
          countryCode: "GB",
          region: null,
          signalCount: 1,
          explicitCount: 1,
          inferredCount: 0,
          averageConfidence: 0.9,
        },
      ],
    },
  ];

  assert.deepEqual(listCommunityCategoryOptions(watchlists), [
    { value: "ai-machine-learning", label: "Ai Machine Learning (1)" },
    { value: "hardware-robotics", label: "Hardware Robotics (2)" },
  ]);
  assert.deepEqual(listCommunityStatusOptions(watchlists), [
    { value: "breakout", label: "Breakout (1)" },
    { value: "rising", label: "Rising (1)" },
    { value: "steady", label: "Steady (1)" },
  ]);
  assert.deepEqual(listCommunitySourceOptions(watchlists), [
    { value: "github", label: "GitHub (2)" },
    { value: "google_trends", label: "Google Trends (1)" },
  ]);
  assert.deepEqual(listCommunityLocationOptions(watchlists), [
    { value: "United Kingdom", label: "United Kingdom (2)" },
    { value: "United States", label: "United States (1)" },
  ]);
});

test("community option counts can be derived from the currently filtered result set", () => {
  const watchlists: PublicWatchlistsResponse["watchlists"] = [
    {
      id: 1,
      name: "Robotics UK",
      itemCount: 2,
      shareToken: "robotics-uk",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["hardware-robotics"],
      statuses: ["breakout"],
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
      geoSummary: [{ label: "United Kingdom", countryCode: "GB", region: null, signalCount: 2, explicitCount: 2, inferredCount: 0, averageConfidence: 1 }],
      recentOpenCount: 5,
      accessCount: 10,
      popularThisWeek: true,
    },
    {
      id: 2,
      name: "Robotics US",
      itemCount: 2,
      shareToken: "robotics-us",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["hardware-robotics"],
      statuses: ["steady"],
      sourceContributions: [
        {
          source: "reddit",
          signalCount: 2,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 4,
          scoreSharePercent: 40,
          score: { total: 4, social: 4, developer: 0, knowledge: 0, search: 0, diversity: 0 },
        },
      ],
      geoSummary: [{ label: "United States", countryCode: "US", region: null, signalCount: 2, explicitCount: 2, inferredCount: 0, averageConfidence: 1 }],
      recentOpenCount: 4,
      accessCount: 9,
      popularThisWeek: true,
    },
    {
      id: 3,
      name: "AI Search",
      itemCount: 2,
      shareToken: "ai-search",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["ai-machine-learning"],
      statuses: ["rising"],
      sourceContributions: [
        {
          source: "google_trends",
          signalCount: 2,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 6,
          scoreSharePercent: 60,
          score: { total: 6, social: 0, developer: 0, knowledge: 0, search: 6, diversity: 0 },
        },
      ],
      geoSummary: [{ label: "United States", countryCode: "US", region: null, signalCount: 2, explicitCount: 2, inferredCount: 0, averageConfidence: 1 }],
      recentOpenCount: 3,
      accessCount: 8,
      popularThisWeek: true,
    },
  ];

  const sourceScoped = filterAndSortCommunityWatchlists(watchlists, {
    query: "",
    sort: "recent",
    category: "hardware-robotics",
    status: "",
    source: "",
    location: "United Kingdom",
    popularOnly: true,
  });
  const statusScoped = filterAndSortCommunityWatchlists(watchlists, {
    query: "",
    sort: "recent",
    category: "hardware-robotics",
    status: "",
    source: "github",
    location: "",
    popularOnly: true,
  });

  assert.deepEqual(listCommunitySourceOptions(sourceScoped), [
    { value: "github", label: "GitHub (1)" },
  ]);
  assert.deepEqual(listCommunityStatusOptions(statusScoped), [
    { value: "breakout", label: "Breakout (1)" },
  ]);
});

test("community preset sections surface popular and topical slices", () => {
  const watchlists: PublicWatchlistsResponse["watchlists"] = [
    {
      id: 1,
      name: "Popular Robotics",
      itemCount: 3,
      shareToken: "popular-robotics",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["hardware-robotics"],
      statuses: ["breakout"],
      popularThisWeek: true,
    },
    {
      id: 2,
      name: "AI Search",
      itemCount: 2,
      shareToken: "ai-search",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["ai-machine-learning"],
      statuses: ["rising"],
      popularThisWeek: false,
    },
    {
      id: 3,
      name: "Dev Tools",
      itemCount: 2,
      shareToken: "dev-tools",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["developer-tools"],
      statuses: ["steady"],
      popularThisWeek: false,
    },
  ];

  const sections = listCommunityPresetSections(watchlists, {
    query: "",
    sort: "recent",
    category: "",
    status: "",
    source: "",
    location: "",
    popularOnly: false,
  });

  assert.deepEqual(
    sections.map((section) => section.title),
    ["Popular this week", "AI watchlists", "Developer watchlists"],
  );
  assert.equal(sections[0]?.watchlists[0]?.name, "Popular Robotics");
  assert.equal(sections[1]?.watchlists[0]?.name, "AI Search");
  assert.equal(sections[2]?.watchlists[0]?.name, "Dev Tools");
});

test("community preset sections hide rails that conflict with the active slice", () => {
  const watchlists: PublicWatchlistsResponse["watchlists"] = [
    {
      id: 1,
      name: "Popular Robotics",
      itemCount: 3,
      shareToken: "popular-robotics",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["hardware-robotics"],
      statuses: ["breakout"],
      popularThisWeek: true,
    },
    {
      id: 2,
      name: "AI Search",
      itemCount: 2,
      shareToken: "ai-search",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["ai-machine-learning"],
      statuses: ["rising"],
      popularThisWeek: false,
    },
    {
      id: 3,
      name: "Dev Tools",
      itemCount: 2,
      shareToken: "dev-tools",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      categories: ["developer-tools"],
      statuses: ["steady"],
      popularThisWeek: false,
    },
  ];

  const sections = listCommunityPresetSections(watchlists, {
    query: "",
    sort: "recent",
    category: "ai-machine-learning",
    status: "",
    source: "",
    location: "",
    popularOnly: true,
  });

  assert.deepEqual(
    sections.map((section) => section.title),
    ["Developer watchlists"],
  );
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
    category: "hardware-robotics",
    status: "breakout",
    source: "github",
    location: "United Kingdom",
    popular: true,
  });

  assert.equal(page.currentPage, 2);
  assert.equal(page.totalPages, 2);
  assert.equal(page.pageItems.length, 2);
  assert.equal(page.pageItems[0]?.name, "Watchlist 10");
  assert.equal(
    buildUrl(2),
    "/community?q=robot&sort=total&category=hardware-robotics&status=breakout&source=github&location=United+Kingdom&popular=true&page=2",
  );
});

test("community active filters expose readable labels and removal URLs", () => {
  const filters = listActiveCommunityFilters({
    query: "robot",
    sort: "total",
    category: "hardware-robotics",
    status: "breakout",
    source: "github",
    location: "United Kingdom",
    popularOnly: true,
  });

  assert.deepEqual(filters, [
    { key: "q", label: "Search", value: "robot" },
    { key: "sort", label: "Sort", value: "Total opens" },
    { key: "category", label: "Category", value: "Hardware Robotics" },
    { key: "status", label: "Status", value: "Breakout" },
    { key: "source", label: "Source", value: "GitHub" },
    { key: "location", label: "Location", value: "United Kingdom" },
    { key: "popular", label: "Popularity", value: "Popular this week" },
  ]);

  assert.equal(
    buildCommunityFilterRemovalUrl(
      {
        q: "robot",
        sort: "total",
        category: "hardware-robotics",
        status: "breakout",
        source: "github",
        location: "United Kingdom",
        popular: true,
      },
      "status",
    ),
    "/community?q=robot&sort=total&category=hardware-robotics&source=github&location=United+Kingdom&popular=true",
  );

  assert.equal(
    buildCommunityFilterRemovalUrl(
      {
        q: "robot",
        sort: "total",
        category: "hardware-robotics",
        status: "breakout",
        source: "github",
        location: "United Kingdom",
        popular: true,
      },
      "sort",
    ),
    "/community?q=robot&category=hardware-robotics&status=breakout&source=github&location=United+Kingdom&popular=true",
  );
});

test("community empty state suggestions reflect the active filters", () => {
  const suggestions = buildCommunityEmptyStateSuggestions([
    { key: "q", label: "Search", value: "robot" },
    { key: "popular", label: "Popularity", value: "Popular this week" },
    { key: "source", label: "Source", value: "GitHub" },
  ]);

  assert.deepEqual(suggestions, [
    'Clear the search for "robot".',
    "Turn off Popular this week only.",
  ]);
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
        categories: ["general-tech"],
        statuses: ["steady"],
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
        categories: ["hardware-robotics"],
        statuses: ["breakout"],
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
      {
        id: 2,
        name: "AI Search",
        itemCount: 2,
        shareToken: "ai-search",
        createdAt: "2026-03-10T12:00:00Z",
        updatedAt: "2026-03-10T12:00:00Z",
        recentOpenCount: 2,
        accessCount: 5,
        popularThisWeek: false,
        categories: ["ai-machine-learning"],
        statuses: ["rising"],
      },
      {
        id: 3,
        name: "Dev Tools Weekly",
        itemCount: 2,
        shareToken: "dev-tools-weekly",
        createdAt: "2026-03-10T12:00:00Z",
        updatedAt: "2026-03-10T12:00:00Z",
        recentOpenCount: 1,
        accessCount: 3,
        popularThisWeek: false,
        categories: ["developer-tools"],
        statuses: ["steady"],
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
      category: "hardware-robotics",
      status: "breakout",
      source: "github",
      location: "United Kingdom",
      popular: "true",
      page: "1",
    }),
  });
  const html = renderToStaticMarkup(element);

  assert.match(html, /Browse shared watchlists/);
  assert.match(html, /Popular this week/);
  assert.match(html, /Developer tools/);
  assert.match(html, /AI watchlists/);
  assert.match(html, /Developer watchlists/);
  assert.match(html, /Popular Robotics/);
  assert.match(html, /Popular this week/);
  assert.match(html, /Category/);
  assert.match(html, /Status/);
  assert.match(html, /Source/);
  assert.match(html, /Location/);
  assert.match(html, /Hardware Robotics \(1\)/);
  assert.match(html, /GitHub \(1\)/);
  assert.match(html, /7 day opens/);
  assert.match(html, /<strong>6<\/strong>/);
  assert.match(html, /Hardware Robotics/);
  assert.match(html, /Breakout/);
  assert.match(html, /GitHub/);
  assert.match(html, /United Kingdom/);
  assert.match(html, /Top driver: GitHub drove 66.7%/);
  assert.match(html, /Shared by Owner One/);
  assert.match(html, /Showing 1-1 of 1 public watchlists/);
  assert.match(html, /Search: robot/);
  assert.match(html, /Category: Hardware Robotics/);
  assert.match(html, /Clear all/);
});

test("community page empty state suggests how to loosen active filters", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  const payload: PublicWatchlistsResponse = {
    watchlists: [
      {
        id: 1,
        name: "Popular Robotics",
        itemCount: 3,
        shareToken: "popular-robotics",
        createdAt: "2026-03-10T12:00:00Z",
        updatedAt: "2026-03-10T12:00:00Z",
        recentOpenCount: 6,
        accessCount: 12,
        popularThisWeek: true,
        categories: ["hardware-robotics"],
        statuses: ["breakout"],
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
      q: "climate",
      sort: "total",
      category: "hardware-robotics",
      popular: "true",
    }),
  });
  const html = renderToStaticMarkup(element);

  assert.match(html, /No public watchlists match/);
  assert.match(html, /Clear the search for &quot;climate&quot;\./);
  assert.match(html, /Switch sorting back from Total opens\./);
});

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalAppUrl == null) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});
