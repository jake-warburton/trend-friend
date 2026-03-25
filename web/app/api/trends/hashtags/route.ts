import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export const revalidate = 172800;

export function resolveSocialDataClientConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = getSupabasePublicConfig(env);
  if (!config) {
    return null;
  }

  const accessKey =
    env.SIGNAL_EYE_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    config.publishableKey;

  return {
    url: config.url,
    accessKey,
  };
}

function createSocialDataClient() {
  const config = resolveSocialDataClientConfig();
  if (!config) {
    return null;
  }

  return createClient(config.url, config.accessKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET() {
  const supabase = createSocialDataClient();
  if (!supabase) {
    return NextResponse.json({ trends: [] });
  }

  const { data, error } = await supabase
    .from("twitter_trends")
    .select("name, category, location, tweet_volume, domain_context, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ trends: [], latestFetchedAt: null });
  }

  return NextResponse.json({
    trends: data ?? [],
    latestFetchedAt: data?.[0]?.fetched_at ?? null,
  });
}
