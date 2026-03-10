import assert from "node:assert/strict";
import test from "node:test";

import {
  formatForecastConfidence,
  formatForecastMethod,
  getExplorerForecastBadge,
  summarizeForecastWindow,
} from "@/lib/forecast-ui";

test("forecast UI helpers expose explorer badge and readable labels", () => {
  assert.deepEqual(getExplorerForecastBadge("accelerating"), {
    label: "Predicted breakout",
    tone: "high",
  });
  assert.deepEqual(getExplorerForecastBadge("decelerating"), {
    label: "Cooling ahead",
    tone: "medium",
  });
  assert.deepEqual(getExplorerForecastBadge("stable"), {
    label: "Holding steady",
    tone: "low",
  });
  assert.equal(getExplorerForecastBadge("steady"), null);
  assert.equal(formatForecastConfidence("medium"), "Medium");
  assert.equal(formatForecastMethod("holt"), "Holt trend");
});

test("summarizeForecastWindow returns a compact readable forecast summary", () => {
  assert.equal(
    summarizeForecastWindow({
      predictedScores: [48.2, 51.1, 54.6, 57.8, 61.4],
      confidence: "medium",
      mape: 13.7,
      method: "holt",
    }),
    "Next 5 runs · Medium confidence · Holt trend",
  );
  assert.equal(summarizeForecastWindow(null), "No forecast available");
});
