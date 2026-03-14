import assert from "node:assert/strict";
import test from "node:test";

// The old login/register/logout routes have been removed in favor of
// Supabase client-side auth. The /auth/me route now delegates to
// Supabase server client. These tests verify the route module exports
// are still present and the module can be loaded.

test("auth me route module exports GET handler", async () => {
  const mod = await import("@/app/api/auth/me/route");
  assert.equal(typeof mod.GET, "function");
});
