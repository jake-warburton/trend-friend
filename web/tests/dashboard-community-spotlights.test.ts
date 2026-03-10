import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunitySpotlights } from "@/components/dashboard-shell";
import type { PublicWatchlistsResponse } from "@/lib/types";

test("buildCommunitySpotlights returns popular, search-driven, and global entries when available", () => {
  const watchlists: PublicWatchlistsResponse["watchlists"] = [
    {
      id: 1,
      name: "Popular Robotics",
      itemCount: 3,
      shareToken: "popular-robotics",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      recentOpenCount: 8,
      accessCount: 20,
      popularThisWeek: true,
      sourceContributions: [
        {
          source: "github",
          signalCount: 3,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 7,
          scoreSharePercent: 70,
          score: { total: 7, social: 0, developer: 7, knowledge: 0, search: 0, diversity: 0 },
        },
      ],
      geoSummary: [
        {
          label: "United Kingdom",
          countryCode: "GB",
          region: null,
          signalCount: 3,
          explicitCount: 3,
          inferredCount: 0,
          averageConfidence: 1,
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
      recentOpenCount: 4,
      accessCount: 9,
      popularThisWeek: false,
      sourceContributions: [
        {
          source: "google_trends",
          signalCount: 4,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 6,
          scoreSharePercent: 60,
          score: { total: 6, social: 0, developer: 0, knowledge: 0, search: 6, diversity: 0 },
        },
      ],
      geoSummary: [
        {
          label: "United States",
          countryCode: "US",
          region: null,
          signalCount: 3,
          explicitCount: 3,
          inferredCount: 0,
          averageConfidence: 1,
        },
        {
          label: "United Kingdom",
          countryCode: "GB",
          region: null,
          signalCount: 2,
          explicitCount: 2,
          inferredCount: 0,
          averageConfidence: 0.9,
        },
      ],
    },
  ];

  const spotlights = buildCommunitySpotlights(watchlists);

  assert.deepEqual(
    spotlights.map((spotlight) => spotlight.title),
    ["Popular this week", "Search-driven", "Global interest"],
  );
  assert.equal(spotlights[0]?.watchlist.name, "Popular Robotics");
  assert.equal(spotlights[1]?.watchlist.name, "AI Search");
  assert.equal(spotlights[2]?.watchlist.name, "AI Search");
});

test("buildCommunitySpotlights omits spotlight buckets with no matching watchlists", () => {
  const watchlists: PublicWatchlistsResponse["watchlists"] = [
    {
      id: 1,
      name: "Quiet Robotics",
      itemCount: 2,
      shareToken: "quiet-robotics",
      createdAt: "2026-03-10T12:00:00Z",
      updatedAt: "2026-03-10T12:00:00Z",
      recentOpenCount: 1,
      accessCount: 2,
      popularThisWeek: false,
      sourceContributions: [
        {
          source: "github",
          signalCount: 2,
          latestSignalAt: "2026-03-10T12:00:00Z",
          estimatedScore: 4,
          scoreSharePercent: 40,
          score: { total: 4, social: 0, developer: 4, knowledge: 0, search: 0, diversity: 0 },
        },
      ],
      geoSummary: [
        {
          label: "United Kingdom",
          countryCode: "GB",
          region: null,
          signalCount: 2,
          explicitCount: 2,
          inferredCount: 0,
          averageConfidence: 1,
        },
      ],
    },
  ];

  const spotlights = buildCommunitySpotlights(watchlists);

  assert.deepEqual(spotlights, []);
});
