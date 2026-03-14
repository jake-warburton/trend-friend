"""Tests for authentication middleware permission dependencies."""

from __future__ import annotations

import sqlite3
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import HTTPException

from app.auth.passwords import hash_password
from app.auth.repository import UserRepository
from app.auth.tokens import generate_api_key
from app.data.database import initialize_database
from app.models import UserProfile


def _apply_migration_0014(connection: sqlite3.Connection) -> None:
    """Apply the profiles/supabase_uid migration for test databases."""
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL DEFAULT '',
            username TEXT UNIQUE,
            is_admin INTEGER NOT NULL DEFAULT 0,
            account_tier TEXT NOT NULL DEFAULT 'free',
            stripe_customer_id TEXT UNIQUE,
            stripe_subscription_id TEXT,
            subscription_status TEXT NOT NULL DEFAULT 'none',
            current_period_end TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    # supabase_uid may already exist if the migration was registered.
    # SQLite on some platforms doesn't support ADD COLUMN ... UNIQUE,
    # so add the column plain and create a unique index separately.
    try:
        connection.execute("ALTER TABLE users ADD COLUMN supabase_uid TEXT")
        connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid)")
        connection.commit()
    except sqlite3.OperationalError:
        pass


def _make_profile(
    *,
    id: str = "test-user",
    is_admin: bool = False,
    account_tier: str = "free",
    subscription_status: str = "none",
) -> UserProfile:
    now = datetime.now(timezone.utc)
    return UserProfile(
        id=id,
        display_name="Test",
        username="test",
        is_admin=is_admin,
        account_tier=account_tier,
        stripe_customer_id=None,
        stripe_subscription_id=None,
        subscription_status=subscription_status,
        current_period_end=None,
        created_at=now,
        updated_at=now,
    )


class RequireProTests(unittest.TestCase):
    """Test require_pro permission dependency."""

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_blocks_free_non_admin(self) -> None:
        from app.auth.middleware import require_pro

        profile = _make_profile(is_admin=False, account_tier="free")
        with self.assertRaises(HTTPException) as ctx:
            require_pro(profile)
        self.assertEqual(ctx.exception.status_code, 403)

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_allows_admin_on_free_tier(self) -> None:
        from app.auth.middleware import require_pro

        profile = _make_profile(id="admin", is_admin=True, account_tier="free")
        result = require_pro(profile)
        self.assertEqual(result.id, "admin")

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_allows_active_pro(self) -> None:
        from app.auth.middleware import require_pro

        profile = _make_profile(
            id="pro-user",
            is_admin=False,
            account_tier="pro",
            subscription_status="active",
        )
        result = require_pro(profile)
        self.assertEqual(result.id, "pro-user")

    def test_returns_synthetic_when_auth_disabled(self) -> None:
        from app.auth.middleware import require_pro

        result = require_pro(None)
        self.assertTrue(result.is_admin)
        self.assertEqual(result.account_tier, "pro")


class RequireOwnerTests(unittest.TestCase):
    """Test require_owner permission dependency."""

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_allows_admin(self) -> None:
        from app.auth.middleware import require_owner

        profile = _make_profile(id="admin", is_admin=True)
        result = require_owner(profile)
        self.assertEqual(result.id, "admin")

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_blocks_non_admin(self) -> None:
        from app.auth.middleware import require_owner

        profile = _make_profile(is_admin=False, account_tier="pro", subscription_status="active")
        with self.assertRaises(HTTPException) as ctx:
            require_owner(profile)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_returns_synthetic_when_auth_disabled(self) -> None:
        from app.auth.middleware import require_owner

        result = require_owner(None)
        self.assertTrue(result.is_admin)


class GetCurrentProfileAPIKeyTests(unittest.TestCase):
    """Test that get_current_profile works with API key auth."""

    def setUp(self) -> None:
        from fastapi.testclient import TestClient
        from app.api.main import create_app
        from app.api.dependencies import get_db

        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        _apply_migration_0014(self.connection)

        self.app = create_app()

        def override_db() -> sqlite3.Connection:
            return self.connection

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

        from app.api.rate_limit import response_cache
        response_cache.clear()

    def tearDown(self) -> None:
        self.connection.close()

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_profile_endpoint_with_api_key_no_linked_profile(self) -> None:
        """API key user without a linked Supabase profile gets a minimal profile."""
        repo = UserRepository(self.connection)
        user = repo.create_user("apiuser", hash_password("pw"), "API User")

        full_key, prefix, key_hash = generate_api_key()
        repo.create_api_key(user.id, key_hash, prefix, "test-key")

        response = self.client.get(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {full_key}"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["accountTier"], "free")
        self.assertFalse(data["isAdmin"])

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_profile_endpoint_with_api_key_linked_profile(self) -> None:
        """API key user with a linked Supabase profile gets the real profile."""
        repo = UserRepository(self.connection)
        user = repo.create_user("linkeduser", hash_password("pw"), "Linked User")

        supabase_uid = "supabase-linked"
        self.connection.execute(
            "UPDATE users SET supabase_uid = ? WHERE id = ?",
            (supabase_uid, user.id),
        )
        self.connection.execute(
            """INSERT INTO profiles (id, display_name, username, is_admin, account_tier,
               subscription_status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (supabase_uid, "Linked User", "linkeduser", True, "pro", "active"),
        )
        self.connection.commit()

        full_key, prefix, key_hash = generate_api_key()
        repo.create_api_key(user.id, key_hash, prefix, "test-key")

        response = self.client.get(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {full_key}"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["accountTier"], "pro")
        self.assertTrue(data["isAdmin"])


if __name__ == "__main__":
    unittest.main()
