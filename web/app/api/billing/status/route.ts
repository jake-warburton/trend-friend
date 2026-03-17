import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/server/stripe";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_tier, subscription_status, current_period_end, stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .single();

    let cancelAtPeriodEnd = false;
    if (profile?.stripe_subscription_id) {
      try {
        const stripe = getStripeClient();
        const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        cancelAtPeriodEnd = sub.cancel_at_period_end;
      } catch {
        // subscription may no longer exist — treat as not canceling
      }
    }

    return NextResponse.json({
      accountTier: profile?.account_tier ?? "free",
      subscriptionStatus: profile?.subscription_status ?? "none",
      currentPeriodEnd: profile?.current_period_end ?? null,
      cancelAtPeriodEnd,
    });
  } catch (err) {
    console.error("[billing/status] error:", err);
    return NextResponse.json({ error: "Failed to load billing status" }, { status: 500 });
  }
}
