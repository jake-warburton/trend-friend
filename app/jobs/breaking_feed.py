"""Breaking feed mini-pipeline: extract topics, score, and publish."""

from __future__ import annotations

import json
import logging
import math
from collections import defaultdict
from datetime import datetime, timezone

from app.config import Settings
from app.data.connection import DatabaseConnection
from app.data.repositories import PublishedPayloadRepository, TwitterTweetRepository
from app.exports.contracts import BreakingFeedPayload, BreakingItemPayload, BreakingTweetPayload
from app.exports.serializers import build_breaking_feed_payload
from app.models import RawSourceItem
from app.topics.extract import extract_candidate_topics_for_item

LOGGER = logging.getLogger(__name__)

BREAKING_WINDOW_HOURS = 2
BREAKING_FEED_KEY = "breaking-feed.json"

TIER_WEIGHTS = {"high": 2.0, "medium": 1.0}


def compute_breaking_score(
    tier: str,
    total_engagement: float,
    age_minutes: float,
    account_count: int,
) -> float:
    """Compute breaking score per the spec formula."""
    tier_weight = TIER_WEIGHTS.get(tier, 1.0)
    log_engagement = math.log10(total_engagement + 1)
    recency_factor = max(0.1, 1.0 - (age_minutes / 120.0))
    corroboration_boost = min(3.0, 1.0 + 0.5 * (account_count - 1))
    return tier_weight * log_engagement * recency_factor * corroboration_boost


def group_tweets_by_topic(
    tweets_with_topics: list[tuple[dict, list[str]]],
) -> dict[str, list[dict]]:
    """Group tweets by their extracted topics."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for tweet, topics in tweets_with_topics:
        for topic in topics:
            groups[topic].append(tweet)
    return dict(groups)


def build_breaking_items(
    grouped: dict[str, list[dict]],
    now: datetime,
) -> list[BreakingItemPayload]:
    """Build scored BreakingItemPayload list from grouped tweets."""
    items: list[BreakingItemPayload] = []
    for topic, tweets in grouped.items():
        accounts = set()
        total_engagement = 0.0
        min_age = float("inf")
        max_tier = "medium"
        tweet_payloads = []

        for tweet in tweets:
            handle = tweet["account_handle"]
            accounts.add(handle)
            total_engagement += tweet["engagement"]

            metadata = json.loads(tweet["metadata"]) if isinstance(tweet["metadata"], str) else (tweet["metadata"] or {})
            tier = metadata.get("tier", "medium")
            if tier == "high":
                max_tier = "high"

            ts_str = tweet["timestamp"]
            if isinstance(ts_str, str):
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            else:
                ts = ts_str
            age = (now - ts).total_seconds() / 60.0
            min_age = min(min_age, age)

            raw_ts = tweet["timestamp"]
            ts_str = raw_ts.isoformat() if hasattr(raw_ts, "isoformat") else str(raw_ts)
            tweet_payloads.append(BreakingTweetPayload(
                account=handle,
                text=tweet["text"],
                tweet_id=tweet["tweet_id"],
                timestamp=ts_str,
                engagement=tweet["engagement"],
            ))

        account_count = len(accounts)
        score = compute_breaking_score(max_tier, total_engagement, min_age, account_count)

        items.append(BreakingItemPayload(
            topic=topic,
            breaking_score=round(score, 2),
            corroborated=account_count >= 2,
            account_count=account_count,
            tweets=tweet_payloads,
        ))

    items.sort(key=lambda x: x.breaking_score, reverse=True)
    return items


def run_breaking_feed_pipeline(
    settings: Settings,
    connection: DatabaseConnection,
) -> int:
    """Run the breaking feed mini-pipeline. Returns number of breaking items published."""
    now = datetime.now(tz=timezone.utc)
    tweet_repo = TwitterTweetRepository(connection)
    payload_repo = PublishedPayloadRepository(connection)

    recent_tweets = tweet_repo.fetch_recent_tweets(hours=BREAKING_WINDOW_HOURS)
    if not recent_tweets:
        feed = build_breaking_feed_payload(now, [])
        feed_dict = feed.to_dict()
        payload_repo.replace_payloads([
            (BREAKING_FEED_KEY, feed_dict["updatedAt"], json.dumps(feed_dict)),
        ])
        return 0

    # Extract topics for each tweet
    tweets_with_topics: list[tuple[dict, list[str]]] = []
    for tweet in recent_tweets:
        metadata = json.loads(tweet["metadata"]) if isinstance(tweet["metadata"], str) else (tweet["metadata"] or {})
        ts_str = tweet["timestamp"]
        try:
            timestamp = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if isinstance(ts_str, str) else ts_str
        except (ValueError, TypeError):
            timestamp = datetime.now(tz=timezone.utc)

        item = RawSourceItem(
            source="twitter",
            external_id=tweet["tweet_id"],
            title=tweet["text"],
            url=f"https://x.com/i/status/{tweet['tweet_id']}",
            timestamp=timestamp,
            engagement_score=tweet["engagement"],
            metadata=metadata,
        )
        topics = extract_candidate_topics_for_item(item)
        if topics:
            tweets_with_topics.append((tweet, topics))

    grouped = group_tweets_by_topic(tweets_with_topics)
    items = build_breaking_items(grouped, now)
    feed = build_breaking_feed_payload(now, items)
    feed_dict = feed.to_dict()

    payload_repo.replace_payloads([
        (BREAKING_FEED_KEY, feed_dict["updatedAt"], json.dumps(feed_dict)),
    ])

    LOGGER.info("Breaking feed: %d items published", len(items))
    return len(items)
