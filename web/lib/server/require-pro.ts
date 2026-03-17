import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProCheckResult =
  | { authorized: true; userId: string }
  | { authorized: false; response: NextResponse };

export async function requirePro(): Promise<ProCheckResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_tier, is_admin, subscription_status")
    .eq("id", user.id)
    .single();

  const isPro =
    profile?.is_admin ||
    (profile?.account_tier === "pro" &&
      (profile?.subscription_status === "active" || profile?.subscription_status === "trialing"));

  if (!isPro) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Pro subscription required" }, { status: 403 }),
    };
  }

  return { authorized: true, userId: user.id };
}

export async function requireAuth(): Promise<ProCheckResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  return { authorized: true, userId: user.id };
}
