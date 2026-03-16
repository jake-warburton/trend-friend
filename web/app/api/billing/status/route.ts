import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_tier, subscription_status, current_period_end, stripe_customer_id")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    accountTier: profile?.account_tier ?? "free",
    subscriptionStatus: profile?.subscription_status ?? "none",
    currentPeriodEnd: profile?.current_period_end ?? null,
    stripeCustomerId: profile?.stripe_customer_id ?? null,
  });
}
