"""Profile persistence for Supabase-authenticated users."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping

from app.data.connection import DatabaseConnection
from app.models import UserProfile

RowMapping = Mapping[str, Any]


class ProfileRepository:
    """Persist and retrieve Supabase user profiles."""

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def get_profile_by_id(self, profile_id: str) -> UserProfile | None:
        """Return a profile by Supabase user UUID."""

        row = self.connection.execute(
            """
            SELECT id, display_name, username, is_admin, account_tier,
                   stripe_customer_id, stripe_subscription_id,
                   subscription_status, current_period_end,
                   created_at, updated_at
            FROM profiles WHERE id = ?
            """,
            (profile_id,),
        ).fetchone()
        if row is None:
            return None
        return self._profile_from_row(row)

    def get_profile_by_stripe_customer_id(self, stripe_customer_id: str) -> UserProfile | None:
        """Return a profile by Stripe customer ID."""

        row = self.connection.execute(
            """
            SELECT id, display_name, username, is_admin, account_tier,
                   stripe_customer_id, stripe_subscription_id,
                   subscription_status, current_period_end,
                   created_at, updated_at
            FROM profiles WHERE stripe_customer_id = ?
            """,
            (stripe_customer_id,),
        ).fetchone()
        if row is None:
            return None
        return self._profile_from_row(row)

    def update_profile(self, profile_id: str, display_name: str | None = None, username: str | None = None) -> None:
        """Update mutable profile fields."""

        parts: list[str] = []
        params: list[Any] = []
        if display_name is not None:
            parts.append("display_name = ?")
            params.append(display_name)
        if username is not None:
            parts.append("username = ?")
            params.append(username)
        if not parts:
            return
        parts.append("updated_at = CURRENT_TIMESTAMP")
        params.append(profile_id)
        self.connection.execute(
            f"UPDATE profiles SET {', '.join(parts)} WHERE id = ?",
            tuple(params),
        )
        self.connection.commit()

    def update_subscription(
        self,
        profile_id: str,
        *,
        account_tier: str,
        subscription_status: str,
        stripe_customer_id: str | None = None,
        stripe_subscription_id: str | None = None,
        current_period_end: datetime | None = None,
    ) -> None:
        """Update subscription-related fields (called by Stripe webhooks)."""

        self.connection.execute(
            """
            UPDATE profiles
            SET account_tier = ?,
                subscription_status = ?,
                stripe_customer_id = ?,
                stripe_subscription_id = ?,
                current_period_end = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                account_tier,
                subscription_status,
                stripe_customer_id,
                stripe_subscription_id,
                current_period_end.isoformat() if current_period_end else None,
                profile_id,
            ),
        )
        self.connection.commit()

    def upsert_subscription_by_stripe_customer(
        self,
        stripe_customer_id: str,
        *,
        account_tier: str,
        subscription_status: str,
        stripe_subscription_id: str | None = None,
        current_period_end: datetime | None = None,
    ) -> None:
        """Update subscription fields by Stripe customer ID (idempotent webhook handler)."""

        self.connection.execute(
            """
            UPDATE profiles
            SET account_tier = ?,
                subscription_status = ?,
                stripe_subscription_id = ?,
                current_period_end = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE stripe_customer_id = ?
            """,
            (
                account_tier,
                subscription_status,
                stripe_subscription_id,
                current_period_end.isoformat() if current_period_end else None,
                stripe_customer_id,
            ),
        )
        self.connection.commit()

    @staticmethod
    def _profile_from_row(row: RowMapping) -> UserProfile:
        return UserProfile(
            id=str(row["id"]),
            display_name=row["display_name"],
            username=row["username"],
            is_admin=bool(row["is_admin"]),
            account_tier=row["account_tier"],
            stripe_customer_id=row["stripe_customer_id"],
            stripe_subscription_id=row["stripe_subscription_id"],
            subscription_status=row["subscription_status"],
            current_period_end=(
                datetime.fromisoformat(row["current_period_end"]) if row["current_period_end"] else None
            ),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )
