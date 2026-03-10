"""Tests for community features: shared watchlists and public trend pages."""

from __future__ import annotations

import json
import sqlite3
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.main import create_app
from app.api.dependencies import get_db
from app.api.rate_limit import rate_limiter, response_cache
from app.data.database import initialize_database


class CommunityAPITests(unittest.TestCase):
    """Test community router endpoints."""

    def setUp(self) -> None:
        response_cache.clear()
        rate_limiter.clear()
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)

        self.app = create_app()

        def override_db() -> sqlite3.Connection:
            return self.connection

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        self.connection.close()
        self.app.dependency_overrides.clear()

    def _create_watchlist(self, name: str = "My List") -> int:
        self.connection.execute(
            "INSERT INTO watchlists (name, created_at, updated_at) VALUES (?, ?, ?)",
            (name, "2026-03-09T00:00:00", "2026-03-09T00:00:00"),
        )
        self.connection.commit()
        row = self.connection.execute("SELECT last_insert_rowid()").fetchone()
        return row[0]

    def _add_watchlist_item(self, watchlist_id: int, trend_id: str, trend_name: str) -> None:
        self.connection.execute(
            "INSERT INTO watchlist_items (watchlist_id, trend_id, trend_name, added_at) VALUES (?, ?, ?, ?)",
            (watchlist_id, trend_id, trend_name, "2026-03-09T00:00:00"),
        )
        self.connection.commit()

    def _insert_trend_score(self, topic: str, total: float = 42.0) -> None:
        self.connection.execute(
            "INSERT INTO trend_scores (topic, total_score, search_score, social_score, "
            "developer_score, knowledge_score, diversity_score, source_counts_json, "
            "evidence_json, latest_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                topic, total, 8.0, 12.0, 10.0, 6.0, 6.0,
                json.dumps({"reddit": 3}),
                json.dumps(["ev1"]),
                "2026-03-09T00:00:00",
            ),
        )
        self.connection.commit()

    def _insert_trend_run_and_snapshot(self, topic: str, rank: int, total: float = 42.0) -> None:
        self.connection.execute(
            "INSERT INTO trend_runs (captured_at) VALUES (?)",
            ("2026-03-09T00:00:00",),
        )
        self.connection.commit()
        run_id = self.connection.execute("SELECT last_insert_rowid()").fetchone()[0]
        self.connection.execute(
            "INSERT INTO trend_score_snapshots (run_id, rank_position, topic, total_score, "
            "search_score, social_score, developer_score, knowledge_score, diversity_score, "
            "source_counts_json, evidence_json, latest_timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                run_id, rank, topic, total, 8.0, 12.0, 10.0, 6.0, 6.0,
                json.dumps({"reddit": 3}),
                json.dumps(["ev1"]),
                "2026-03-09T00:00:00",
            ),
        )
        self.connection.commit()

    # -- Share creation --

    def test_share_watchlist_creates_token(self) -> None:
        wl_id = self._create_watchlist()
        resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={"public": True},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("shareToken", data)
        self.assertTrue(data["public"])

    def test_share_watchlist_not_found(self) -> None:
        resp = self.client.post(
            "/api/v1/watchlists/999/share",
            json={"public": False},
        )
        self.assertEqual(resp.status_code, 404)

    def test_share_defaults_to_private(self) -> None:
        wl_id = self._create_watchlist()
        resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["public"])

    # -- Shared watchlist viewing --

    def test_get_shared_watchlist(self) -> None:
        wl_id = self._create_watchlist("Shared List")
        self._add_watchlist_item(wl_id, "ai-agents", "AI Agents")
        self._insert_trend_score("AI Agents")

        share_resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={"public": True},
        )
        token = share_resp.json()["shareToken"]

        resp = self.client.get(f"/api/v1/shared/{token}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["watchlist"]["name"], "Shared List")
        self.assertEqual(len(data["watchlist"]["items"]), 1)
        self.assertEqual(data["watchlist"]["items"][0]["trendId"], "ai-agents")

    def test_get_shared_watchlist_not_found(self) -> None:
        resp = self.client.get("/api/v1/shared/nonexistent-token")
        self.assertEqual(resp.status_code, 404)

    # -- Public watchlist listing --

    def test_list_public_watchlists_empty(self) -> None:
        resp = self.client.get("/api/v1/community/watchlists")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["watchlists"], [])

    def test_list_public_watchlists(self) -> None:
        wl_id = self._create_watchlist("Public List")
        self._add_watchlist_item(wl_id, "ai-agents", "AI Agents")
        self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={"public": True},
        )

        resp = self.client.get("/api/v1/community/watchlists")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["watchlists"]), 1)
        self.assertEqual(data["watchlists"][0]["name"], "Public List")
        self.assertIn("shareToken", data["watchlists"][0])
        self.assertIn("sourceContributions", data["watchlists"][0])

    def test_private_shares_not_listed(self) -> None:
        wl_id = self._create_watchlist("Private List")
        self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={"public": False},
        )

        resp = self.client.get("/api/v1/community/watchlists")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["watchlists"], [])

    def test_revoke_share_removes_public_watchlist(self) -> None:
        wl_id = self._create_watchlist("Revoke List")
        share_resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={"public": True},
        )
        share_id = self.connection.execute(
            "SELECT id FROM watchlist_shares WHERE share_token = ?",
            (share_resp.json()["shareToken"],),
        ).fetchone()[0]

        revoke_resp = self.client.post(f"/api/v1/watchlists/{wl_id}/shares/{share_id}/revoke")
        self.assertEqual(revoke_resp.status_code, 200)

        resp = self.client.get("/api/v1/community/watchlists")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["watchlists"], [])

    def test_share_visibility_toggle_adds_watchlist_to_public_directory(self) -> None:
        wl_id = self._create_watchlist("Visibility List")
        share_resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={"public": False},
        )
        share_id = self.connection.execute(
            "SELECT id FROM watchlist_shares WHERE share_token = ?",
            (share_resp.json()["shareToken"],),
        ).fetchone()[0]

        update_resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/shares/{share_id}/visibility",
            json={"public": True},
        )
        self.assertEqual(update_resp.status_code, 200)
        self.assertTrue(update_resp.json()["public"])

        resp = self.client.get("/api/v1/community/watchlists")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["watchlists"]), 1)

    @patch.dict("os.environ", {"TREND_FRIEND_AUTH_ENABLED": "true"})
    def test_shared_watchlist_can_expose_owner_display_name(self) -> None:
        auth_client = TestClient(self.app)
        auth_client.post(
            "/api/v1/auth/register",
            json={"username": "owner1", "password": "password123", "displayName": "Owner One"},
        )
        watchlist_id = auth_client.get("/api/v1/watchlists").json()["watchlists"][0]["id"]
        self._add_watchlist_item(watchlist_id, "ai-agents", "AI Agents")
        self._insert_trend_score("AI Agents")

        share_resp = auth_client.post(
            f"/api/v1/watchlists/{watchlist_id}/share",
            json={"public": True, "showCreator": True},
        )
        token = share_resp.json()["shareToken"]

        shared_resp = self.client.get(f"/api/v1/shared/{token}")
        self.assertEqual(shared_resp.status_code, 200)
        self.assertEqual(shared_resp.json()["ownerDisplayName"], "Owner One")

        public_resp = self.client.get("/api/v1/community/watchlists")
        self.assertEqual(public_resp.status_code, 200)
        self.assertEqual(public_resp.json()["watchlists"][0]["ownerDisplayName"], "Owner One")

    def test_expired_share_returns_gone(self) -> None:
        wl_id = self._create_watchlist("Expiring List")
        expired_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        self.connection.execute(
            """
            INSERT INTO watchlist_shares (watchlist_id, share_token, is_public, show_creator, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (wl_id, "expired-token", 1, 0, expired_at, "2026-03-09T00:00:00"),
        )
        self.connection.commit()

        resp = self.client.get("/api/v1/shared/expired-token")
        self.assertEqual(resp.status_code, 410)

    def test_share_expiration_toggle_removes_public_watchlist_when_expired(self) -> None:
        wl_id = self._create_watchlist("Expiry Toggle")
        share_resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={"public": True},
        )
        share_id = self.connection.execute(
            "SELECT id FROM watchlist_shares WHERE share_token = ?",
            (share_resp.json()["shareToken"],),
        ).fetchone()[0]
        expired_at = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat().replace("+00:00", "Z")

        update_resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/shares/{share_id}/expiration",
            json={"expiresAt": expired_at},
        )
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["expiresAt"], expired_at)

    def test_default_share_expiry_is_used_when_requested(self) -> None:
        wl_id = self._create_watchlist("Default Expiry")
        defaults_resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/share-defaults",
            json={"defaultExpiryDays": 7},
        )
        self.assertEqual(defaults_resp.status_code, 200)

        share_resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={"public": True, "useDefaultExpiry": True},
        )
        self.assertEqual(share_resp.status_code, 200)
        self.assertIsNotNone(share_resp.json()["expiresAt"])

    def test_rotate_share_invalidates_previous_token(self) -> None:
        wl_id = self._create_watchlist("Rotate List")
        share_resp = self.client.post(
            f"/api/v1/watchlists/{wl_id}/share",
            json={"public": True},
        )
        original_token = share_resp.json()["shareToken"]
        share_id = self.connection.execute(
            "SELECT id FROM watchlist_shares WHERE share_token = ?",
            (original_token,),
        ).fetchone()[0]

        rotate_resp = self.client.post(f"/api/v1/watchlists/{wl_id}/shares/{share_id}/rotate")
        self.assertEqual(rotate_resp.status_code, 200)
        rotated_token = rotate_resp.json()["shareToken"]
        self.assertNotEqual(rotated_token, original_token)
        self.assertEqual(self.client.get(f"/api/v1/shared/{original_token}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/shared/{rotated_token}").status_code, 200)

    # -- Public trend page --

    def test_get_public_trend_page(self) -> None:
        self._insert_trend_score("AI Agents")
        self._insert_trend_run_and_snapshot("AI Agents", rank=1)

        resp = self.client.get("/api/v1/community/trends/ai-agents")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["trend"]["id"], "ai-agents")
        self.assertIn("score", data["trend"])

    def test_get_public_trend_page_not_found(self) -> None:
        resp = self.client.get("/api/v1/community/trends/nonexistent")
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
