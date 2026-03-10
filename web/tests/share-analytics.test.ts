import assert from "node:assert/strict";
import test from "node:test";

import { summarizeShareUsage, wasOpenedRecently } from "@/lib/share-analytics";
import type { WatchlistShare } from "@/lib/types";

const NOW = new Date("2026-03-10T12:00:00Z").getTime();

function buildShare(overrides: Partial<WatchlistShare> = {}): WatchlistShare {
  return {
    id: 1,
    shareToken: "share-1",
    public: true,
    showCreator: false,
    expiresAt: null,
    accessCount: 0,
    lastAccessedAt: null,
    accessHistory: [],
    createdAt: "2026-03-01T12:00:00Z",
    ...overrides,
  };
}

test("wasOpenedRecently returns true only for opens within seven days", () => {
  assert.equal(wasOpenedRecently("2026-03-08T12:00:00Z", NOW), true);
  assert.equal(wasOpenedRecently("2026-03-01T11:59:59Z", NOW), false);
  assert.equal(wasOpenedRecently(null, NOW), false);
});

test("summarizeShareUsage returns total opens and activity breakdown", () => {
  const summary = summarizeShareUsage([
    buildShare({
      id: 1,
      shareToken: "share-1",
      accessCount: 9,
      lastAccessedAt: "2026-03-09T12:00:00Z",
      accessHistory: [
        { date: "2026-03-08", count: 4 },
        { date: "2026-03-09", count: 5 },
      ],
    }),
    buildShare({
      id: 2,
      shareToken: "share-2",
      accessCount: 2,
      lastAccessedAt: "2026-03-03T12:00:00Z",
      accessHistory: [
        { date: "2026-03-03", count: 2 },
      ],
    }),
    buildShare({ id: 3, shareToken: "share-3", accessCount: 0, lastAccessedAt: null }),
  ], NOW);

  assert.equal(summary.totalOpens, 11);
  assert.equal(summary.recentOpens, 11);
  assert.equal(summary.activeShares, 2);
  assert.equal(summary.dormantShares, 1);
  assert.equal(summary.topShare?.shareToken, "share-1");
});
