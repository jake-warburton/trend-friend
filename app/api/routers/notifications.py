"""Notification channel API routes."""

from __future__ import annotations
from datetime import timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_db
from app.auth.middleware import auth_enabled, require_auth
from app.data.connection import DatabaseConnection
from app.data.repositories import NotificationRepository
from app.models import User
from app.notifications.deliver import CHANNEL_TYPE_WEBHOOK, send_test_notification

router = APIRouter(tags=["notifications"])


def _to_utc_iso(value) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _owner_user_id(user: User) -> int | None:
    return user.id if auth_enabled() else None


def _validate_webhook_url(destination: str) -> None:
    import ipaddress
    import socket

    parsed = urlparse(destination)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=422, detail="destination must be a valid http or https URL")

    hostname = parsed.hostname or ""

    # Block obviously internal hostnames
    blocked_hostnames = {"localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal"}
    if hostname.lower() in blocked_hostnames:
        raise HTTPException(status_code=422, detail="webhook destination must not target internal hosts")

    # Resolve and block private/reserved IP ranges
    try:
        for info in socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM):
            addr = ipaddress.ip_address(info[4][0])
            if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
                raise HTTPException(
                    status_code=422,
                    detail="webhook destination must not resolve to a private or reserved IP address",
                )
    except socket.gaierror:
        raise HTTPException(status_code=422, detail="webhook destination hostname could not be resolved")


@router.get("/notifications/channels")
def list_notification_channels(
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Return configured notification channels and recent delivery attempts."""

    repo = NotificationRepository(db)
    channels = repo.list_channels(owner_user_id=_owner_user_id(user))
    return {
        "channels": [
            {
                "id": channel.id,
                "channelType": channel.channel_type,
                "destination": channel.destination,
                "label": channel.label,
                "enabled": channel.enabled,
                "createdAt": _to_utc_iso(channel.created_at),
                "recentLogs": [
                    {
                        "id": log.id,
                        "sentAt": _to_utc_iso(log.sent_at),
                        "statusCode": log.status_code,
                        "error": log.error,
                    }
                    for log in repo.list_recent_logs(channel.id, limit=5)
                ],
            }
            for channel in channels
        ]
    }


@router.post("/notifications/channels")
def create_notification_channel(
    body: dict,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Create a webhook notification channel."""

    channel_type = body.get("channelType", CHANNEL_TYPE_WEBHOOK)
    destination = body.get("destination")
    label = body.get("label", "")
    if channel_type != CHANNEL_TYPE_WEBHOOK:
        raise HTTPException(status_code=422, detail="Unsupported channel type")
    if not isinstance(destination, str) or not destination.strip():
        raise HTTPException(status_code=422, detail="destination is required")
    if not isinstance(label, str):
        raise HTTPException(status_code=422, detail="label must be a string")
    _validate_webhook_url(destination)

    channel = NotificationRepository(db).create_channel(
        channel_type=channel_type,
        destination=destination,
        label=label.strip(),
        owner_user_id=_owner_user_id(user),
    )
    return {
        "id": channel.id,
        "channelType": channel.channel_type,
        "destination": channel.destination,
        "label": channel.label,
        "enabled": channel.enabled,
        "createdAt": _to_utc_iso(channel.created_at),
    }


@router.delete("/notifications/channels/{channel_id}")
def delete_notification_channel(
    channel_id: int,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Delete one notification channel."""

    deleted = NotificationRepository(db).delete_channel(channel_id, owner_user_id=_owner_user_id(user))
    if not deleted:
        raise HTTPException(status_code=404, detail="Notification channel not found")
    return {"ok": True}


@router.post("/notifications/channels/{channel_id}/test")
def test_notification_channel(
    channel_id: int,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Send a sample payload to one configured notification channel."""

    repo = NotificationRepository(db)
    channel = repo.get_channel(channel_id, owner_user_id=_owner_user_id(user))
    if channel is None:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    status_code, error = send_test_notification(db, channel)
    if error is not None:
        raise HTTPException(status_code=502, detail=error)
    return {"ok": True, "statusCode": status_code}
