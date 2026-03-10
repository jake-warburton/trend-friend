"""Shared payload builders for watchlist and community responses."""

from __future__ import annotations

from datetime import datetime, timezone

from app.data.repositories import TrendScoreRepository, WatchlistRepository
from app.models import AlertRule, Watchlist, WatchlistItem, WatchlistShare

WATCHLIST_SCORE_LOOKUP_LIMIT = 1000


def build_watchlist_payload(
    watchlist_repo: WatchlistRepository,
    score_repo: TrendScoreRepository,
) -> dict[str, object]:
    """Build the combined watchlists, shares, alerts, and matches payload."""

    latest_scores = score_repo.list_scores(limit=WATCHLIST_SCORE_LOOKUP_LIMIT)
    score_by_slug = {_slugify(score.topic): score for score in latest_scores}

    watchlists = watchlist_repo.list_watchlists()
    alerts = watchlist_repo.list_alert_rules()

    return {
        "watchlists": [
            _serialize_watchlist(watchlist, watchlist_repo.list_shares_for_watchlist(watchlist.id))
            for watchlist in watchlists
        ],
        "alerts": [_serialize_alert_rule(alert) for alert in alerts],
        "matches": _build_alert_matches(watchlists, alerts, score_by_slug),
    }


def build_shared_watchlist_payload(
    score_repo: TrendScoreRepository,
    share: WatchlistShare,
    watchlist: Watchlist,
) -> dict[str, object]:
    """Build the public payload for a tokenized watchlist share."""

    latest_scores = score_repo.list_scores(limit=WATCHLIST_SCORE_LOOKUP_LIMIT)
    score_by_slug = {_slugify(score.topic): score for score in latest_scores}

    return {
        "watchlist": {
            "id": watchlist.id,
            "name": watchlist.name,
            "itemCount": len(watchlist.items),
            "createdAt": _to_utc_iso(watchlist.created_at),
            "updatedAt": _to_utc_iso(watchlist.updated_at),
            "items": [
                _serialize_shared_watchlist_item(item, score_by_slug.get(item.trend_id))
                for item in watchlist.items
            ],
        },
        "shareToken": share.share_token,
        "public": share.is_public,
        "createdAt": _to_utc_iso(share.created_at),
    }


def build_public_watchlists_payload(public_watchlists: list[tuple[Watchlist, WatchlistShare]]) -> dict[str, object]:
    """Build the public community directory payload."""

    return {
        "watchlists": [
            {
                "id": watchlist.id,
                "name": watchlist.name,
                "itemCount": len(watchlist.items),
                "shareToken": share.share_token,
                "createdAt": _to_utc_iso(watchlist.created_at),
                "updatedAt": _to_utc_iso(watchlist.updated_at),
            }
            for watchlist, share in public_watchlists
        ]
    }


def _build_alert_matches(
    watchlists: list[Watchlist],
    alerts: list[AlertRule],
    score_by_slug: dict[str, object],
) -> list[dict[str, object]]:
    matches: list[dict[str, object]] = []
    for alert in alerts:
        watchlist = next((item for item in watchlists if item.id == alert.watchlist_id), None)
        if watchlist is None or not alert.enabled:
            continue
        for item in watchlist.items:
            score = score_by_slug.get(item.trend_id)
            if score is None:
                continue
            if alert.rule_type == "score_above" and score.total_score >= alert.threshold:
                matches.append(
                    {
                        "alertId": alert.id,
                        "alertName": alert.name,
                        "watchlistId": watchlist.id,
                        "trendId": item.trend_id,
                        "trendName": item.trend_name,
                        "ruleType": alert.rule_type,
                        "threshold": alert.threshold,
                        "currentValue": round(score.total_score, 1),
                    }
                )
    return matches


def _serialize_watchlist(watchlist: Watchlist, shares: list[WatchlistShare]) -> dict[str, object]:
    return {
        "id": watchlist.id,
        "name": watchlist.name,
        "createdAt": _to_utc_iso(watchlist.created_at),
        "updatedAt": _to_utc_iso(watchlist.updated_at),
        "items": [_serialize_watchlist_item(item) for item in watchlist.items],
        "shares": [
            {
                "id": share.id,
                "shareToken": share.share_token,
                "public": share.is_public,
                "createdAt": _to_utc_iso(share.created_at),
            }
            for share in shares
        ],
    }


def _serialize_watchlist_item(item: WatchlistItem) -> dict[str, str]:
    return {
        "trendId": item.trend_id,
        "trendName": item.trend_name,
        "addedAt": _to_utc_iso(item.added_at),
    }


def _serialize_shared_watchlist_item(item: WatchlistItem, score: object | None) -> dict[str, object]:
    payload: dict[str, object] = _serialize_watchlist_item(item)
    payload["currentScore"] = round(score.total_score, 1) if score is not None else None
    return payload


def _serialize_alert_rule(alert: AlertRule) -> dict[str, object]:
    return {
        "id": alert.id,
        "watchlistId": alert.watchlist_id,
        "name": alert.name,
        "ruleType": alert.rule_type,
        "threshold": alert.threshold,
        "enabled": alert.enabled,
        "createdAt": _to_utc_iso(alert.created_at),
    }


def _to_utc_iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _slugify(topic: str) -> str:
    normalized = "".join(character.lower() if character.isalnum() else "-" for character in topic)
    compact = "-".join(part for part in normalized.split("-") if part)
    return compact or "trend"
