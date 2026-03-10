import assert from "node:assert/strict";
import test from "node:test";

import { handleAuthLoginPost } from "@/app/api/auth/login/route";
import { handleAuthMeGet } from "@/app/api/auth/me/route";
import { handleAuthLogoutPost } from "@/app/api/auth/logout/route";

test("auth me route returns auth status from the service", async () => {
  const response = await handleAuthMeGet(
    new Request("http://localhost/api/auth/me", {
      headers: { cookie: "tf_session=session-token" },
    }),
    {
      getCurrentUser: async (headers) => ({
        authEnabled: true,
        user: headers ? {
          id: 1,
          username: "jake",
          displayName: "Jake",
          isAdmin: false,
          createdAt: "2026-03-10T12:00:00Z",
        } : null,
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authEnabled: true,
    user: {
      id: 1,
      username: "jake",
      displayName: "Jake",
      isAdmin: false,
      createdAt: "2026-03-10T12:00:00Z",
    },
  });
});

test("auth login route sets the session cookie", async () => {
  const response = await handleAuthLoginPost(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "jake", password: "password123" }),
    }),
    {
      loginUser: async () => ({
        token: "session-token",
        user: {
          id: 1,
          username: "jake",
          displayName: "Jake",
          isAdmin: false,
          createdAt: "2026-03-10T12:00:00Z",
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /tf_session=session-token/);
});

test("auth logout route clears the session cookie", async () => {
  const response = await handleAuthLogoutPost(
    new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: "tf_session=session-token" },
    }),
    {
      logoutUser: async () => ({ ok: true }),
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /tf_session=;/);
});
