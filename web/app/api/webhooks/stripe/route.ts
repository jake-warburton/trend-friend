import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

/**
 * Stripe webhook handler.
 *
 * Uses a Supabase service-role client (not the per-user cookie client)
 * because webhook requests come from Stripe, not an authenticated user.
 */

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SIGNAL_EYE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role config missing");
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.supabase_uid;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      if (uid && customerId) {
        await supabase
          .from("profiles")
          .update({
            account_tier: "pro",
            subscription_status: "active",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", uid);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const status = subscription.status;
      const tier = status === "active" || status === "trialing" ? "pro" : "free";
      // current_period_end removed in newer Stripe API; extract from raw data
      const rawSub = event.data.object as unknown as Record<string, unknown>;
      const periodEndTs = rawSub.current_period_end as number | undefined;
      const periodEnd = periodEndTs
        ? new Date(periodEndTs * 1000).toISOString()
        : null;

      await supabase
        .from("profiles")
        .update({
          account_tier: tier,
          subscription_status: status,
          stripe_subscription_id: subscription.id,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      await supabase
        .from("profiles")
        .update({
          account_tier: "free",
          subscription_status: "canceled",
          stripe_subscription_id: subscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await supabase
        .from("profiles")
        .update({
          subscription_status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const lines = invoice.lines?.data ?? [];
      const periodEnd = lines[0]?.period?.end
        ? new Date(lines[0].period.end * 1000).toISOString()
        : null;
      await supabase
        .from("profiles")
        .update({
          account_tier: "pro",
          subscription_status: "active",
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
