"""Tests for the Python CLI watchlist fallback commands.

These test the helper functions in scripts/watchlists_api.py that the
Next.js server helpers shell out to when no backend API is available.
"""

from __future__ import annotations

import json
import sqlite3
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from app.alerts.evaluate import RULE_TYPE_SCORE_ABOVE, AlertEvent
from app.data.database import initialize_database
from app.data.repositories import TrendScoreRepository, WatchlistRepository


def _insert_trend_score(connection: sqlite3.Connection, topic: str, total: float = 42.0) -> None:
    connection.execute(
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
    connection.commit()


class ShareWatchlistTests(unittest.TestCase):
    """Test share_payload from the CLI layer."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.watchlist_repo = WatchlistRepository(self.connection)
        self.score_repo = TrendScoreRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_share_returns_token_and_public_flag(self) -> None:
        from scripts.watchlists_api import share_payload

        watchlist = self.watchlist_repo.create_watchlist("My List")
        result = share_payload(self.watchlist_repo, watchlist.id, public=True)

        self.assertIn("shareToken", result)
        self.assertTrue(result["public"])
        self.assertIn("createdAt", result)
        self.assertTrue(result["createdAt"].endswith("Z"))

    def test_share_private_by_default(self) -> None:
        from scripts.watchlists_api import share_payload

        watchlist = self.watchlist_repo.create_watchlist("Private List")
        result = share_payload(self.watchlist_repo, watchlist.id, public=False)

        self.assertFalse(result["public"])

    def test_share_nonexistent_watchlist_returns_error(self) -> None:
        from scripts.watchlists_api import share_payload

        result = share_payload(self.watchlist_repo, watchlist_id=9999, public=False)

        self.assertIn("error", result)

    def test_revoke_share_removes_existing_share(self) -> None:
        from scripts.watchlists_api import revoke_share_payload

        watchlist = self.watchlist_repo.create_watchlist("Revoke List")
        share = self.watchlist_repo.create_share(watchlist.id, "revoke-token", is_public=True)

        result = revoke_share_payload(self.watchlist_repo, share.id)

        self.assertEqual(result, {"ok": True})
        self.assertEqual(self.watchlist_repo.list_shares_for_watchlist(watchlist.id), [])

    def test_visibility_update_changes_public_flag(self) -> None:
        from scripts.watchlists_api import update_share_visibility_payload

        watchlist = self.watchlist_repo.create_watchlist("Visibility List")
        share = self.watchlist_repo.create_share(watchlist.id, "visibility-token", is_public=False)

        result = update_share_visibility_payload(self.watchlist_repo, share.id, public=True)

        self.assertTrue(result["public"])


class GetSharedWatchlistTests(unittest.TestCase):
    """Test get_shared_payload from the CLI layer."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.watchlist_repo = WatchlistRepository(self.connection)
        self.score_repo = TrendScoreRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_get_shared_returns_watchlist_with_items(self) -> None:
        from scripts.watchlists_api import share_payload, get_shared_payload

        _insert_trend_score(self.connection, "AI Agents")
        watchlist = self.watchlist_repo.create_watchlist("Shared List")
        self.watchlist_repo.add_item(watchlist.id, "ai-agents", "AI Agents")

        share_result = share_payload(self.watchlist_repo, watchlist.id, public=True)
        token = share_result["shareToken"]

        result = get_shared_payload(self.watchlist_repo, self.score_repo, token)

        self.assertEqual(result["watchlist"]["name"], "Shared List")
        self.assertEqual(len(result["watchlist"]["items"]), 1)
        self.assertEqual(result["watchlist"]["items"][0]["trendId"], "ai-agents")
        self.assertIn("currentScore", result["watchlist"]["items"][0])
        self.assertIn("geoSummary", result["watchlist"]["items"][0])
        self.assertIn("sourceContributions", result["watchlist"]["items"][0])
        self.assertIn("shareToken", result)

    def test_get_shared_unknown_token_returns_error(self) -> None:
        from scripts.watchlists_api import get_shared_payload

        result = get_shared_payload(self.watchlist_repo, self.score_repo, "no-such-token")

        self.assertIn("error", result)

    def test_get_shared_includes_current_score(self) -> None:
        from scripts.watchlists_api import share_payload, get_shared_payload

        _insert_trend_score(self.connection, "AI Agents", total=55.5)
        watchlist = self.watchlist_repo.create_watchlist("Scored List")
        self.watchlist_repo.add_item(watchlist.id, "ai-agents", "AI Agents")

        share_result = share_payload(self.watchlist_repo, watchlist.id, public=True)
        result = get_shared_payload(self.watchlist_repo, self.score_repo, share_result["shareToken"])

        self.assertEqual(result["watchlist"]["items"][0]["currentScore"], 55.5)

    def test_get_shared_item_without_score_has_null(self) -> None:
        from scripts.watchlists_api import share_payload, get_shared_payload

        watchlist = self.watchlist_repo.create_watchlist("No Scores")
        self.watchlist_repo.add_item(watchlist.id, "unknown-trend", "Unknown Trend")

        share_result = share_payload(self.watchlist_repo, watchlist.id, public=True)
        result = get_shared_payload(self.watchlist_repo, self.score_repo, share_result["shareToken"])

        self.assertIsNone(result["watchlist"]["items"][0]["currentScore"])


class ListPublicWatchlistsTests(unittest.TestCase):
    """Test list_public_payload from the CLI layer."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.watchlist_repo = WatchlistRepository(self.connection)
        self.score_repo = TrendScoreRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_empty_when_no_public_shares(self) -> None:
        from scripts.watchlists_api import list_public_payload

        result = list_public_payload(self.watchlist_repo, self.score_repo)

        self.assertEqual(result["watchlists"], [])

    def test_lists_public_watchlists(self) -> None:
        from scripts.watchlists_api import list_public_payload

        watchlist = self.watchlist_repo.create_watchlist("Public List")
        self.watchlist_repo.add_item(watchlist.id, "ai-agents", "AI Agents")
        self.watchlist_repo.create_share(watchlist.id, "pub-token", is_public=True)

        result = list_public_payload(self.watchlist_repo, self.score_repo)

        self.assertEqual(len(result["watchlists"]), 1)
        entry = result["watchlists"][0]
        self.assertEqual(entry["name"], "Public List")
        self.assertIn("shareToken", entry)
        self.assertIn("geoSummary", entry)

    def test_excludes_private_shares(self) -> None:
        from scripts.watchlists_api import list_public_payload

        watchlist = self.watchlist_repo.create_watchlist("Private List")
        self.watchlist_repo.create_share(watchlist.id, "priv-token", is_public=False)

        result = list_public_payload(self.watchlist_repo, self.score_repo)

        self.assertEqual(result["watchlists"], [])

    def test_output_contract_fields(self) -> None:
        from scripts.watchlists_api import list_public_payload

        watchlist = self.watchlist_repo.create_watchlist("Contract Check")
        self.watchlist_repo.create_share(watchlist.id, "c-token", is_public=True)

        result = list_public_payload(self.watchlist_repo, self.score_repo)
        entry = result["watchlists"][0]

        for key in ("id", "name", "itemCount", "shareToken", "createdAt", "updatedAt", "geoSummary"):
            self.assertIn(key, entry, f"Missing key: {key}")


class ListAlertsTests(unittest.TestCase):
    """Test list_alerts_payload from the CLI layer."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.watchlist_repo = WatchlistRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def _create_alert_event(self) -> int:
        watchlist = self.watchlist_repo.create_watchlist("Alert List")
        rule = self.watchlist_repo.create_alert_rule(
            watchlist_id=watchlist.id,
            name="Score Alert",
            rule_type=RULE_TYPE_SCORE_ABOVE,
            threshold=30.0,
        )
        event = AlertEvent(
            rule_id=rule.id,
            watchlist_id=watchlist.id,
            trend_id="ai-agents",
            trend_name="AI Agents",
            rule_type=RULE_TYPE_SCORE_ABOVE,
            threshold=30.0,
            current_value=42.0,
            message="AI Agents score 42.0 >= threshold 30.0",
            triggered_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
        )
        self.watchlist_repo.save_alert_events([event])
        events = self.watchlist_repo.list_alert_events()
        return events[0].id

    def test_empty_when_no_events(self) -> None:
        from scripts.watchlists_api import list_alerts_payload

        result = list_alerts_payload(self.watchlist_repo, unread_only=False, limit=50)

        self.assertEqual(result["alerts"], [])

    def test_lists_alert_events(self) -> None:
        from scripts.watchlists_api import list_alerts_payload

        self._create_alert_event()

        result = list_alerts_payload(self.watchlist_repo, unread_only=False, limit=50)

        self.assertEqual(len(result["alerts"]), 1)
        alert = result["alerts"][0]
        self.assertEqual(alert["trendId"], "ai-agents")
        self.assertEqual(alert["trendName"], "AI Agents")
        self.assertAlmostEqual(alert["currentValue"], 42.0)
        self.assertFalse(alert["read"])

    def test_unread_only_filter(self) -> None:
        from scripts.watchlists_api import list_alerts_payload

        event_id = self._create_alert_event()
        self.watchlist_repo.mark_alerts_read([event_id])

        result = list_alerts_payload(self.watchlist_repo, unread_only=True, limit=50)

        self.assertEqual(result["alerts"], [])

    def test_alert_output_contract_fields(self) -> None:
        from scripts.watchlists_api import list_alerts_payload

        self._create_alert_event()

        result = list_alerts_payload(self.watchlist_repo, unread_only=False, limit=50)
        alert = result["alerts"][0]

        for key in ("id", "ruleId", "watchlistId", "trendId", "trendName",
                     "ruleType", "threshold", "currentValue", "message",
                     "triggeredAt", "read"):
            self.assertIn(key, alert, f"Missing key: {key}")

    def test_triggered_at_ends_with_z(self) -> None:
        from scripts.watchlists_api import list_alerts_payload

        self._create_alert_event()

        result = list_alerts_payload(self.watchlist_repo, unread_only=False, limit=50)

        self.assertTrue(result["alerts"][0]["triggeredAt"].endswith("Z"))


class MarkAlertsReadTests(unittest.TestCase):
    """Test mark_alerts_read_payload from the CLI layer."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.watchlist_repo = WatchlistRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_marks_events_read_and_returns_count(self) -> None:
        from scripts.watchlists_api import mark_alerts_read_payload

        watchlist = self.watchlist_repo.create_watchlist("Alert List")
        rule = self.watchlist_repo.create_alert_rule(
            watchlist_id=watchlist.id,
            name="Score Alert",
            rule_type=RULE_TYPE_SCORE_ABOVE,
            threshold=30.0,
        )
        event = AlertEvent(
            rule_id=rule.id,
            watchlist_id=watchlist.id,
            trend_id="ai-agents",
            trend_name="AI Agents",
            rule_type=RULE_TYPE_SCORE_ABOVE,
            threshold=30.0,
            current_value=42.0,
            message="Test alert",
            triggered_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
        )
        self.watchlist_repo.save_alert_events([event])
        events = self.watchlist_repo.list_alert_events()
        event_id = events[0].id

        result = mark_alerts_read_payload(self.watchlist_repo, [event_id])

        self.assertEqual(result["updated"], 1)

        remaining = self.watchlist_repo.list_alert_events(unread_only=True)
        self.assertEqual(len(remaining), 0)

    def test_no_events_returns_zero(self) -> None:
        from scripts.watchlists_api import mark_alerts_read_payload

        result = mark_alerts_read_payload(self.watchlist_repo, [])

        self.assertEqual(result["updated"], 0)


if __name__ == "__main__":
    unittest.main()
