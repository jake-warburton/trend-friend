import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as getHashtagTrends } from "@/app/api/trends/hashtags/route";
import { middleware } from "@/middleware";
import { requireAuth } from "@/lib/server/require-pro";
import {
  getSupabasePublicConfig,
  isSupabaseConfigured,
  SUPABASE_NOT_CONFIGURED_MESSAGE,
} from "@/lib/supabase/config";

const SUPABASE_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

async function withSupabaseEnv(
  overrides: Partial<Record<(typeof SUPABASE_ENV_KEYS)[number], string | undefined>>,
  run: () => Promise<void>,
) {
  const previousValues = new Map<string, string | undefined>();

  for (const key of SUPABASE_ENV_KEYS) {
    previousValues.set(key, process.env[key]);
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await run();
  } finally {
    for (const key of SUPABASE_ENV_KEYS) {
      const previousValue = previousValues.get(key);
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }
  }
}

test("supabase config helper reports missing public env values", async () => {
  await withSupabaseEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    },
    async () => {
      assert.equal(isSupabaseConfigured(), false);
      assert.equal(getSupabasePublicConfig(), null);
    },
  );
});

test("middleware bypasses auth when Supabase env is missing", async () => {
  await withSupabaseEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    },
    async () => {
      const response = await middleware(new NextRequest("http://localhost/admin"));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("location"), null);
    },
  );
});

test("requireAuth returns a 503 when Supabase env is missing", async () => {
  await withSupabaseEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    },
    async () => {
      const result = await requireAuth();

      assert.equal(result.authorized, false);
      if (result.authorized) {
        assert.fail("expected authorization to fail without Supabase config");
      }

      assert.equal(result.response.status, 503);
      assert.deepEqual(await result.response.json(), {
        error: SUPABASE_NOT_CONFIGURED_MESSAGE,
      });
    },
  );
});

test("hashtags route returns an empty payload when Supabase env is missing", async () => {
  await withSupabaseEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    },
    async () => {
      const response = await getHashtagTrends();

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { trends: [] });
    },
  );
});
