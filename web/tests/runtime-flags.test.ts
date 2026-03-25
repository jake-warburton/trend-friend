import assert from "node:assert/strict";
import test from "node:test";

import {
  isBreakingFeedAutoRefreshEnabled,
  isDashboardAutoRefreshEnabled,
  isServerRefreshLoopEnabled,
} from "@/lib/runtime-flags";

test("runtime flags default to disabled", () => {
  assert.equal(isServerRefreshLoopEnabled({}), false);
  assert.equal(isDashboardAutoRefreshEnabled({}), false);
  assert.equal(isBreakingFeedAutoRefreshEnabled({}), false);
});

test("runtime flags only enable on explicit true values", () => {
  assert.equal(
    isServerRefreshLoopEnabled({
      SIGNAL_EYE_ENABLE_SERVER_REFRESH_LOOP: "true",
    }),
    true,
  );
  assert.equal(
    isDashboardAutoRefreshEnabled({
      NEXT_PUBLIC_SIGNAL_EYE_ENABLE_DASHBOARD_POLLING: "true",
    }),
    true,
  );
  assert.equal(
    isBreakingFeedAutoRefreshEnabled({
      NEXT_PUBLIC_SIGNAL_EYE_ENABLE_BREAKING_FEED_POLLING: "true",
    }),
    true,
  );
  assert.equal(
    isDashboardAutoRefreshEnabled({
      NEXT_PUBLIC_SIGNAL_EYE_ENABLE_DASHBOARD_POLLING: "1",
    }),
    false,
  );
});
