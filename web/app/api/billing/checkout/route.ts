import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/server/stripe";

export async function POST() {
  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
  if (!priceId) {
    return NextResponse.json({ error: "Stripe price not configured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const stripe = getStripeClient();
  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_uid: user.id },
    });
    customerId = customer.id;

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const frontendUrl = process.env.SIGNAL_EYE_FRONTEND_URL ?? "https://signaleye.live";
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${frontendUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/pricing`,
    metadata: { supabase_uid: user.id },
  });

  return NextResponse.json({ url: session.url });
}
