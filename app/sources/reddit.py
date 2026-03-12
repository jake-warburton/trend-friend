"""Reddit source adapter using the public Atom/RSS feed.

Reddit's JSON API now blocks unauthenticated bot requests (403).
The Atom feed at /hot.rss remains publicly accessible and returns
titles, permalinks, timestamps, and subreddit labels — enough for
topic extraction.  Engagement scores are unavailable via RSS so
posts that made it to "hot" receive a base engagement value that
scales by position in the feed (higher-ranked = hotter).
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}
BASE_ENGAGEMENT = 500
"""Baseline engagement value for a post that made Reddit's hot feed."""


class RedditSourceAdapter(SourceAdapter):
    """Fetch hot Reddit posts via Atom RSS and normalize them."""

    source_name = "reddit"
    TREND_SUBREDDITS = [
        "technology",
        "programming",
        "MachineLearning",
        "artificial",
        "LocalLLaMA",
        "opensource",
        "startups",
        "entrepreneur",
    ]

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_rss()
        except Exception as error:
            self.log_fallback(error)
            return self.normalize_items(self.sample_payload())

    def _fetch_rss(self) -> list[RawSourceItem]:
        """Fetch the combined multi-subreddit Atom feed."""

        subreddit_path = "+".join(self.TREND_SUBREDDITS)
        limit = min(self.settings.max_items_per_source, 100)
        url = f"https://www.reddit.com/r/{subreddit_path}/hot.rss?limit={limit}"
        headers = {
            "User-Agent": self.settings.reddit_user_agent,
            "Accept": "application/atom+xml",
        }

        raw = self.get_url(url, headers=headers)
        root = ET.fromstring(raw.decode("utf-8"))
        entries = root.findall("atom:entry", ATOM_NS)
        self.raw_item_count = len(entries)

        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()

        for position, entry in enumerate(entries):
            title_el = entry.find("atom:title", ATOM_NS)
            link_el = entry.find("atom:link", ATOM_NS)
            updated_el = entry.find("atom:updated", ATOM_NS)
            id_el = entry.find("atom:id", ATOM_NS)
            cat_el = entry.find("atom:category", ATOM_NS)

            title = (title_el.text or "").strip() if title_el is not None else ""
            link = (link_el.get("href", "") if link_el is not None else "")
            updated = (updated_el.text or "") if updated_el is not None else ""
            external_id = (id_el.text or "").strip() if id_el is not None else ""
            subreddit = (cat_el.get("term", "") if cat_el is not None else "")

            if not title or not external_id:
                continue
            if external_id in seen_ids:
                continue
            seen_ids.add(external_id)

            # Higher position in the hot feed → higher engagement estimate
            engagement = max(BASE_ENGAGEMENT - position * 10, 50)

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=external_id,
                    title=title,
                    url=link,
                    timestamp=self._parse_updated(updated),
                    engagement_score=float(engagement),
                    metadata={"subreddit": subreddit},
                )
            )
            self.kept_item_count += 1
            if len(items) >= self.settings.max_items_per_source:
                break

        return items

    @staticmethod
    def _parse_updated(date_str: str) -> datetime:
        """Parse an Atom updated timestamp."""
        if not date_str:
            return datetime.now(tz=timezone.utc)
        try:
            normalized = date_str.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized)
        except (ValueError, TypeError):
            return datetime.now(tz=timezone.utc)

    def normalize_items(self, payload: dict[str, object], limit: int | None = None) -> list[RawSourceItem]:
        """Normalize Reddit listing payload into shared models (used for fallback sample data)."""

        children = payload.get("data", {}).get("children", [])
        items: list[RawSourceItem] = []
        max_items = self.settings.max_items_per_source if limit is None else limit
        for child in children[:max_items]:
            post = child.get("data", {})
            title = str(post.get("title", "")).strip()
            permalink = str(post.get("permalink", ""))
            created_utc = float(post.get("created_utc", 0.0))
            if not title or not created_utc:
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=str(post.get("id", "")),
                    title=title,
                    url=f"https://www.reddit.com{permalink}",
                    timestamp=self.parse_unix_timestamp(created_utc),
                    engagement_score=float(post.get("score", 0)) + float(post.get("num_comments", 0)),
                    metadata={"subreddit": str(post.get("subreddit", ""))},
                )
            )
        return items

    @staticmethod
    def sample_payload() -> dict[str, object]:
        """Return deterministic sample data for local fallback runs."""

        return {
            "data": {
                "children": [
                    {
                        "data": {
                            "id": "r1",
                            "title": "AI agents are replacing repetitive office workflows",
                            "permalink": "/r/technology/comments/r1",
                            "created_utc": 1_709_200_000,
                            "score": 4200,
                            "num_comments": 680,
                            "subreddit": "technology",
                        }
                    },
                    {
                        "data": {
                            "id": "r2",
                            "title": "Open source robotics tools gain momentum in startups",
                            "permalink": "/r/startups/comments/r2",
                            "created_utc": 1_709_203_600,
                            "score": 2800,
                            "num_comments": 220,
                            "subreddit": "startups",
                        }
                    },
                ]
            }
        }
