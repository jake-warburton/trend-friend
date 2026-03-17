import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 120;

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("twitter_trends")
    .select("name, category, location, tweet_volume, domain_context, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ trends: [] });
  }

  return NextResponse.json({ trends: data ?? [] });
}
