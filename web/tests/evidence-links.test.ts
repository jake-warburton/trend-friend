import assert from "node:assert/strict";
import test from "node:test";

import { getPrimaryEvidenceLink } from "@/lib/evidence-links";

test("getPrimaryEvidenceLink returns the first evidence item with a source URL", () => {
  const item = getPrimaryEvidenceLink({
    evidenceItems: [
      {
        source: "reddit",
        signalType: "social",
        timestamp: "2026-03-10T12:00:00Z",
        value: 10,
        evidence: "No link",
        evidenceUrl: null,
        geoFlags: [],
        geoCountryCode: null,
        geoRegion: null,
        geoDetectionMode: "unknown",
        geoConfidence: 0,
      },
      {
        source: "hacker_news",
        signalType: "social",
        timestamp: "2026-03-10T12:05:00Z",
        value: 20,
        evidence: "Story",
        evidenceUrl: "https://news.ycombinator.com/item?id=1",
        geoFlags: [],
        geoCountryCode: null,
        geoRegion: null,
        geoDetectionMode: "unknown",
        geoConfidence: 0,
      },
    ],
  });

  assert.equal(item?.source, "hacker_news");
  assert.equal(item?.evidenceUrl, "https://news.ycombinator.com/item?id=1");
});

test("getPrimaryEvidenceLink prefers stronger sources over wikipedia when both are present", () => {
  const item = getPrimaryEvidenceLink({
    evidenceItems: [
      {
        source: "wikipedia",
        signalType: "knowledge",
        timestamp: "2026-03-10T12:10:00Z",
        value: 1000,
        evidence: "Wikipedia page",
        evidenceUrl: "https://en.wikipedia.org/wiki/Test",
        geoFlags: [],
        geoCountryCode: null,
        geoRegion: null,
        geoDetectionMode: "unknown",
        geoConfidence: 0,
      },
      {
        source: "reddit",
        signalType: "social",
        timestamp: "2026-03-10T12:00:00Z",
        value: 20,
        evidence: "Reddit discussion",
        evidenceUrl: "https://reddit.com/test",
        geoFlags: [],
        geoCountryCode: null,
        geoRegion: null,
        geoDetectionMode: "unknown",
        geoConfidence: 0,
      },
    ],
  });

  assert.equal(item?.source, "reddit");
  assert.equal(item?.evidenceUrl, "https://reddit.com/test");
});

test("getPrimaryEvidenceLink uses value and recency to break ties within the same source", () => {
  const item = getPrimaryEvidenceLink({
    evidenceItems: [
      {
        source: "reddit",
        signalType: "social",
        timestamp: "2026-03-10T12:00:00Z",
        value: 12,
        evidence: "Older mention",
        evidenceUrl: "https://reddit.com/older",
        geoFlags: [],
        geoCountryCode: null,
        geoRegion: null,
        geoDetectionMode: "unknown",
        geoConfidence: 0,
      },
      {
        source: "reddit",
        signalType: "social",
        timestamp: "2026-03-10T12:05:00Z",
        value: 18,
        evidence: "Stronger mention",
        evidenceUrl: "https://reddit.com/stronger",
        geoFlags: [],
        geoCountryCode: null,
        geoRegion: null,
        geoDetectionMode: "unknown",
        geoConfidence: 0,
      },
    ],
  });

  assert.equal(item?.evidenceUrl, "https://reddit.com/stronger");
});
