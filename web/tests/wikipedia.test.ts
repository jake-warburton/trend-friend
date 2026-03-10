import assert from "node:assert/strict";
import test from "node:test";

import { buildWikipediaUrl, getWikipediaLinkFromDetail } from "@/lib/wikipedia";

test("buildWikipediaUrl encodes titles as article links", () => {
  assert.equal(
    buildWikipediaUrl("Sales strategy"),
    "https://en.wikipedia.org/wiki/Sales_strategy",
  );
});

test("getWikipediaLinkFromDetail returns the first wikipedia evidence link", () => {
  assert.deepEqual(
    getWikipediaLinkFromDetail({
      evidenceItems: [
        {
          source: "reddit",
          signalType: "social",
          timestamp: "2026-03-10T12:00:00Z",
          value: 10,
          evidence: "Reddit thread",
          evidenceUrl: null,
          geoFlags: [],
          geoCountryCode: null,
          geoRegion: null,
          geoDetectionMode: "unknown",
          geoConfidence: 0,
        },
        {
          source: "wikipedia",
          signalType: "knowledge",
          timestamp: "2026-03-10T12:00:00Z",
          value: 100,
          evidence: "Sales strategy",
          evidenceUrl: "https://en.wikipedia.org/wiki/Sales_strategy",
          geoFlags: [],
          geoCountryCode: null,
          geoRegion: null,
          geoDetectionMode: "unknown",
          geoConfidence: 0,
        },
      ],
    }),
    {
      title: "Sales strategy",
      url: "https://en.wikipedia.org/wiki/Sales_strategy",
    },
  );
});
