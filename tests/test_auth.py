"""Tests for authentication system."""

from __future__ import annotations

import os
import sqlite3
import unittest
from unittest.mock import patch

from app.auth.passwords import hash_password, verify_password
from app.auth.tokens import generate_api_key, generate_session_token, hash_api_key
from app.auth.repository import UserRepository
from app.data.database import initialize_database


class PasswordTests(unittest.TestCase):
    """Test password hashing and verification."""

    def test_hash_and_verify(self) -> None:
        hashed = hash_password("my-secure-password")
        is_valid, needs_rehash = verify_password("my-secure-password", hashed)
        self.assertTrue(is_valid)
        self.assertFalse(needs_rehash)

    def test_wrong_password_fails(self) -> None:
        hashed = hash_password("my-secure-password")
        is_valid, needs_rehash = verify_password("wrong-password", hashed)
        self.assertFalse(is_valid)
        self.assertFalse(needs_rehash)

    def test_different_hashes_per_call(self) -> None:
        h1 = hash_password("same-password")
        h2 = hash_password("same-password")
        self.assertNotEqual(h1, h2)  # different salts

    def test_pbkdf2_format(self) -> None:
        hashed = hash_password("test-password")
        self.assertTrue(hashed.startswith("pbkdf2$"))
        parts = hashed.split("$")
        self.assertEqual(len(parts), 4)

    def test_legacy_sha256_verify(self) -> None:
        """Verify that legacy SHA-256 hashes still work and flag rehash."""
        import hashlib as _hashlib
        import os as _os

        salt = _os.urandom(16).hex()
        digest = _hashlib.sha256(f"{salt}:legacy-password".encode()).hexdigest()
        legacy_hash = f"{salt}:{digest}"

        is_valid, needs_rehash = verify_password("legacy-password", legacy_hash)
        self.assertTrue(is_valid)
        self.assertTrue(needs_rehash)

    def test_legacy_sha256_wrong_password(self) -> None:
        import hashlib as _hashlib
        import os as _os

        salt = _os.urandom(16).hex()
        digest = _hashlib.sha256(f"{salt}:legacy-password".encode()).hexdigest()
        legacy_hash = f"{salt}:{digest}"

        is_valid, needs_rehash = verify_password("wrong-password", legacy_hash)
        self.assertFalse(is_valid)
        self.assertFalse(needs_rehash)

    def test_dummy_verify_runs_pbkdf2(self) -> None:
        """dummy_verify must exercise PBKDF2 so timing matches real verify."""
        from app.auth.passwords import _dummy_verify
        _dummy_verify("some-password")


class TokenTests(unittest.TestCase):
    """Test token and API key generation."""

    def test_session_token_is_unique(self) -> None:
        t1 = generate_session_token()
        t2 = generate_session_token()
        self.assertNotEqual(t1, t2)
        self.assertGreater(len(t1), 20)

    def test_api_key_format(self) -> None:
        full_key, prefix, key_hash = generate_api_key()
        self.assertTrue(full_key.startswith("tf_"))
        self.assertEqual(len(prefix), 8)
        self.assertEqual(len(key_hash), 64)  # SHA-256 hex digest

    def test_api_key_hash_matches(self) -> None:
        full_key, _, expected_hash = generate_api_key()
        self.assertEqual(hash_api_key(full_key), expected_hash)


class UserRepositoryTests(unittest.TestCase):
    """Test user and API key persistence."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.repo = UserRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_create_and_get_user(self) -> None:
        user = self.repo.create_user(
            username="testuser",
            password_hash=hash_password("password123"),
            display_name="Test User",
        )
        self.assertEqual(user.username, "testuser")
        self.assertEqual(user.display_name, "Test User")
        self.assertFalse(user.is_admin)

        fetched = self.repo.get_user_by_username("testuser")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.id, user.id)

    def test_create_admin_user(self) -> None:
        user = self.repo.create_user(
            username="admin",
            password_hash=hash_password("admin123"),
            display_name="Admin",
            is_admin=True,
        )
        self.assertTrue(user.is_admin)

    def test_duplicate_username_fails(self) -> None:
        self.repo.create_user("testuser", hash_password("pw"), "User 1")
        with self.assertRaises(Exception):
            self.repo.create_user("testuser", hash_password("pw"), "User 2")

    def test_create_and_list_api_keys(self) -> None:
        user = self.repo.create_user("testuser", hash_password("pw"), "User")
        full_key, prefix, key_hash = generate_api_key()
        api_key = self.repo.create_api_key(
            user_id=user.id,
            key_hash=key_hash,
            key_prefix=prefix,
            name="My Key",
        )
        self.assertEqual(api_key.name, "My Key")
        self.assertFalse(api_key.revoked)

        keys = self.repo.list_api_keys(user.id)
        self.assertEqual(len(keys), 1)

    def test_api_key_lookup_by_hash(self) -> None:
        user = self.repo.create_user("testuser", hash_password("pw"), "User")
        full_key, prefix, key_hash = generate_api_key()
        self.repo.create_api_key(user.id, key_hash, prefix, "Key")

        found = self.repo.get_api_key_by_hash(key_hash)
        self.assertIsNotNone(found)
        self.assertEqual(found.key_hash, key_hash)

    def test_revoked_key_not_found(self) -> None:
        user = self.repo.create_user("testuser", hash_password("pw"), "User")
        _, prefix, key_hash = generate_api_key()
        api_key = self.repo.create_api_key(user.id, key_hash, prefix, "Key")
        self.repo.revoke_api_key(api_key.id)

        found = self.repo.get_api_key_by_hash(key_hash)
        self.assertIsNone(found)


class AuthAPITests(unittest.TestCase):
    """Test the auth API endpoints."""

    def setUp(self) -> None:
        from fastapi.testclient import TestClient
        from app.api.main import create_app
        from app.api.dependencies import get_db

        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)

        self.app = create_app()

        def override_db() -> sqlite3.Connection:
            return self.connection

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)
        # Use development mode so secure cookies work over HTTP in tests
        os.environ["SIGNAL_EYE_ENVIRONMENT"] = "development"

        from app.api.rate_limit import response_cache
        response_cache.clear()

    def tearDown(self) -> None:
        self.connection.close()

    def test_register_user(self) -> None:
        response = self.client.post(
            "/api/v1/auth/register",
            json={"username": "newuser", "password": "password123", "displayName": "New User"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["user"]["username"], "newuser")
        self.assertTrue(data["user"]["isAdmin"])  # first user is admin
        self.assertIn("token", data)

    def test_register_duplicate_fails(self) -> None:
        self.client.post("/api/v1/auth/register", json={"username": "user1", "password": "password123"})
        response = self.client.post("/api/v1/auth/register", json={"username": "user1", "password": "password456"})
        self.assertEqual(response.status_code, 409)

    def test_register_short_password_fails(self) -> None:
        response = self.client.post("/api/v1/auth/register", json={"username": "user1", "password": "short"})
        self.assertEqual(response.status_code, 422)

    def test_login_success(self) -> None:
        self.client.post("/api/v1/auth/register", json={"username": "user1", "password": "password123"})
        response = self.client.post("/api/v1/auth/login", json={"username": "user1", "password": "password123"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.json())

    def test_login_wrong_password(self) -> None:
        self.client.post("/api/v1/auth/register", json={"username": "user1", "password": "password123"})
        response = self.client.post("/api/v1/auth/login", json={"username": "user1", "password": "wrongpw123"})
        self.assertEqual(response.status_code, 401)

    def test_second_user_not_admin(self) -> None:
        self.client.post("/api/v1/auth/register", json={"username": "admin", "password": "password123"})
        response = self.client.post("/api/v1/auth/register", json={"username": "user2", "password": "password123"})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["user"]["isAdmin"])

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_me_uses_session_cookie(self) -> None:
        self.client.post("/api/v1/auth/register", json={"username": "user1", "password": "password123"})
        response = self.client.get("/api/v1/auth/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["username"], "user1")

    def test_login_nonexistent_user_returns_401(self) -> None:
        """Login with nonexistent user must return 401 (not crash)."""
        response = self.client.post(
            "/api/v1/auth/login",
            json={"username": "ghost", "password": "password123"},
        )
        self.assertEqual(response.status_code, 401)

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_logout_revokes_session_cookie(self) -> None:
        self.client.post("/api/v1/auth/register", json={"username": "user1", "password": "password123"})
        response = self.client.post("/api/v1/auth/logout")
        self.assertEqual(response.status_code, 200)

        me_response = self.client.get("/api/v1/auth/me")
        self.assertEqual(me_response.status_code, 401)

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true", "SIGNAL_EYE_ENVIRONMENT": "production"})
    def test_logout_cookie_uses_secure_flag_in_production(self) -> None:
        """Logout must set secure flag consistent with login."""
        self.client.post("/api/v1/auth/register", json={"username": "u1", "password": "password123"})
        response = self.client.post("/api/v1/auth/logout")
        self.assertEqual(response.status_code, 200)
        cookie_header = response.headers.get("set-cookie", "")
        self.assertIn("Secure", cookie_header)
