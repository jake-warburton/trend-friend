"""Standalone Twitter scraper using twscrape for curated account timelines."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.config import Settings
from app.data.connection import DatabaseConnection
from app.data.repositories import TwitterTweetRepository
from app.sources.twitter_accounts import TWITTER_ACCOUNTS

LOGGER = logging.getLogger(__name__)

TWEETS_PER_ACCOUNT = 10
PRUNE_KEEP = 100


def compute_engagement(likes: int, retweets: int, replies: int) -> float:
    """Compute engagement score: likes + 2*retweets + replies."""
    return float(likes) + float(retweets) * 2.0 + float(replies)


async def _resolve_user_id(api, handle: str) -> int:
    """Resolve a handle to a Twitter user ID."""
    user = await api.user_by_login(handle)
    return user.id


async def scrape_twitter_accounts(
    settings: Settings,
    connection: DatabaseConnection,
) -> dict[str, int]:
    """Scrape curated accounts and upsert tweets. Returns stats dict."""
    import twscrape

    repo = TwitterTweetRepository(connection)
    stats = {"accounts_checked": 0, "new_tweets": 0, "skipped": 0, "errors": 0}

    accounts_json = settings.twitter_scrape_accounts
    if not accounts_json:
        LOGGER.error("TWITTER_SCRAPE_ACCOUNTS not set — skipping scrape")
        return stats

    api = twscrape.API()
    try:
        creds = json.loads(accounts_json)
        if isinstance(creds, dict):
            creds = [creds]
        for cred in creds:
            await api.pool.add_account(
                cred["username"], cred["password"], cred["email"], cred["email_password"],
                cookies=cred.get("cookies"),
            )
        await api.pool.login_all()
    except Exception as exc:
        LOGGER.error("Failed to initialize twscrape: %s", exc)
        return stats

    for account in TWITTER_ACCOUNTS:
        stats["accounts_checked"] += 1
        try:
            latest_stored = repo.latest_tweet_id(account.handle)

            user_id = await _resolve_user_id(api, account.handle)
            tweets = []
            async for tweet in api.user_tweets(user_id, limit=TWEETS_PER_ACCOUNT):
                tweets.append(tweet)

            if not tweets:
                stats["skipped"] += 1
                continue

            # Early exit: if newest tweet matches what we have, skip
            if latest_stored and str(tweets[0].id) == latest_stored:
                stats["skipped"] += 1
                continue

            rows = []
            for tweet in tweets:
                # Stop if we reach already-stored tweets
                if latest_stored and str(tweet.id) == latest_stored:
                    break
                engagement = compute_engagement(
                    getattr(tweet, "likeCount", 0) or 0,
                    getattr(tweet, "retweetCount", 0) or 0,
                    getattr(tweet, "replyCount", 0) or 0,
                )
                metadata = json.dumps({
                    "author_name": getattr(tweet.user, "username", account.handle) if hasattr(tweet, "user") else account.handle,
                    "tier": account.tier,
                    "verticals": list(account.verticals),
                })
                ts = tweet.date.isoformat() if hasattr(tweet, "date") and tweet.date else datetime.now(tz=timezone.utc).isoformat()
                rows.append((
                    account.handle,
                    str(tweet.id),
                    tweet.rawContent if hasattr(tweet, "rawContent") else str(tweet),
                    ts,
                    engagement,
                    datetime.now(tz=timezone.utc).isoformat(),
                    metadata,
                ))

            if rows:
                repo.upsert_tweets(rows)
                stats["new_tweets"] += len(rows)

            repo.prune_account(account.handle, keep=PRUNE_KEEP)

        except Exception as exc:
            LOGGER.warning("Error processing @%s: %s", account.handle, exc)
            stats["errors"] += 1

    return stats
