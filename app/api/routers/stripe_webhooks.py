"""Stripe webhook handler for subscription lifecycle events."""

from __future__ import annotations

import os
import threading
from collections import OrderedDict
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.dependencies import get_db
from app.auth.profile_repository import ProfileRepository
from app.data.connection import DatabaseConnection

_processed_events: OrderedDict[str, None] = OrderedDict()
_processed_events_lock = threading.Lock()
_MAX_PROCESSED_EVENTS = 1000

router = APIRouter(tags=["webhooks"])


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Handle Stripe webhook events for subscription lifecycle."""

    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_id = event["id"]
    with _processed_events_lock:
        if event_id in _processed_events:
            return {"received": True}
        _processed_events[event_id] = None
        while len(_processed_events) > _MAX_PROCESSED_EVENTS:
            _processed_events.popitem(last=False)

    repo = ProfileRepository(db)
    event_type = event["type"]
    data_object = event["data"]["object"]

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(repo, data_object)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(repo, data_object)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(repo, data_object)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(repo, data_object)
    elif event_type == "invoice.paid":
        _handle_invoice_paid(repo, data_object)

    return {"received": True}


def _handle_checkout_completed(repo: ProfileRepository, session: dict) -> None:
    """Link Stripe customer to profile and activate Pro subscription."""

    supabase_uid = (session.get("metadata") or {}).get("supabase_uid")
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")

    if not supabase_uid or not customer_id:
        return

    repo.update_subscription(
        supabase_uid,
        account_tier="pro",
        subscription_status="active",
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
    )


def _handle_subscription_updated(repo: ProfileRepository, subscription: dict) -> None:
    """Sync subscription status and period end."""

    customer_id = subscription.get("customer")
    if not customer_id:
        return

    status = subscription.get("status", "active")
    period_end_ts = subscription.get("current_period_end")
    period_end = datetime.fromtimestamp(period_end_ts, tz=timezone.utc) if period_end_ts else None

    tier = "pro" if status in ("active", "trialing") else "free"

    repo.upsert_subscription_by_stripe_customer(
        customer_id,
        account_tier=tier,
        subscription_status=status,
        stripe_subscription_id=subscription.get("id"),
        current_period_end=period_end,
    )


def _handle_subscription_deleted(repo: ProfileRepository, subscription: dict) -> None:
    """Revert to free tier when subscription is canceled."""

    customer_id = subscription.get("customer")
    if not customer_id:
        return

    repo.upsert_subscription_by_stripe_customer(
        customer_id,
        account_tier="free",
        subscription_status="canceled",
        stripe_subscription_id=subscription.get("id"),
    )


def _handle_payment_failed(repo: ProfileRepository, invoice: dict) -> None:
    """Mark subscription as past_due on payment failure."""

    customer_id = invoice.get("customer")
    subscription_id = invoice.get("subscription")
    if not customer_id:
        return

    repo.upsert_subscription_by_stripe_customer(
        customer_id,
        account_tier="pro",
        subscription_status="past_due",
        stripe_subscription_id=subscription_id,
    )


def _handle_invoice_paid(repo: ProfileRepository, invoice: dict) -> None:
    """Ensure subscription is active after successful payment."""

    customer_id = invoice.get("customer")
    subscription_id = invoice.get("subscription")
    if not customer_id:
        return

    # Extract period end from the invoice lines if available
    period_end = None
    lines = invoice.get("lines", {}).get("data", [])
    if lines:
        period_end_ts = lines[0].get("period", {}).get("end")
        if period_end_ts:
            period_end = datetime.fromtimestamp(period_end_ts, tz=timezone.utc)

    repo.upsert_subscription_by_stripe_customer(
        customer_id,
        account_tier="pro",
        subscription_status="active",
        stripe_subscription_id=subscription_id,
        current_period_end=period_end,
    )
