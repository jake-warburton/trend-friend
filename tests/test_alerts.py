"""Tests for the alert evaluation engine and alert API endpoints."""

from __future__ import annotations

import sqlite3
import unittest
from datetime import datetime, timezone

from app.alerts.evaluate import (
    AlertEvent,
    RULE_TYPE_NEW_BREAKOUT,
    RULE_TYPE_NEW_TREND,
    RULE_TYPE_RANK_CHANGE,
    RULE_TYPE_SCORE_ABOVE,
    RULE_TYPE_THESIS_MATCH,
    evaluate_alerts,
)
from app.data.database import initialize_database
from app.data.repositories import WatchlistRepository
from app.models import AlertRule, TrendScoreResult


def _make_rule(
    rule_id: int = 1,
    watchlist_id: int = 1,
    rule_type: str = RULE_TYPE_SCORE_ABOVE,
    threshold: float = 30.0,
    enabled: bool = True,
) -> AlertRule:
    return AlertRule(
        id=rule_id,
        watchlist_id=watchlist_id,
        thesis_id=None,
        name="Test Rule",
        rule_type=rule_type,
        threshold=threshold,
        enabled=enabled,
        created_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
    )


def _make_score(topic: str = "ai agents", total_score: float = 42.0) -> TrendScoreResult:
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


class AlertEvaluationTests(unittest.TestCase):
    """Test the pure alert evaluation logic."""

    def test_score_above_triggers(self) -> None:
        rule = _make_rule(rule_type=RULE_TYPE_SCORE_ABOVE, threshold=30.0)
        score = _make_score(total_score=42.0)
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"ai agents"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={"ai agents": 1},
            previous_ranks={},
            statuses={},
            previous_trend_ids={"ai agents"},
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].rule_type, RULE_TYPE_SCORE_ABOVE)
        self.assertAlmostEqual(events[0].current_value, 42.0)

    def test_score_above_no_trigger(self) -> None:
        rule = _make_rule(rule_type=RULE_TYPE_SCORE_ABOVE, threshold=50.0)
        score = _make_score(total_score=42.0)
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"ai agents"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={},
            previous_ranks={},
            statuses={},
            previous_trend_ids={"ai agents"},
        )
        self.assertEqual(len(events), 0)

    def test_rank_change_triggers(self) -> None:
        rule = _make_rule(rule_type=RULE_TYPE_RANK_CHANGE, threshold=3.0)
        score = _make_score()
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"ai agents"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={"ai agents": 2},
            previous_ranks={"ai agents": 8},
            statuses={},
            previous_trend_ids={"ai agents"},
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].current_value, 6.0)

    def test_rank_change_insufficient(self) -> None:
        rule = _make_rule(rule_type=RULE_TYPE_RANK_CHANGE, threshold=5.0)
        score = _make_score()
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"ai agents"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={"ai agents": 3},
            previous_ranks={"ai agents": 5},
            statuses={},
            previous_trend_ids={"ai agents"},
        )
        self.assertEqual(len(events), 0)

    def test_new_breakout_triggers(self) -> None:
        rule = _make_rule(rule_type=RULE_TYPE_NEW_BREAKOUT, threshold=0.0)
        score = _make_score()
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"ai agents"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={},
            previous_ranks={},
            statuses={"ai agents": "breakout"},
            previous_trend_ids={"ai agents"},
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].rule_type, RULE_TYPE_NEW_BREAKOUT)

    def test_new_trend_triggers(self) -> None:
        rule = _make_rule(rule_type=RULE_TYPE_NEW_TREND, threshold=0.0)
        score = _make_score()
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"ai agents"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={},
            previous_ranks={},
            statuses={},
            previous_trend_ids=set(),  # not in previous
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].rule_type, RULE_TYPE_NEW_TREND)

    def test_new_trend_does_not_trigger_for_existing(self) -> None:
        rule = _make_rule(rule_type=RULE_TYPE_NEW_TREND, threshold=0.0)
        score = _make_score()
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"ai agents"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={},
            previous_ranks={},
            statuses={},
            previous_trend_ids={"ai agents"},
        )
        self.assertEqual(len(events), 0)

    def test_disabled_rule_skipped(self) -> None:
        rule = _make_rule(rule_type=RULE_TYPE_SCORE_ABOVE, threshold=1.0, enabled=False)
        score = _make_score(total_score=42.0)
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"ai agents"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={},
            previous_ranks={},
            statuses={},
            previous_trend_ids=set(),
        )
        self.assertEqual(len(events), 0)

    def test_unwatched_trend_skipped(self) -> None:
        rule = _make_rule(rule_type=RULE_TYPE_SCORE_ABOVE, threshold=1.0)
        score = _make_score(topic="ai agents")
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"other topic"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={},
            previous_ranks={},
            statuses={},
            previous_trend_ids=set(),
        )
        self.assertEqual(len(events), 0)

    def test_thesis_match_triggers_for_new_match(self) -> None:
        rule = AlertRule(
            id=9,
            watchlist_id=1,
            thesis_id=7,
            name="Early discovery",
            rule_type=RULE_TYPE_THESIS_MATCH,
            threshold=0.0,
            enabled=True,
            created_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
        )
        score = _make_score(topic="ai agents", total_score=42.0)
        events = evaluate_alerts(
            rules=[rule],
            watchlist_trend_ids={1: {"battery recycling"}},
            current_scores=[score],
            previous_scores=None,
            current_ranks={"ai agents": 1},
            previous_ranks={},
            statuses={},
            previous_trend_ids={"ai agents"},
            new_thesis_match_ids={7: {"ai agents"}},
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].rule_type, RULE_TYPE_THESIS_MATCH)
        self.assertIn("Early discovery", events[0].message)


class AlertRepositoryTests(unittest.TestCase):
    """Test alert event persistence and retrieval."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.repo = WatchlistRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def _create_watchlist_and_rule(self) -> tuple:
        watchlist = self.repo.create_watchlist("Test Watchlist")
        rule = self.repo.create_alert_rule(
            watchlist_id=watchlist.id,
            name="Score Alert",
            rule_type=RULE_TYPE_SCORE_ABOVE,
            threshold=30.0,
        )
        return watchlist, rule

    def test_save_and_list_alert_events(self) -> None:
        watchlist, rule = self._create_watchlist_and_rule()
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
        self.repo.save_alert_events([event])
        events = self.repo.list_alert_events()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].trend_id, "ai-agents")
        self.assertFalse(events[0].read)

    def test_list_unread_only(self) -> None:
        watchlist, rule = self._create_watchlist_and_rule()
        event = AlertEvent(
            rule_id=rule.id,
            watchlist_id=watchlist.id,
            trend_id="ai-agents",
            trend_name="AI Agents",
            rule_type=RULE_TYPE_SCORE_ABOVE,
            threshold=30.0,
            current_value=42.0,
            message="Test",
            triggered_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
        )
        self.repo.save_alert_events([event])
        events = self.repo.list_alert_events(unread_only=True)
        self.assertEqual(len(events), 1)

        self.repo.mark_alerts_read([events[0].id])
        events = self.repo.list_alert_events(unread_only=True)
        self.assertEqual(len(events), 0)

        all_events = self.repo.list_alert_events(unread_only=False)
        self.assertEqual(len(all_events), 1)
        self.assertTrue(all_events[0].read)

    def test_get_watchlist_trend_ids(self) -> None:
        watchlist = self.repo.create_watchlist("Test")
        self.repo.add_item(watchlist.id, "ai-agents", "AI Agents")
        self.repo.add_item(watchlist.id, "blockchain", "Blockchain")
        mapping = self.repo.get_watchlist_trend_ids()
        self.assertEqual(mapping[watchlist.id], {"ai-agents", "blockchain"})


class AlertAPITests(unittest.TestCase):
    """Test the alert API endpoints."""

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

        from app.api.rate_limit import response_cache
        response_cache.clear()

    def tearDown(self) -> None:
        self.connection.close()

    def _create_watchlist(self) -> int:
        repo = WatchlistRepository(self.connection)
        watchlist = repo.create_watchlist("Test Watchlist")
        return watchlist.id

    def test_list_alerts_empty(self) -> None:
        response = self.client.get("/api/v1/alerts")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["alerts"], [])

    def test_list_alert_rules_empty(self) -> None:
        response = self.client.get("/api/v1/alerts/rules")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rules"], [])

    def test_create_alert_rule(self) -> None:
        watchlist_id = self._create_watchlist()
        response = self.client.post(
            "/api/v1/alerts/rules",
            json={
                "watchlistId": watchlist_id,
                "name": "High Score Alert",
                "ruleType": "score_above",
                "threshold": 50.0,
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "High Score Alert")
        self.assertEqual(data["ruleType"], "score_above")

    def test_create_alert_rule_invalid_type(self) -> None:
        watchlist_id = self._create_watchlist()
        response = self.client.post(
            "/api/v1/alerts/rules",
            json={
                "watchlistId": watchlist_id,
                "name": "Bad Rule",
                "ruleType": "invalid_type",
                "threshold": 1.0,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_create_alert_rule_missing_watchlist(self) -> None:
        response = self.client.post(
            "/api/v1/alerts/rules",
            json={
                "watchlistId": 9999,
                "name": "Bad Rule",
                "ruleType": "score_above",
                "threshold": 1.0,
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_mark_alerts_read(self) -> None:
        watchlist_id = self._create_watchlist()
        repo = WatchlistRepository(self.connection)
        rule = repo.create_alert_rule(
            watchlist_id=watchlist_id,
            name="Test Rule",
            rule_type=RULE_TYPE_SCORE_ABOVE,
            threshold=30.0,
        )
        event = AlertEvent(
            rule_id=rule.id,
            watchlist_id=watchlist_id,
            trend_id="ai-agents",
            trend_name="AI Agents",
            rule_type=RULE_TYPE_SCORE_ABOVE,
            threshold=30.0,
            current_value=42.0,
            message="Test alert",
            triggered_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
        )
        repo.save_alert_events([event])

        alerts_response = self.client.get("/api/v1/alerts")
        alert_id = alerts_response.json()["alerts"][0]["id"]

        response = self.client.post(
            "/api/v1/alerts/read",
            json={"eventIds": [alert_id]},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["updated"], 1)

        unread = self.client.get("/api/v1/alerts?unread_only=true")
        self.assertEqual(len(unread.json()["alerts"]), 0)
