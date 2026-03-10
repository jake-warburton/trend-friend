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

    share_watchlist = subparsers.add_parser("share-watchlist")
    share_watchlist.add_argument("--watchlist-id", type=int, required=True)
    share_watchlist.add_argument("--public", action="store_true")

    get_shared = subparsers.add_parser("get-shared")
    get_shared.add_argument("--token", required=True)

    subparsers.add_parser("list-public")

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
    elif args.command == "share-watchlist":
        payload = share_payload(
            watchlist_repository=watchlist_repository,
            watchlist_id=args.watchlist_id,
            public=args.public,
        )
    elif args.command == "get-shared":
        payload = get_shared_payload(
            watchlist_repository=watchlist_repository,
            score_repository=score_repository,
            token=args.token,
        )
    elif args.command == "list-public":
        payload = list_public_payload(watchlist_repository)
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
    from app.watchlists_payloads import build_watchlist_payload

    return build_watchlist_payload(watchlist_repository, score_repository)


def share_payload(
    watchlist_repository: WatchlistRepository,
    watchlist_id: int,
    public: bool,
) -> dict[str, object]:
    """Create and return a share payload."""

    import secrets

    watchlist = watchlist_repository.get_watchlist(watchlist_id)
    if watchlist is None:
        return {"error": "Watchlist not found"}

    share = watchlist_repository.create_share(
        watchlist_id=watchlist_id,
        share_token=secrets.token_urlsafe(16),
        is_public=public,
    )
    return {
        "shareToken": share.share_token,
        "public": share.is_public,
        "createdAt": share.created_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def get_shared_payload(
    watchlist_repository: WatchlistRepository,
    score_repository: TrendScoreRepository,
    token: str,
) -> dict[str, object]:
    """Return a shared watchlist payload."""

    from app.watchlists_payloads import build_shared_watchlist_payload

    share = watchlist_repository.get_share_by_token(token)
    if share is None:
        return {"error": "Share link not found"}
    watchlist = watchlist_repository.get_watchlist(share.watchlist_id)
    if watchlist is None:
        return {"error": "Watchlist not found"}
    return build_shared_watchlist_payload(score_repository, share, watchlist)


def list_public_payload(watchlist_repository: WatchlistRepository) -> dict[str, object]:
    """Return the public watchlist directory payload."""

    from app.watchlists_payloads import build_public_watchlists_payload

    return build_public_watchlists_payload(watchlist_repository.list_public_watchlists())


if __name__ == "__main__":
    main()
