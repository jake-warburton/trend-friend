"""Deliver post-run notifications to configured channels."""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from typing import Callable
from urllib import error, request

from app.alerts.evaluate import AlertEvent
from app.data.repositories import NotificationRepository, WatchlistRepository
from app.models import NotificationChannel, RunDigest

LOGGER = logging.getLogger(__name__)

CHANNEL_TYPE_WEBHOOK = "webhook"
WEBHOOK_TIMEOUT_SECONDS = 10

PostJson = Callable[[str, dict, int], int]


def deliver_post_run_notifications(
    connection: sqlite3.Connection,
    run_at: datetime,
    alert_events: list[AlertEvent],
    digest: RunDigest,
    post_json: PostJson | None = None,
) -> None:
    """Deliver alerts plus digest summaries to configured webhook channels."""

    notification_repo = NotificationRepository(connection)
    channels = [channel for channel in notification_repo.list_all_channels() if channel.enabled]
    if not channels:
        return

    watchlist_repo = WatchlistRepository(connection)
    owner_map = watchlist_repo.get_watchlist_owner_map({event.watchlist_id for event in alert_events})
    notable_digest = bool(digest.new_entries or digest.biggest_movers or digest.breakouts)
    sender = post_json or _post_json

    for channel in channels:
        scoped_alerts = [
            event
            for event in alert_events
            if owner_map.get(event.watchlist_id) == channel.owner_user_id
        ]
        if not scoped_alerts and not notable_digest:
            continue
        payload = build_pipeline_notification_payload(run_at, scoped_alerts, digest)
        _deliver_channel(notification_repo, channel, payload, sender)


def send_test_notification(
    connection: sqlite3.Connection,
    channel: NotificationChannel,
    post_json: PostJson | None = None,
) -> tuple[int | None, str | None]:
    """Send a sample payload to one configured channel and persist the attempt."""

    payload = {
        "event": "notification_test",
        "runAt": datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z"),
        "alerts": [],
        "digest": {
            "totalTrends": 0,
            "newEntries": [],
            "biggestMovers": [],
            "breakouts": [],
        },
    }
    repo = NotificationRepository(connection)
    sender = post_json or _post_json
    return _deliver_channel(repo, channel, payload, sender)


def build_pipeline_notification_payload(
    run_at: datetime,
    alert_events: list[AlertEvent],
    digest: RunDigest,
) -> dict:
    """Build the webhook payload shared by pipeline and test delivery."""

    return {
        "event": "pipeline_run_complete",
        "runAt": run_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "alerts": [
            {
                "ruleType": event.rule_type,
                "trendName": event.trend_name,
                "threshold": event.threshold,
                "currentValue": event.current_value,
                "message": event.message,
            }
            for event in alert_events
        ],
        "digest": {
            "totalTrends": digest.total_trends,
            "newEntries": digest.new_entries,
            "biggestMovers": [
                {
                    "name": mover.name,
                    "rankChange": mover.rank_change,
                    "score": mover.score,
                }
                for mover in digest.biggest_movers
            ],
            "breakouts": digest.breakouts,
        },
    }


def _deliver_channel(
    notification_repo: NotificationRepository,
    channel: NotificationChannel,
    payload: dict,
    post_json: PostJson,
) -> tuple[int | None, str | None]:
    payload_json = json.dumps(payload, sort_keys=True)
    sent_at = datetime.now(tz=timezone.utc)
    status_code: int | None = None
    error_message: str | None = None

    try:
        status_code = post_json(channel.destination, payload, WEBHOOK_TIMEOUT_SECONDS)
    except Exception as exc:  # pragma: no cover - error branch validated through tests
        error_message = str(exc)
        LOGGER.warning("Notification delivery failed for channel %s: %s", channel.id, error_message)

    notification_repo.append_log(
        channel_id=channel.id,
        payload_json=payload_json,
        status_code=status_code,
        error=error_message,
        sent_at=sent_at,
    )
    return status_code, error_message


def _post_json(url: str, payload: dict, timeout_seconds: int) -> int:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Content-Length": str(len(body)),
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            return int(response.status)
    except error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}") from exc
    except error.URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc
