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
