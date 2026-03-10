import assert from "node:assert/strict";
import test from "node:test";

import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";

test("buildForwardedAuthHeaders returns undefined when no auth headers present", () => {
  const request = new Request("http://localhost/api/test");
  const result = buildForwardedAuthHeaders(request);
  assert.equal(result, undefined);
});

test("buildForwardedAuthHeaders forwards cookie header", () => {
  const request = new Request("http://localhost/api/test", {
    headers: { cookie: "session=abc123" },
  });
  const result = buildForwardedAuthHeaders(request) as Record<string, string>;
  assert.equal(result.cookie, "session=abc123");
  assert.equal(result.authorization, undefined);
});

test("buildForwardedAuthHeaders forwards authorization header", () => {
  const request = new Request("http://localhost/api/test", {
    headers: { authorization: "Bearer tok_123" },
  });
  const result = buildForwardedAuthHeaders(request) as Record<string, string>;
  assert.equal(result.authorization, "Bearer tok_123");
  assert.equal(result.cookie, undefined);
});

test("buildForwardedAuthHeaders forwards both headers when present", () => {
  const request = new Request("http://localhost/api/test", {
    headers: { cookie: "session=abc", authorization: "Bearer tok" },
  });
  const result = buildForwardedAuthHeaders(request) as Record<string, string>;
  assert.equal(result.cookie, "session=abc");
  assert.equal(result.authorization, "Bearer tok");
});
