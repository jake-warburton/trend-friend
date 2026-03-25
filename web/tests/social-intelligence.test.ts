import assert from "node:assert/strict";
import test from "node:test";

import { resolveSocialDataClientConfig } from "@/app/api/trends/hashtags/route";
import { formatSocialTimestamp } from "@/components/social-intelligence-dashboard";

test("resolveSocialDataClientConfig prefers the service role key", () => {
  const config = resolveSocialDataClientConfig({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    SIGNAL_EYE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  });

  assert.deepEqual(config, {
    url: "https://example.supabase.co",
    accessKey: "service-role-key",
  });
});

test("resolveSocialDataClientConfig falls back to the publishable key", () => {
  const config = resolveSocialDataClientConfig({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  });

  assert.deepEqual(config, {
    url: "https://example.supabase.co",
    accessKey: "publishable-key",
  });
});

test("resolveSocialDataClientConfig returns null without Supabase config", () => {
  assert.equal(resolveSocialDataClientConfig({}), null);
});

test("formatSocialTimestamp returns a readable date label", () => {
  assert.equal(
    formatSocialTimestamp("2026-03-25T20:22:56.143962Z"),
    "25 Mar 2026, 20:22",
  );
});

test("formatSocialTimestamp returns null for empty or invalid input", () => {
  assert.equal(formatSocialTimestamp(null), null);
  assert.equal(formatSocialTimestamp("not-a-date"), null);
});
