import assert from "node:assert/strict";
import test from "node:test";

import { handleCommunityExportGet } from "@/app/api/export/community/route";
import { handleSharedExportGet } from "@/app/api/export/shared/[token]/route";

test("shared export route returns csv for a shared watchlist", async () => {
  const response = await handleSharedExportGet(
    new Request("http://localhost/api/export/shared/share-123"),
    { params: Promise.resolve({ token: "share-123" }) },
    {
      getSharedWatchlist: async () => ({
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
              audienceSummary: [
                { segmentType: "audience", label: "developer", signalCount: 2 },
                { segmentType: "market", label: "b2b", signalCount: 1 },
                { segmentType: "language", label: "EN", signalCount: 2 },
              ],
              sourceContributions: [
                {
                  source: "reddit",
                  signalCount: 2,
                  latestSignalAt: "2026-03-10T12:00:00Z",
                  estimatedScore: 24.2,
                  scoreSharePercent: 57.1,
                  score: {
                    total: 24.2,
                    social: 18.2,
                    developer: 0,
                    knowledge: 6,
                    search: 0,
                    advertising: 0,
                    diversity: 0,
                  },
                },
              ],
            },
          ],
        },
      }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/csv");
  assert.match(response.headers.get("Content-Disposition") ?? "", /shared-watchlist-share-123-/);
  const body = await response.text();
  assert.match(body, /audience_segments/);
  assert.match(body, /developer/);
  assert.match(body, /b2b/);
  assert.match(body, /EN/);
});

test("community export route returns csv for public watchlists", async () => {
  const response = await handleCommunityExportGet(
    new Request("http://localhost/api/export/community"),
    {
      listPublicWatchlists: async () => ({
        watchlists: [
          {
            id: 1,
            name: "Builders",
            itemCount: 4,
            shareToken: "builders",
            ownerDisplayName: "Owner One",
            recentOpenCount: 3,
            accessCount: 7,
            popularThisWeek: true,
            categories: ["developer-tools"],
            statuses: ["breakout"],
            createdAt: "2026-03-10T12:00:00Z",
            updatedAt: "2026-03-10T12:00:00Z",
            geoSummary: [{ label: "United Kingdom" }],
            audienceSummary: [
              { segmentType: "audience", label: "developer", signalCount: 2 },
              { segmentType: "market", label: "b2b", signalCount: 1 },
              { segmentType: "language", label: "EN", signalCount: 2 },
            ],
            sourceContributions: [
              {
                source: "github",
                signalCount: 2,
                latestSignalAt: "2026-03-10T12:00:00Z",
                estimatedScore: 24.2,
                scoreSharePercent: 57.1,
                score: {
                  total: 24.2,
                  social: 0,
                  developer: 18.2,
                  knowledge: 6,
                  search: 0,
                  advertising: 0,
                  diversity: 0,
                },
              },
            ],
          },
        ],
      }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/csv");
  assert.match(response.headers.get("Content-Disposition") ?? "", /community-watchlists-/);
  const body = await response.text();
  assert.match(body, /developer/);
  assert.match(body, /b2b/);
  assert.match(body, /EN/);
});
