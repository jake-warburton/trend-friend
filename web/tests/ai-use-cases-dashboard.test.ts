import assert from "node:assert/strict";
import test from "node:test";

import { canAccessAiUseCasesDashboard } from "@/components/ai-use-cases-dashboard";

test("canAccessAiUseCasesDashboard allows screenshot mode regardless of auth", () => {
  assert.equal(
    canAccessAiUseCasesDashboard({
      isScreenshot: true,
      isPro: false,
      authLoading: true,
      profileLoading: true,
    }),
    true,
  );
});

test("canAccessAiUseCasesDashboard requires a settled Pro profile for normal access", () => {
  assert.equal(
    canAccessAiUseCasesDashboard({
      isScreenshot: false,
      isPro: true,
      authLoading: false,
      profileLoading: false,
    }),
    true,
  );

  assert.equal(
    canAccessAiUseCasesDashboard({
      isScreenshot: false,
      isPro: true,
      authLoading: true,
      profileLoading: false,
    }),
    false,
  );

  assert.equal(
    canAccessAiUseCasesDashboard({
      isScreenshot: false,
      isPro: false,
      authLoading: false,
      profileLoading: false,
    }),
    false,
  );
});
