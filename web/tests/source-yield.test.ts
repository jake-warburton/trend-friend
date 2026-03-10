import assert from "node:assert/strict";
import test from "node:test";

import { classifySourceYield, describeSourceYield, summarizeSourceYield } from "@/lib/source-yield";

test("summarizeSourceYield reports kept versus raw counts with a quality label", () => {
  assert.equal(
    summarizeSourceYield({ rawItemCount: 15, keptItemCount: 10, yieldRatePercent: 66.7 }),
    "10/15 kept (66.7%) · Mixed",
  );
});

test("describeSourceYield handles missing raw volume", () => {
  assert.equal(
    describeSourceYield({ rawItemCount: 0, keptItemCount: 0, yieldRatePercent: 0 }),
    "No raw item volume recorded yet.",
  );
});

test("classifySourceYield buckets source efficiency conservatively", () => {
  assert.equal(classifySourceYield({ rawItemCount: 10, yieldRatePercent: 80 }), "Strong");
  assert.equal(classifySourceYield({ rawItemCount: 10, yieldRatePercent: 55 }), "Mixed");
  assert.equal(classifySourceYield({ rawItemCount: 10, yieldRatePercent: 20 }), "Thin");
  assert.equal(classifySourceYield({ rawItemCount: 0, yieldRatePercent: 0 }), "No data");
});
