"""Reddit source adapter using public Atom/RSS feeds."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter


class RedditSourceAdapter(SourceAdapter):
    """Fetch hot Reddit posts via RSS and normalize them."""

    source_name = "reddit"
    TREND_SUBREDDITS = [
        "technology",
        "programming",
        "MachineLearning",
        "opensource",
        "startups",
    ]

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_rss()
        except Exception as error:
            self.log_fallback(error)
            return self.normalize_items(self.sample_payload())

    def _fetch_rss(self) -> list[RawSourceItem]:
        """Fetch the Atom feed from Reddit's public RSS endpoint."""

        subreddit_path = "+".join(self.TREND_SUBREDDITS)
        url = f"https://www.reddit.com/r/{subreddit_path}/hot.rss"
        xml_bytes = self.get_url(url, headers={
            "User-Agent": self.settings.reddit_user_agent,
            "Accept": "application/atom+xml, application/rss+xml, application/xml",
        })
        return self._parse_atom(xml_bytes)

    def _parse_atom(self, xml_bytes: bytes) -> list[RawSourceItem]:
        """Parse Atom XML into normalized items."""

        ns = {"atom": "http://www.w3.org/2005/Atom"}
        root = ET.fromstring(xml_bytes)

        items: list[RawSourceItem] = []
        for entry in root.findall("atom:entry", ns):
            title = (entry.findtext("atom:title", namespaces=ns) or "").strip()
            if not title:
                continue

            link_el = entry.find("atom:link", ns)
            link = link_el.get("href", "") if link_el is not None else ""
            entry_id = entry.findtext("atom:id", namespaces=ns) or ""
            updated = entry.findtext("atom:updated", namespaces=ns) or ""
            author = entry.findtext("atom:author/atom:name", namespaces=ns) or ""

            # Extract subreddit from the category element
            category_el = entry.find("atom:category", ns)
            subreddit = category_el.get("term", "") if category_el is not None else ""

            timestamp = self._parse_updated(updated)

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=entry_id,
                    title=title,
                    url=link,
                    timestamp=timestamp,
                    engagement_score=1.0,  # RSS feed doesn't include scores
                    metadata={"subreddit": subreddit, "author": author},
                )
            )

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

    def normalize_items(self, payload: dict[str, object]) -> list[RawSourceItem]:
        """Normalize Reddit listing payload into shared models (used for fallback sample data)."""

        children = payload.get("data", {}).get("children", [])
        items: list[RawSourceItem] = []
        for child in children[: self.settings.max_items_per_source]:
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
