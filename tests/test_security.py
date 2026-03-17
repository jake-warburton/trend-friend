"""Tests for security hardening."""

from __future__ import annotations

import os
import sqlite3
import unittest

from app.api.rate_limit import LoginRateLimiter


class LoginRateLimiterTests(unittest.TestCase):
    """Test per-username login rate limiting."""

    def test_allows_first_attempts(self) -> None:
        limiter = LoginRateLimiter(max_attempts=5, window_seconds=900)
        for _ in range(5):
            self.assertTrue(limiter.check("alice"))

    def test_blocks_after_max_attempts(self) -> None:
        limiter = LoginRateLimiter(max_attempts=5, window_seconds=900)
        for _ in range(5):
            limiter.check("alice")
        self.assertFalse(limiter.check("alice"))

    def test_independent_per_username(self) -> None:
        limiter = LoginRateLimiter(max_attempts=5, window_seconds=900)
        for _ in range(5):
            limiter.check("alice")
        self.assertTrue(limiter.check("bob"))

    def test_clear_resets(self) -> None:
        limiter = LoginRateLimiter(max_attempts=5, window_seconds=900)
        for _ in range(5):
            limiter.check("alice")
        limiter.clear("alice")
        self.assertTrue(limiter.check("alice"))


class LoginRateLimitAPITests(unittest.TestCase):
    """Test login rate limiting at the API level."""

    def setUp(self) -> None:
        from fastapi.testclient import TestClient
        from app.api.main import create_app
        from app.api.dependencies import get_db
        from app.data.database import initialize_database
        from app.api.rate_limit import login_rate_limiter, response_cache

        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)

        self.app = create_app()
        self.app.dependency_overrides[get_db] = lambda: self.connection
        self.client = TestClient(self.app)
        os.environ["SIGNAL_EYE_ENVIRONMENT"] = "development"
        login_rate_limiter.clear("ratelimited")
        response_cache.clear()

    def tearDown(self) -> None:
        self.connection.close()

    def test_login_rate_limited_after_5_failures(self) -> None:
        for _ in range(5):
            self.client.post(
                "/api/v1/auth/login",
                json={"username": "ratelimited", "password": "wrongpw123"},
            )
        response = self.client.post(
            "/api/v1/auth/login",
            json={"username": "ratelimited", "password": "wrongpw123"},
        )
        self.assertEqual(response.status_code, 429)
