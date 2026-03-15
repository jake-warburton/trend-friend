import assert from "node:assert/strict";
import test from "node:test";

import { buildWatchlistCsv } from "@/app/api/export/watchlist/route";
import type { TrendExplorerRecord, Watchlist } from "@/lib/types";

test("buildWatchlistCsv includes enrichment columns and added timestamp", () => {
  const watchlist: Watchlist = {
    id: 7,
    name: "Builders",
    ownerUserId: null,
    ownedByCurrentUser: true,
    defaultShareExpiryDays: null,
    createdAt: "2026-03-11T07:00:00Z",
    updatedAt: "2026-03-11T07:00:00Z",
    items: [
      {
        trendId: "ai-agents",
        trendName: "AI Agents",
        addedAt: "2026-03-11T08:00:00Z",
      },
    ],
    shares: [],
    shareEvents: [],
  };

  const trends: TrendExplorerRecord[] = [
    {
      id: "ai-agents",
      name: "AI Agents",
      category: "artificial-intelligence",
      status: "breakout",
      volatility: "spiking",
      rank: 1,
      previousRank: 3,
      rankChange: 2,
      firstSeenAt: "2026-03-01T00:00:00Z",
      latestSignalAt: "2026-03-10T12:00:00Z",
      score: {
        total: 42.4,
        social: 15,
        developer: 10,
        knowledge: 6.2,
        search: 5,
        advertising: 0,
        diversity: 6.2,
      },
      momentum: {
        previousRank: 3,
        rankChange: 2,
        absoluteDelta: 10,
        percentDelta: 40.2,
      },
      coverage: {
        sourceCount: 2,
        signalCount: 2,
      },
      sources: ["reddit", "github"],
      evidencePreview: ["AI agents evidence"],
      audienceSummary: [
        { segmentType: "audience", label: "developer", signalCount: 2 },
        { segmentType: "market", label: "b2b", signalCount: 1 },
        { segmentType: "language", label: "EN", signalCount: 2 },
      ],
      forecastDirection: "accelerating",
    },
  ];

  const [header, row] = buildWatchlistCsv(watchlist, trends).trimEnd().split("\n");

  assert.deepEqual(header.split(","), [
    "rank",
    "name",
    "category",
    "status",
    "volatility",
    "score",
    "social_score",
    "developer_score",
    "knowledge_score",
    "search_score",
    "diversity_score",
    "rank_change",
    "momentum_pct",
    "source_count",
    "signal_count",
    "sources",
    "audience_segments",
    "market_segments",
    "language_segments",
    "forecast_direction",
    "first_seen",
    "latest_signal",
    "added_at",
  ]);
  assert.match(row, /developer/);
  assert.match(row, /b2b/);
  assert.match(row, /EN/);
  assert.match(row, /2026-03-11T08:00:00Z/);
});
