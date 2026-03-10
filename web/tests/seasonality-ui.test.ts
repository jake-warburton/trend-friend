import assert from "node:assert/strict";
import test from "node:test";

import { getSeasonalityBadge, isRecurringTrend, summarizeSeasonality } from "@/lib/seasonality-ui";

test("seasonality UI helpers expose readable recurring and evergreen labels", () => {
  assert.deepEqual(
    getSeasonalityBadge({
      tag: "recurring",
      recurrenceCount: 2,
      avgGapRuns: 3.5,
      confidence: 0.82,
    }),
    { label: "Recurring", tone: "recurring" },
  );
  assert.deepEqual(
    getSeasonalityBadge({
      tag: "evergreen",
      recurrenceCount: 0,
      avgGapRuns: 0.5,
      confidence: 0.9,
    }),
    { label: "Evergreen", tone: "evergreen" },
  );
  assert.equal(getSeasonalityBadge(null), null);
});

test("seasonality UI helpers summarize recurrence and support recurring filters", () => {
  const recurring = {
    tag: "recurring" as const,
    recurrenceCount: 2,
    avgGapRuns: 3.5,
    confidence: 0.82,
  };

  assert.equal(summarizeSeasonality(recurring), "2 reappearances after gaps averaging 3.5 runs");
  assert.equal(isRecurringTrend(recurring), true);
  assert.equal(
    summarizeSeasonality({
      tag: "evergreen",
      recurrenceCount: 0,
      avgGapRuns: 0.4,
      confidence: 0.91,
    }),
    "Consistent presence across recent runs",
  );
});
