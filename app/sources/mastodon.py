"""Mastodon source adapter using public trending endpoints.

Mastodon instances expose public API endpoints for trending tags and
statuses without requiring authentication.  This adapter fetches from
multiple curated instances (general, tech, open-source, security) to
capture a broad slice of fediverse conversation.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

HTML_TAG_RE = re.compile(r"<[^>]+>")
"""Simple regex to strip HTML tags from status content."""

TRENDING_TAG_ENDPOINTS = [
    ("mastodon.social", "https://mastodon.social/api/v1/trends/tags"),
    ("hachyderm.io", "https://hachyderm.io/api/v1/trends/tags"),
    ("fosstodon.org", "https://fosstodon.org/api/v1/trends/tags"),
    ("infosec.exchange", "https://infosec.exchange/api/v1/trends/tags"),
    ("mas.to", "https://mas.to/api/v1/trends/tags"),
]

TRENDING_STATUS_ENDPOINTS = [
    ("mastodon.social", "https://mastodon.social/api/v1/trends/statuses"),
]


class MastodonSourceAdapter(SourceAdapter):
    """Fetch trending tags and statuses from multiple Mastodon instances."""

    source_name = "mastodon"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_trends()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample_payload(self.sample_payload())

    def _fetch_trends(self) -> list[RawSourceItem]:
        """Fetch trending tags and statuses across all configured instances."""

        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()

        for instance, url in TRENDING_TAG_ENDPOINTS:
            try:
                data = self.get_json(url)
            except Exception:
                continue
            self.raw_item_count += len(data)

            for tag in data:
                item = self._build_tag_item(tag, instance)
                if item is None or item.external_id in seen_ids:
                    continue
                seen_ids.add(item.external_id)
                items.append(item)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    return items

        for instance, url in TRENDING_STATUS_ENDPOINTS:
            try:
                data = self.get_json(url)
            except Exception:
                continue
            self.raw_item_count += len(data)

            for status in data:
                item = self._build_status_item(status, instance)
                if item is None or item.external_id in seen_ids:
                    continue
                seen_ids.add(item.external_id)
                items.append(item)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    return items

        return items

    def _build_tag_item(self, tag: dict, instance: str) -> RawSourceItem | None:
        """Normalize one trending tag into a shared source item."""

        name = tag.get("name", "").strip()
        if not name:
            return None

        url = tag.get("url", f"https://{instance}/tags/{name}")
        engagement = self._calculate_tag_engagement(tag)
        history = tag.get("history", [])
        timestamp = self._timestamp_from_history(history)

        return RawSourceItem(
            source=self.source_name,
            external_id=f"tag:{instance}:{name}",
            title=f"#{name}",
            url=url,
            timestamp=timestamp,
            engagement_score=float(engagement),
            metadata={"instance": instance, "type": "tag"},
        )

    def _build_status_item(self, status: dict, instance: str) -> RawSourceItem | None:
        """Normalize one trending status into a shared source item."""

        status_id = str(status.get("id", "")).strip()
        content_html = status.get("content", "")
        title = _strip_html(content_html).strip()
        if not status_id or not title:
            return None

        # Truncate long status text to a reasonable title length
        if len(title) > 200:
            title = title[:197] + "..."

        url = status.get("url", "")
        created_at = status.get("created_at", "")
        favourites = int(status.get("favourites_count", 0))
        reblogs = int(status.get("reblogs_count", 0))
        replies = int(status.get("replies_count", 0))
        engagement = float(favourites + 2 * reblogs + replies)

        return RawSourceItem(
            source=self.source_name,
            external_id=f"status:{instance}:{status_id}",
            title=title,
            url=url,
            timestamp=self._parse_created_at(created_at),
            engagement_score=engagement,
            metadata={
                "instance": instance,
                "type": "status",
                "favourites": favourites,
                "reblogs": reblogs,
                "replies": replies,
            },
        )

    @staticmethod
    def _calculate_tag_engagement(tag: dict) -> float:
        """Calculate engagement from tag history: uses x accounts for the most recent day."""

        history = tag.get("history", [])
        if not history:
            return 0.0
        recent = history[0]
        uses = int(recent.get("uses", 0))
        accounts = int(recent.get("accounts", 0))
        return float(uses * accounts)

    @staticmethod
    def _timestamp_from_history(history: list[dict]) -> datetime:
        """Derive a timestamp from the most recent history entry."""

        if history:
            try:
                day_ts = int(history[0].get("day", 0))
                if day_ts > 0:
                    return datetime.fromtimestamp(day_ts, tz=timezone.utc)
            except (ValueError, TypeError):
                pass
        return datetime.now(tz=timezone.utc)

    @staticmethod
    def _parse_created_at(date_str: str) -> datetime:
        """Parse an ISO 8601 timestamp from a Mastodon status."""

        if not date_str:
            return datetime.now(tz=timezone.utc)
        try:
            normalized = date_str.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized)
        except (ValueError, TypeError):
            return datetime.now(tz=timezone.utc)

    def _normalize_sample_payload(self, payload: dict) -> list[RawSourceItem]:
        """Normalize fallback sample data into shared models."""

        items: list[RawSourceItem] = []
        for tag in payload.get("tags", []):
            item = self._build_tag_item(tag, "mastodon.social")
            if item is not None:
                items.append(item)
        for status in payload.get("statuses", []):
            item = self._build_status_item(status, "mastodon.social")
            if item is not None:
                items.append(item)
        return items[: self.settings.max_items_per_source]

    @staticmethod
    def sample_payload() -> dict:
        """Return deterministic sample data for local fallback runs."""

        return {
            "tags": [
                {
                    "name": "ai",
                    "url": "https://mastodon.social/tags/ai",
                    "history": [
                        {"day": "1709200000", "uses": "350", "accounts": "120"},
                    ],
                },
                {
                    "name": "opensource",
                    "url": "https://mastodon.social/tags/opensource",
                    "history": [
                        {"day": "1709200000", "uses": "210", "accounts": "85"},
                    ],
                },
                {
                    "name": "cybersecurity",
                    "url": "https://mastodon.social/tags/cybersecurity",
                    "history": [
                        {"day": "1709200000", "uses": "180", "accounts": "60"},
                    ],
                },
            ],
            "statuses": [
                {
                    "id": "m1",
                    "content": "<p>Large language models are reshaping developer tooling across the industry</p>",
                    "url": "https://mastodon.social/@user/m1",
                    "created_at": "2024-02-29T12:00:00Z",
                    "favourites_count": 240,
                    "reblogs_count": 95,
                    "replies_count": 38,
                },
                {
                    "id": "m2",
                    "content": "<p>New open-source framework for privacy-preserving machine learning released</p>",
                    "url": "https://mastodon.social/@user/m2",
                    "created_at": "2024-02-29T14:30:00Z",
                    "favourites_count": 180,
                    "reblogs_count": 72,
                    "replies_count": 25,
                },
            ],
        }


def _strip_html(html: str) -> str:
    """Remove HTML tags from a string using a simple regex."""

    return HTML_TAG_RE.sub("", html)
