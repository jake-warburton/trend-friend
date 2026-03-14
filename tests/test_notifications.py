"""Tests for notification digest, delivery, CLI payloads, and API routes."""

from __future__ import annotations

import json
import sqlite3
import sys
import threading
import unittest
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.alerts.evaluate import AlertEvent
from app.api.dependencies import get_db
from app.api.main import create_app
from app.data.database import initialize_database
from app.data.repositories import NotificationRepository, WatchlistRepository
from app.models import TrendScoreResult
from app.notifications.deliver import (
    build_pipeline_notification_payload,
    compute_signature,
    deliver_post_run_notifications,
)
from app.notifications.digest import build_run_digest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from watchlists_api import (
    create_notification_channel_payload,
    delete_notification_channel_payload,
    list_notification_channels_payload,
    send_test_notification_channel_payload,
)


def _score(topic: str, total_score: float) -> TrendScoreResult:
    return TrendScoreResult(
        topic=topic,
        total_score=total_score,
        search_score=10.0,
        social_score=10.0,
        developer_score=10.0,
        knowledge_score=5.0,
        diversity_score=2.0,
        evidence=["evidence"],
        source_counts={"reddit": 1},
        latest_timestamp=datetime(2026, 3, 10, tzinfo=timezone.utc),
    )


class DigestTests(unittest.TestCase):
    """Test run digest construction from score deltas."""

    def test_build_run_digest_captures_entries_movers_and_breakouts(self) -> None:
        digest = build_run_digest(
            current_scores=[
                _score("ai agents", 52.3),
                _score("quantum sensors", 40.1),
                _score("edge computing", 38.7),
            ],
            previous_scores=[
                _score("edge computing", 31.0),
                _score("ai agents", 30.0),
            ],
            current_ranks={
                "ai agents": 1,
                "quantum sensors": 2,
                "edge computing": 3,
            },
            previous_ranks={
                "edge computing": 8,
                "ai agents": 2,
            },
            statuses={
                "ai agents": "rising",
                "quantum sensors": "breakout",
                "edge computing": "breakout",
            },
        )

        self.assertEqual(digest.total_trends, 3)
        self.assertEqual(digest.new_entries, ["quantum sensors"])
        self.assertEqual([mover.name for mover in digest.biggest_movers], ["edge computing"])
        self.assertEqual(digest.biggest_movers[0].rank_change, 5)
        self.assertEqual(digest.breakouts, ["quantum sensors", "edge computing"])


class NotificationRepositoryTests(unittest.TestCase):
    """Test notification channel and log persistence."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.repo = NotificationRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_create_list_and_log_channel(self) -> None:
        channel = self.repo.create_channel(
            channel_type="webhook",
            destination="https://hooks.example.test/abc",
            label="Ops",
        )
        self.repo.append_log(
            channel_id=channel.id,
            payload_json='{"event":"pipeline_run_complete"}',
            status_code=204,
            error=None,
            sent_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
        )

        channels = self.repo.list_channels()
        self.assertEqual(len(channels), 1)
        self.assertEqual(channels[0].destination, "https://hooks.example.test/abc")
        logs = self.repo.list_recent_logs(channel.id)
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0].status_code, 204)


class DeliveryTests(unittest.TestCase):
    """Test webhook delivery and payload construction."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.watchlist_repo = WatchlistRepository(self.connection)
        self.notification_repo = NotificationRepository(self.connection)
        self.watchlist = self.watchlist_repo.create_watchlist("Core")
        self.channel = self.notification_repo.create_channel(
            channel_type="webhook",
            destination="http://127.0.0.1:0",
            label="Local",
        )

    def tearDown(self) -> None:
        self.connection.close()

    def test_delivery_posts_payload_and_logs_success(self) -> None:
        received: list[dict] = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):  # noqa: N802
                length = int(self.headers["Content-Length"])
                payload = json.loads(self.rfile.read(length))
                received.append(payload)
                self.send_response(204)
                self.end_headers()

            def log_message(self, format, *args):  # noqa: A003
                return

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.handle_request)
        thread.start()
        try:
            self.connection.execute(
                "UPDATE notification_channels SET destination = ? WHERE id = ?",
                (f"http://127.0.0.1:{server.server_port}/hook", self.channel.id),
            )
            self.connection.commit()
            digest = build_run_digest(
                current_scores=[_score("ai agents", 52.3)],
                previous_scores=[],
                current_ranks={"ai agents": 1},
                previous_ranks={},
                statuses={"ai agents": "breakout"},
            )
            event = AlertEvent(
                rule_id=1,
                watchlist_id=self.watchlist.id,
                trend_id="ai-agents",
                trend_name="AI Agents",
                rule_type="score_above",
                threshold=40.0,
                current_value=52.3,
                message="AI Agents score 52.3 >= threshold 40.0",
                triggered_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
            )

            deliver_post_run_notifications(
                connection=self.connection,
                run_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
                alert_events=[event],
                digest=digest,
            )
        finally:
            thread.join(timeout=3)
            server.server_close()

        self.assertEqual(len(received), 1)
        self.assertEqual(received[0]["event"], "pipeline_run_complete")
        self.assertEqual(received[0]["alerts"][0]["trendName"], "AI Agents")
        logs = self.notification_repo.list_recent_logs(self.channel.id)
        self.assertEqual(logs[0].status_code, 204)
        self.assertIsNone(logs[0].error)

    def test_delivery_logs_errors_without_raising(self) -> None:
        self.connection.execute(
            "UPDATE notification_channels SET destination = ? WHERE id = ?",
            ("http://127.0.0.1:1/unreachable", self.channel.id),
        )
        self.connection.commit()

        deliver_post_run_notifications(
            connection=self.connection,
            run_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
            alert_events=[],
            digest=build_run_digest(
                current_scores=[_score("ai agents", 52.3)],
                previous_scores=[],
                current_ranks={"ai agents": 1},
                previous_ranks={},
                statuses={},
            ),
        )

        logs = self.notification_repo.list_recent_logs(self.channel.id)
        self.assertEqual(len(logs), 1)
        self.assertIsNone(logs[0].status_code)
        self.assertIsNotNone(logs[0].error)


class SignatureTests(unittest.TestCase):
    """Test HMAC signature generation for webhook payloads."""

    def test_compute_signature_produces_hex_digest(self) -> None:
        body = b'{"event":"notification_test"}'
        sig = compute_signature(body, "my-secret")
        self.assertEqual(len(sig), 64)
        # Deterministic: same inputs produce same output
        self.assertEqual(sig, compute_signature(body, "my-secret"))

    def test_compute_signature_differs_with_different_secret(self) -> None:
        body = b'{"event":"notification_test"}'
        sig_a = compute_signature(body, "secret-a")
        sig_b = compute_signature(body, "secret-b")
        self.assertNotEqual(sig_a, sig_b)


class RetryTests(unittest.TestCase):
    """Test webhook delivery retry behavior on transient failures."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.watchlist_repo = WatchlistRepository(self.connection)
        self.notification_repo = NotificationRepository(self.connection)
        self.watchlist = self.watchlist_repo.create_watchlist("Core")
        self.channel = self.notification_repo.create_channel(
            channel_type="webhook",
            destination="http://127.0.0.1:0",
            label="Retry-Test",
        )

    def tearDown(self) -> None:
        self.connection.close()

    def test_delivery_retries_on_transient_failure(self) -> None:
        call_count = 0

        def flaky_post(url: str, payload: dict, timeout: int) -> int:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("Connection refused")
            return 200

        with patch("app.notifications.deliver.RETRY_BACKOFF_SECONDS", [0, 0]):
            deliver_post_run_notifications(
                connection=self.connection,
                run_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
                alert_events=[],
                digest=build_run_digest(
                    current_scores=[_score("ai agents", 52.3)],
                    previous_scores=[],
                    current_ranks={"ai agents": 1},
                    previous_ranks={},
                    statuses={"ai agents": "breakout"},
                ),
                post_json=flaky_post,
            )

        self.assertEqual(call_count, 3)
        logs = self.notification_repo.list_recent_logs(self.channel.id)
        self.assertEqual(logs[0].status_code, 200)
        self.assertIsNone(logs[0].error)

    def test_delivery_gives_up_after_max_retries(self) -> None:
        call_count = 0

        def always_fail(url: str, payload: dict, timeout: int) -> int:
            nonlocal call_count
            call_count += 1
            raise RuntimeError("Connection refused")

        with patch("app.notifications.deliver.RETRY_BACKOFF_SECONDS", [0, 0]):
            deliver_post_run_notifications(
                connection=self.connection,
                run_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
                alert_events=[],
                digest=build_run_digest(
                    current_scores=[_score("ai agents", 52.3)],
                    previous_scores=[],
                    current_ranks={"ai agents": 1},
                    previous_ranks={},
                    statuses={"ai agents": "breakout"},
                ),
                post_json=always_fail,
            )

        self.assertEqual(call_count, 3)  # 1 initial + 2 retries
        logs = self.notification_repo.list_recent_logs(self.channel.id)
        self.assertIsNone(logs[0].status_code)
        self.assertIn("Connection refused", logs[0].error)


class NotificationCliPayloadTests(unittest.TestCase):
    """Test the CLI-layer notification channel helper payloads."""

    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        initialize_database(self.connection)
        self.repo = NotificationRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_cli_payloads_cover_crud_and_test(self) -> None:
        created = create_notification_channel_payload(
            self.repo,
            destination="https://hooks.example.test/abc",
            label="Ops",
        )
        self.assertEqual(created["channelType"], "webhook")

        listed = list_notification_channels_payload(self.repo)
        self.assertEqual(len(listed["channels"]), 1)

        with patch("watchlists_api.send_test_notification", return_value=(204, None)):
            tested = send_test_notification_channel_payload(self.connection, self.repo, int(created["id"]))
        self.assertEqual(tested, {"ok": True, "statusCode": 204})

        deleted = delete_notification_channel_payload(self.repo, int(created["id"]))
        self.assertEqual(deleted, {"ok": True})


class NotificationApiTests(unittest.TestCase):
    """Test the notification API endpoints."""

    def setUp(self) -> None:
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
        from app.api.rate_limit import rate_limiter

        rate_limiter.clear()

    def tearDown(self) -> None:
        self.connection.close()

    def test_notification_channel_crud(self) -> None:
        create_response = self.client.post(
            "/api/v1/notifications/channels",
            json={
                "channelType": "webhook",
                "destination": "https://hooks.example.test/abc",
                "label": "Ops",
            },
        )
        self.assertEqual(create_response.status_code, 200)

        list_response = self.client.get("/api/v1/notifications/channels")
        self.assertEqual(list_response.status_code, 200)
        channels = list_response.json()["channels"]
        self.assertEqual(len(channels), 1)
        self.assertEqual(channels[0]["label"], "Ops")

        delete_response = self.client.delete(f"/api/v1/notifications/channels/{channels[0]['id']}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json(), {"ok": True})

    def test_notification_channel_test_route_uses_delivery_result(self) -> None:
        create_response = self.client.post(
            "/api/v1/notifications/channels",
            json={
                "channelType": "webhook",
                "destination": "https://hooks.example.test/abc",
                "label": "Ops",
            },
        )
        channel_id = create_response.json()["id"]

        with patch("app.api.routers.notifications.send_test_notification", return_value=(204, None)):
            test_response = self.client.post(f"/api/v1/notifications/channels/{channel_id}/test")

        self.assertEqual(test_response.status_code, 200)
        self.assertEqual(test_response.json(), {"ok": True, "statusCode": 204})

    def test_build_pipeline_payload_matches_contract(self) -> None:
        payload = build_pipeline_notification_payload(
            run_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
            alert_events=[
                AlertEvent(
                    rule_id=1,
                    watchlist_id=1,
                    trend_id="ai-agents",
                    trend_name="AI Agents",
                    rule_type="score_above",
                    threshold=40.0,
                    current_value=52.3,
                    message="AI Agents score 52.3 >= threshold 40.0",
                    triggered_at=datetime(2026, 3, 10, tzinfo=timezone.utc),
                )
            ],
            digest=build_run_digest(
                current_scores=[_score("ai agents", 52.3)],
                previous_scores=[],
                current_ranks={"ai agents": 1},
                previous_ranks={},
                statuses={"ai agents": "breakout"},
            ),
        )

        self.assertEqual(payload["event"], "pipeline_run_complete")
        self.assertEqual(payload["alerts"][0]["ruleType"], "score_above")
        self.assertEqual(payload["digest"]["breakouts"], ["ai agents"])
