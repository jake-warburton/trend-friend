"""Standalone Twitter scraper using twikit with pre-exported cookies.

Twikit's login flow is blocked by Cloudflare 403, but data-fetching
endpoints work fine with valid session cookies.  This module expects
cookies to be provided via the TWITTER_COOKIES_JSON env var (a JSON
dict with at least ``auth_token`` and ``ct0`` keys).

Cookie export workflow (one-time, refresh when cookies expire):
  1. Log in to x.com in a browser.
  2. Open DevTools -> Application -> Cookies -> https://x.com
  3. Copy ``auth_token`` and ``ct0`` values.
  4. Set env: TWITTER_COOKIES_JSON='{"auth_token":"...","ct0":"..."}'

Falls back to the legacy twscrape path if twikit is unavailable.
"""

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


# ---------------------------------------------------------------------------
# twikit cookie-based scraper (preferred)
# ---------------------------------------------------------------------------

async def _scrape_with_twikit(
    settings: Settings,
    repo: TwitterTweetRepository,
    stats: dict[str, int],
) -> dict[str, int]:
    """Scrape using twikit + pre-exported browser cookies (no login call)."""
    import twikit

    cookies_json = settings.twitter_cookies_json
    if not cookies_json:
        raise ValueError("TWITTER_COOKIES_JSON not set")

    cookies = json.loads(cookies_json)
    if "auth_token" not in cookies or "ct0" not in cookies:
        raise ValueError("TWITTER_COOKIES_JSON must contain auth_token and ct0")

    client = twikit.Client("en-US")
    client.set_cookies(cookies)

    for account in TWITTER_ACCOUNTS:
        stats["accounts_checked"] += 1
        try:
            latest_stored = repo.latest_tweet_id(account.handle)

            user = await client.get_user_by_screen_name(account.handle)
            user_tweets = await client.get_user_tweets(user.id, "Tweets", count=TWEETS_PER_ACCOUNT)

            if not user_tweets:
                stats["skipped"] += 1
                continue

            tweets_list = list(user_tweets)

            # Early exit: if newest tweet matches what we have, skip
            if latest_stored and tweets_list and str(tweets_list[0].id) == latest_stored:
                stats["skipped"] += 1
                continue

            rows = []
            for tweet in tweets_list:
                tweet_id = str(tweet.id)
                # Stop if we reach already-stored tweets
                if latest_stored and tweet_id == latest_stored:
                    break

                likes = getattr(tweet, "favorite_count", 0) or 0
                retweets = getattr(tweet, "retweet_count", 0) or 0
                replies = getattr(tweet, "reply_count", 0) or 0
                engagement = compute_engagement(likes, retweets, replies)

                author_name = account.handle
                if hasattr(tweet, "user") and tweet.user:
                    author_name = getattr(tweet.user, "screen_name", account.handle) or account.handle

                metadata = json.dumps({
                    "author_name": author_name,
                    "tier": account.tier,
                    "verticals": list(account.verticals),
                })

                ts = datetime.now(tz=timezone.utc).isoformat()
                if hasattr(tweet, "created_at") and tweet.created_at:
                    ts = tweet.created_at

                rows.append((
                    account.handle,
                    tweet_id,
                    getattr(tweet, "full_text", None) or getattr(tweet, "text", str(tweet)),
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


# ---------------------------------------------------------------------------
# Legacy twscrape fallback
# ---------------------------------------------------------------------------

async def _scrape_with_twscrape(
    settings: Settings,
    repo: TwitterTweetRepository,
    stats: dict[str, int],
) -> dict[str, int]:
    """Fallback: scrape using twscrape (requires working login)."""
    import twscrape

    accounts_json = settings.twitter_scrape_accounts
    if not accounts_json:
        raise ValueError("TWITTER_SCRAPE_ACCOUNTS not set")

    api = twscrape.API()
    creds = json.loads(accounts_json)
    if isinstance(creds, dict):
        creds = [creds]
    for cred in creds:
        await api.pool.add_account(
            cred["username"], cred["password"], cred["email"], cred["email_password"],
            cookies=cred.get("cookies"),
        )
    await api.pool.login_all()

    for account in TWITTER_ACCOUNTS:
        stats["accounts_checked"] += 1
        try:
            latest_stored = repo.latest_tweet_id(account.handle)

            user = await api.user_by_login(account.handle)
            tweets = []
            async for tweet in api.user_tweets(user.id, limit=TWEETS_PER_ACCOUNT):
                tweets.append(tweet)

            if not tweets:
                stats["skipped"] += 1
                continue

            if latest_stored and str(tweets[0].id) == latest_stored:
                stats["skipped"] += 1
                continue

            rows = []
            for tweet in tweets:
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


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def scrape_twitter_accounts(
    settings: Settings,
    connection: DatabaseConnection,
) -> dict[str, int]:
    """Scrape curated accounts and upsert tweets. Returns stats dict."""
    repo = TwitterTweetRepository(connection)
    stats = {"accounts_checked": 0, "new_tweets": 0, "skipped": 0, "errors": 0}

    # Strategy 1: twikit with pre-exported cookies (preferred — no login needed)
    if settings.twitter_cookies_json:
        try:
            LOGGER.info("Using twikit cookie-based scraper")
            return await _scrape_with_twikit(settings, repo, stats)
        except ImportError:
            LOGGER.warning("twikit not installed, falling back to twscrape")
        except Exception as exc:
            LOGGER.error("twikit scraper failed: %s", exc)

    # Strategy 2: twscrape with login credentials (blocked by Cloudflare as of 2026-03)
    if settings.twitter_scrape_accounts:
        try:
            LOGGER.info("Using twscrape login-based scraper (may fail with Cloudflare)")
            return await _scrape_with_twscrape(settings, repo, stats)
        except ImportError:
            LOGGER.warning("twscrape not installed")
        except Exception as exc:
            LOGGER.error("twscrape scraper failed: %s", exc)

    LOGGER.error("No working Twitter scraper — set TWITTER_COOKIES_JSON or TWITTER_SCRAPE_ACCOUNTS")
    return stats
