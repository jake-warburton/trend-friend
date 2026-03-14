import assert from "node:assert/strict";
import test from "node:test";

import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";

// Note: These tests exercise the legacy fallback path since Supabase
// server client is not available in the test environment (cookies() throws).

test("buildForwardedAuthHeaders returns undefined when no auth headers present", async () => {
  const request = new Request("http://localhost/api/test");
  const result = await buildForwardedAuthHeaders(request);
  assert.equal(result, undefined);
});

test("buildForwardedAuthHeaders forwards cookie header", async () => {
  const request = new Request("http://localhost/api/test", {
    headers: { cookie: "session=abc123" },
  });
  const result = (await buildForwardedAuthHeaders(request)) as Record<string, string>;
  assert.equal(result.cookie, "session=abc123");
  assert.equal(result.authorization, undefined);
});

test("buildForwardedAuthHeaders forwards authorization header", async () => {
  const request = new Request("http://localhost/api/test", {
    headers: { authorization: "Bearer tok_123" },
  });
  const result = (await buildForwardedAuthHeaders(request)) as Record<string, string>;
  assert.equal(result.authorization, "Bearer tok_123");
  assert.equal(result.cookie, undefined);
});

test("buildForwardedAuthHeaders forwards both headers when present", async () => {
  const request = new Request("http://localhost/api/test", {
    headers: { cookie: "session=abc", authorization: "Bearer tok" },
  });
  const result = (await buildForwardedAuthHeaders(request)) as Record<string, string>;
  assert.equal(result.cookie, "session=abc");
  assert.equal(result.authorization, "Bearer tok");
});
