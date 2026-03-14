"""Billing API routes for Stripe subscription management."""

from __future__ import annotations

import os

import stripe
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db
from app.auth.middleware import get_current_profile
from app.auth.profile_repository import ProfileRepository
from app.data.connection import DatabaseConnection
from app.models import UserProfile

router = APIRouter(tags=["billing"])


def _get_stripe_client() -> stripe.StripeClient:
    secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    return stripe.StripeClient(secret_key)


@router.post("/billing/checkout")
def create_checkout_session(
    profile: UserProfile = Depends(get_current_profile),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Create a Stripe Checkout session for Pro subscription."""

    price_id = os.getenv("STRIPE_PRICE_ID_PRO_MONTHLY")
    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe price not configured")

    client = _get_stripe_client()

    # Reuse existing Stripe customer if available
    customer_id = profile.stripe_customer_id
    if not customer_id:
        customer = client.customers.create(params={"metadata": {"supabase_uid": profile.id}})
        customer_id = customer.id
        # Persist the customer ID
        repo = ProfileRepository(db)
        repo.update_subscription(
            profile.id,
            account_tier=profile.account_tier,
            subscription_status=profile.subscription_status,
            stripe_customer_id=customer_id,
        )

    frontend_url = os.getenv("SIGNAL_EYE_FRONTEND_URL", "http://localhost:3000")
    session = client.checkout.sessions.create(
        params={
            "customer": customer_id,
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": f"{frontend_url}/billing?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{frontend_url}/billing",
            "metadata": {"supabase_uid": profile.id},
        }
    )

    return {"url": session.url}


@router.post("/billing/portal")
def create_portal_session(
    profile: UserProfile = Depends(get_current_profile),
) -> dict:
    """Create a Stripe Customer Portal session to manage subscription."""

    if not profile.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active billing account")

    client = _get_stripe_client()
    frontend_url = os.getenv("SIGNAL_EYE_FRONTEND_URL", "http://localhost:3000")
    session = client.billing_portal.sessions.create(
        params={
            "customer": profile.stripe_customer_id,
            "return_url": f"{frontend_url}/billing",
        }
    )

    return {"url": session.url}


@router.get("/billing/status")
def get_billing_status(
    profile: UserProfile = Depends(get_current_profile),
) -> dict:
    """Return the current subscription status."""

    return {
        "accountTier": profile.account_tier,
        "subscriptionStatus": profile.subscription_status,
        "currentPeriodEnd": profile.current_period_end.isoformat() if profile.current_period_end else None,
        "stripeCustomerId": profile.stripe_customer_id,
    }
