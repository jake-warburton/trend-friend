"""JSON CLI for watchlists and alert rules."""

from __future__ import annotations

import argparse
import json
from datetime import timezone

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.data.database import connect_database, initialize_database
from app.data.repositories import TrendScoreRepository, WatchlistRepository


def main() -> None:
    """Dispatch watchlist commands and print JSON responses."""

    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list")

    create_watchlist = subparsers.add_parser("create-watchlist")
    create_watchlist.add_argument("--name", required=True)

    add_item = subparsers.add_parser("add-item")
    add_item.add_argument("--watchlist-id", type=int, required=True)
    add_item.add_argument("--trend-id", required=True)
    add_item.add_argument("--trend-name", required=True)

    remove_item = subparsers.add_parser("remove-item")
    remove_item.add_argument("--watchlist-id", type=int, required=True)
    remove_item.add_argument("--trend-id", required=True)

    create_alert = subparsers.add_parser("create-alert")
    create_alert.add_argument("--watchlist-id", type=int, required=True)
    create_alert.add_argument("--name", required=True)
    create_alert.add_argument("--rule-type", required=True)
    create_alert.add_argument("--threshold", type=float, required=True)

    args = parser.parse_args()
    settings = load_settings()
    connection = connect_database(settings.database_path)
    initialize_database(connection)
    watchlist_repository = WatchlistRepository(connection)
    score_repository = TrendScoreRepository(connection)
    watchlist_repository.ensure_default_watchlist()

    if args.command == "list":
        payload = build_payload(
            watchlist_repository=watchlist_repository,
            score_repository=score_repository,
        )
    elif args.command == "create-watchlist":
        watchlist_repository.create_watchlist(args.name)
        payload = build_payload(
            watchlist_repository=watchlist_repository,
            score_repository=score_repository,
        )
    elif args.command == "add-item":
        watchlist_repository.add_item(args.watchlist_id, args.trend_id, args.trend_name)
        payload = build_payload(
            watchlist_repository=watchlist_repository,
            score_repository=score_repository,
        )
    elif args.command == "remove-item":
        watchlist_repository.remove_item(args.watchlist_id, args.trend_id)
        payload = build_payload(
            watchlist_repository=watchlist_repository,
            score_repository=score_repository,
        )
    else:
        watchlist_repository.create_alert_rule(
            watchlist_id=args.watchlist_id,
            name=args.name,
            rule_type=args.rule_type,
            threshold=args.threshold,
        )
        payload = build_payload(
            watchlist_repository=watchlist_repository,
            score_repository=score_repository,
        )

    connection.close()
    print(json.dumps(payload))


def build_payload(
    watchlist_repository: WatchlistRepository,
    score_repository: TrendScoreRepository,
) -> dict[str, object]:
    """Build the JSON payload used by the web API."""

    latest_scores = score_repository.list_scores(limit=100)
    score_by_slug = {
        slugify(score.topic): score for score in latest_scores
    }
    watchlists = watchlist_repository.list_watchlists()
    alerts = watchlist_repository.list_alert_rules()

    alert_matches = []
    for alert in alerts:
        watchlist = next((item for item in watchlists if item.id == alert.watchlist_id), None)
        if watchlist is None or not alert.enabled:
            continue
        for item in watchlist.items:
            score = score_by_slug.get(item.trend_id)
            if score is None:
                continue
            if alert.rule_type == "score_above" and score.total_score >= alert.threshold:
                alert_matches.append(
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

    return {
        "watchlists": [
            {
                "id": watchlist.id,
                "name": watchlist.name,
                "createdAt": to_timestamp(watchlist.created_at),
                "updatedAt": to_timestamp(watchlist.updated_at),
                "items": [
                    {
                        "trendId": item.trend_id,
                        "trendName": item.trend_name,
                        "addedAt": to_timestamp(item.added_at),
                    }
                    for item in watchlist.items
                ],
            }
            for watchlist in watchlists
        ],
        "alerts": [
            {
                "id": alert.id,
                "watchlistId": alert.watchlist_id,
                "name": alert.name,
                "ruleType": alert.rule_type,
                "threshold": alert.threshold,
                "enabled": alert.enabled,
                "createdAt": to_timestamp(alert.created_at),
            }
            for alert in alerts
        ],
        "matches": alert_matches,
    }


def to_timestamp(value) -> str:
    """Return a UTC ISO-8601 timestamp."""

    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def slugify(topic: str) -> str:
    """Convert a topic to a stable slug identifier."""

    normalized = "".join(character.lower() if character.isalnum() else "-" for character in topic)
    compact = "-".join(part for part in normalized.split("-") if part)
    return compact or "trend"


if __name__ == "__main__":
    main()
