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
        from app.api.rate_limit import rate_limiter, response_cache
        response_cache.clear()
        rate_limiter.clear()

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
                raw_item_count=15,
                item_count=10,
                kept_item_count=10,
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
        self.assertIn("forecastDirection", data["trends"][0])
        self.assertIn("seasonality", data["trends"][0])

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
        self.assertIn("forecast", data)
        self.assertIn("seasonality", data)
        self.assertIn("opportunity", data)
        self.assertIn("sourceContributions", data)
        self.assertEqual(data["sourceContributions"][0]["source"], "reddit")
        self.assertIsNone(data["forecast"])
        self.assertIsNone(data["seasonality"])

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
        self.assertIn("sourceWatch", data)

    def test_list_sources(self) -> None:
        self._seed_data()
        response = self.client.get("/api/v1/sources")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("sources", data)
        reddit = next(source for source in data["sources"] if source["source"] == "reddit")
        self.assertEqual(reddit["rawItemCount"], 15)
        self.assertEqual(reddit["keptItemCount"], 10)
        self.assertEqual(reddit["yieldRatePercent"], 66.7)

    def test_get_source_not_found(self) -> None:
        response = self.client.get("/api/v1/sources/nonexistent")
        self.assertEqual(response.status_code, 404)

    def test_cors_headers(self) -> None:
        response = self.client.options(
            "/api/v1/health",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
        )
        self.assertIn("access-control-allow-origin", response.headers)

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
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

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_user_can_create_thesis_from_watchlist_route(self) -> None:
        self._seed_data()
        client = TestClient(self.app)
        client.post("/api/v1/auth/register", json={"username": "owner1", "password": "password123"})
        watchlist_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["id"]

        response = client.post(
            "/api/v1/watchlists",
            json={
                "action": "create-thesis",
                "watchlistId": watchlist_id,
                "name": "SEO opportunities",
                "lens": "seo",
                "keywordQuery": "agents",
                "stage": "nascent",
                "minimumScore": 20,
                "notifyOnMatch": True,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["theses"][0]["name"], "SEO opportunities")
        self.assertEqual(payload["theses"][0]["activeMatchCount"], 1)
        self.assertEqual(payload["thesisMatches"][0]["trendId"], "ai-agents")
        self.assertEqual(payload["alerts"][0]["ruleType"], "thesis_match")

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
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

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
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

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
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

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_watchlist_payload_includes_share_activity(self) -> None:
        client = TestClient(self.app)
        client.post("/api/v1/auth/register", json={"username": "owner1", "password": "password123"})
        watchlist_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["id"]
        client.post(f"/api/v1/watchlists/{watchlist_id}/share", json={"public": True})
        share_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["shares"][0]["id"]
        client.post(f"/api/v1/watchlists/{watchlist_id}/shares/{share_id}/visibility", json={"public": False})

        payload = client.get("/api/v1/watchlists").json()
        events = payload["watchlists"][0]["shareEvents"]
        self.assertGreaterEqual(len(events), 2)
        self.assertEqual(events[0]["eventType"], "visibility_updated")

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_user_can_set_default_share_expiry(self) -> None:
        client = TestClient(self.app)
        client.post("/api/v1/auth/register", json={"username": "owner1", "password": "password123"})
        watchlist_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["id"]

        update_response = client.post(
            f"/api/v1/watchlists/{watchlist_id}/share-defaults",
            json={"defaultExpiryDays": 7},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["watchlists"][0]["defaultShareExpiryDays"], 7)

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_user_can_rotate_share_token(self) -> None:
        client = TestClient(self.app)
        client.post("/api/v1/auth/register", json={"username": "owner1", "password": "password123"})
        watchlist_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["id"]
        original_share = client.post(f"/api/v1/watchlists/{watchlist_id}/share", json={"public": True}).json()
        share_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["shares"][0]["id"]

        rotate_response = client.post(f"/api/v1/watchlists/{watchlist_id}/shares/{share_id}/rotate")
        self.assertEqual(rotate_response.status_code, 200)
        self.assertNotEqual(rotate_response.json()["shareToken"], original_share["shareToken"])

        payload = client.get("/api/v1/watchlists").json()
        self.assertEqual(payload["watchlists"][0]["shareEvents"][0]["eventType"], "rotated")

    @patch.dict("os.environ", {"SIGNAL_EYE_AUTH_ENABLED": "true"})
    def test_watchlist_payload_includes_share_access_metrics(self) -> None:
        client = TestClient(self.app)
        client.post("/api/v1/auth/register", json={"username": "owner1", "password": "password123"})
        watchlist_id = client.get("/api/v1/watchlists").json()["watchlists"][0]["id"]
        share = client.post(f"/api/v1/watchlists/{watchlist_id}/share", json={"public": True}).json()

        shared_response = client.get(f"/api/v1/shared/{share['shareToken']}")
        self.assertEqual(shared_response.status_code, 200)

        payload = client.get("/api/v1/watchlists").json()
        stored_share = payload["watchlists"][0]["shares"][0]
        self.assertEqual(stored_share["accessCount"], 1)
        self.assertIsNotNone(stored_share["lastAccessedAt"])
        self.assertEqual(len(stored_share["accessHistory"]), 1)
        self.assertEqual(stored_share["accessHistory"][0]["count"], 1)
