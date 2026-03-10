"""Tests for the REST API routes."""

from __future__ import annotations

import sqlite3
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.main import create_app
from app.api.dependencies import get_db, get_settings
from app.config import load_settings
from app.data.database import initialize_database
from app.data.repositories import (
    SignalRepository,
    SourceIngestionRunRepository,
    TrendScoreRepository,
)
from app.models import NormalizedSignal, SourceIngestionRun, TrendScoreResult


def _build_score(topic: str = "ai agents", total_score: float = 42.0) -> TrendScoreResult:
    return TrendScoreResult(
        topic=topic,
        total_score=total_score,
        search_score=0.0,
        social_score=18.0,
        developer_score=16.0,
        knowledge_score=6.0,
        diversity_score=2.0,
        evidence=["Test evidence"],
        source_counts={"reddit": 2, "github": 1},
        latest_timestamp=datetime(2026, 3, 9, tzinfo=timezone.utc),
    )


class APITests(unittest.TestCase):
    """Test the FastAPI routes against an in-memory database."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)

        self.app = create_app()

        def override_db() -> sqlite3.Connection:
            return self.connection

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

        # Clear global caches between tests
        from app.api.rate_limit import response_cache
        response_cache.clear()

    def tearDown(self) -> None:
        self.connection.close()

    def _seed_data(self) -> None:
        """Insert minimal test data."""
        score_repo = TrendScoreRepository(self.connection)
        signal_repo = SignalRepository(self.connection)
        source_run_repo = SourceIngestionRunRepository(self.connection)

        captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)
        signal_repo.replace_signals([
            NormalizedSignal("ai agents", "reddit", "social", 12.0, captured_at, "Reddit evidence"),
        ])
        source_run_repo.append_runs([
            SourceIngestionRun(
                source="reddit",
                fetched_at=captured_at,
                success=True,
                item_count=10,
                duration_ms=500,
            ),
        ])
        score_repo.append_snapshot(
            [_build_score("ai agents", 42.0), _build_score("battery recycling", 25.0)],
            captured_at=captured_at,
        )

    def test_health_check(self) -> None:
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")

    def test_list_trends_empty(self) -> None:
        response = self.client.get("/api/v1/trends")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("generatedAt", data)
        self.assertEqual(data["trends"], [])

    def test_list_trends_with_data(self) -> None:
        self._seed_data()
        response = self.client.get("/api/v1/trends")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(len(data["trends"]), 0)

    def test_get_trend_detail_not_found(self) -> None:
        response = self.client.get("/api/v1/trends/nonexistent")
        self.assertEqual(response.status_code, 404)

    def test_get_trend_detail(self) -> None:
        self._seed_data()
        response = self.client.get("/api/v1/trends/ai-agents")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], "ai-agents")
        self.assertIn("breakoutPrediction", data)
        self.assertIn("opportunity", data)
        self.assertIn("sourceContributions", data)
        self.assertEqual(data["sourceContributions"][0]["source"], "reddit")

    def test_latest_trends(self) -> None:
        self._seed_data()
        response = self.client.get("/api/v1/trends/latest")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("trends", data)

    def test_trend_history(self) -> None:
        self._seed_data()
        response = self.client.get("/api/v1/trends/history")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("snapshots", data)

    def test_dashboard_overview(self) -> None:
        self._seed_data()
        response = self.client.get("/api/v1/dashboard/overview")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("summary", data)
        self.assertIn("highlights", data)

    def test_list_sources(self) -> None:
        self._seed_data()
        response = self.client.get("/api/v1/sources")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("sources", data)

    def test_get_source_not_found(self) -> None:
        response = self.client.get("/api/v1/sources/nonexistent")
        self.assertEqual(response.status_code, 404)

    def test_cors_headers(self) -> None:
        response = self.client.options(
            "/api/v1/health",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
        )
        self.assertIn("access-control-allow-origin", response.headers)

    @patch.dict("os.environ", {"TREND_FRIEND_AUTH_ENABLED": "true"})
    def test_watchlists_are_scoped_to_authenticated_user(self) -> None:
        first = TestClient(self.app)
        second = TestClient(self.app)

        first.post("/api/v1/auth/register", json={"username": "owner1", "password": "password123"})
        second.post("/api/v1/auth/register", json={"username": "owner2", "password": "password123"})

        first.post("/api/v1/watchlists", json={"name": "Owner One"})
        second.post("/api/v1/watchlists", json={"name": "Owner Two"})

        first_payload = first.get("/api/v1/watchlists").json()
        second_payload = second.get("/api/v1/watchlists").json()

        self.assertEqual(
            {watchlist["name"] for watchlist in first_payload["watchlists"]},
            {"Core Watchlist", "Owner One"},
        )
        self.assertEqual(
            {watchlist["name"] for watchlist in second_payload["watchlists"]},
            {"Core Watchlist", "Owner Two"},
        )

    @patch.dict("os.environ", {"TREND_FRIEND_AUTH_ENABLED": "true"})
    def test_user_can_revoke_own_share(self) -> None:
        client = TestClient(self.app)
        client.post("/api/v1/auth/register", json={"username": "owner1", "password": "password123"})
        watchlists_response = client.get("/api/v1/watchlists")
        watchlist_id = watchlists_response.json()["watchlists"][0]["id"]

        share_response = client.post(f"/api/v1/watchlists/{watchlist_id}/share", json={"public": True})
        self.assertEqual(share_response.status_code, 200)

        shares_response = client.get("/api/v1/watchlists")
        share_id = shares_response.json()["watchlists"][0]["shares"][0]["id"]

        revoke_response = client.post(f"/api/v1/watchlists/{watchlist_id}/shares/{share_id}/revoke")
        self.assertEqual(revoke_response.status_code, 200)
        self.assertEqual(revoke_response.json(), {"ok": True})

        after_response = client.get("/api/v1/watchlists")
        self.assertEqual(after_response.json()["watchlists"][0]["shares"], [])

    @patch.dict("os.environ", {"TREND_FRIEND_AUTH_ENABLED": "true"})
    def test_user_can_toggle_share_visibility(self) -> None:
        client = TestClient(self.app)
        client.post("/api/v1/auth/register", json={"username": "owner1", "password": "password123"})
        watchlist_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["id"]
        client.post(f"/api/v1/watchlists/{watchlist_id}/share", json={"public": False})
        share_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["shares"][0]["id"]

        update_response = client.post(
            f"/api/v1/watchlists/{watchlist_id}/shares/{share_id}/visibility",
            json={"public": True},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertTrue(update_response.json()["public"])

    @patch.dict("os.environ", {"TREND_FRIEND_AUTH_ENABLED": "true"})
    def test_user_can_toggle_share_attribution(self) -> None:
        client = TestClient(self.app)
        client.post("/api/v1/auth/register", json={"username": "owner1", "password": "password123", "displayName": "Owner One"})
        watchlist_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["id"]
        client.post(f"/api/v1/watchlists/{watchlist_id}/share", json={"public": True, "showCreator": False})
        share_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["shares"][0]["id"]

        update_response = client.post(
            f"/api/v1/watchlists/{watchlist_id}/shares/{share_id}/attribution",
            json={"showCreator": True},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertTrue(update_response.json()["showCreator"])
