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
    """Fetch Reddit posts from multiple curated RSS feeds and normalize them."""

    source_name = "reddit"
    TREND_SUBREDDITS = [
        # Tech & development
        "technology",
        "programming",
        "MachineLearning",
        "artificial",
        "LocalLLaMA",
        "opensource",
        "webdev",
        "devops",
        "datascience",
        "cybersecurity",
        # Startups & business
        "startups",
        "entrepreneur",
        "SaaS",
        "sideproject",
        "indiehackers",
        "smallbusiness",
        "ecommerce",
        # News & world
        "news",
        "worldnews",
        "politics",
        "geopolitics",
        "economics",
        "finance",
        # Consumer & culture
        "sports",
        "nba",
        "nfl",
        "soccer",
        "games",
        "pcgaming",
        "movies",
        "television",
        "popculturechat",
        "singularity",
        # Science & health
        "science",
        "Futurology",
        "biotech",
        "space",
        # Product & design
        "ProductManagement",
        "userexperience",
        # Crypto & fintech
        "CryptoCurrency",
        "defi",
        # Health & fitness
        "fitness",
        "nutrition",
        "loseit",
        "running",
        "yoga",
        # Beauty & fashion
        "SkincareAddiction",
        "MakeupAddiction",
        "femalefashionadvice",
        "malefashionadvice",
        "streetwear",
        # Food & cooking
        "Cooking",
        "food",
        "MealPrepSunday",
        "EatCheapAndHealthy",
        # Home & lifestyle
        "HomeImprovement",
        "InteriorDesign",
        "DIY",
        "gardening",
        "BuyItForLife",
        # Pets
        "dogs",
        "cats",
        "pets",
        # Travel
        "travel",
        "solotravel",
        "digitalnomad",
        # Parenting & education
        "Parenting",
        "Teachers",
        # Environment & sustainability
        "sustainability",
        "ZeroWaste",
        "RenewableEnergy",
        # Cars & auto
        "cars",
        "electricvehicles",
    ]
    FEED_SPECS = (
        ("hot", None),
        ("new", None),
        ("top", "day"),
        ("top", "week"),
    )
    SUBREDDITS_PER_FEED = 4

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_rss()
        except Exception as error:
            self.log_fallback(error)
            return self.normalize_items(self.sample_payload())

    def _fetch_rss(self) -> list[RawSourceItem]:
        """Fetch multiple curated Reddit feeds for better topic coverage."""

        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        subreddit_groups = self._subreddit_groups()
        feed_limit = max(4, min(self.settings.max_items_per_source // max(len(subreddit_groups), 1), 8))
        feed_specs = self.FEED_SPECS[: max(1, min(self.settings.reddit_page_limit, len(self.FEED_SPECS)))]

        for feed_name, time_window in feed_specs:
            for subreddit_group in subreddit_groups:
                subreddit_path = "+".join(subreddit_group)
                url = self._build_feed_url(subreddit_path, feed_name, feed_limit, time_window)
                headers = {
                    "User-Agent": self.settings.reddit_user_agent,
                    "Accept": "application/atom+xml",
                }
                raw = self.get_url(url, headers=headers)
                root = ET.fromstring(raw.decode("utf-8"))
                entries = root.findall("atom:entry", ATOM_NS)
                self.raw_item_count += len(entries)

                for position, entry in enumerate(entries):
                    item = self._build_item_from_entry(entry, position, feed_name, time_window)
                    if item is None or item.external_id in seen_ids:
                        continue
                    seen_ids.add(item.external_id)
                    items.append(item)
                    self.kept_item_count += 1
                    if len(items) >= self.settings.max_items_per_source:
                        return items

        return items

    def _subreddit_groups(self) -> list[list[str]]:
        """Split the subreddit list into small feed batches to widen coverage."""

        group_size = max(1, self.SUBREDDITS_PER_FEED)
        return [
            self.TREND_SUBREDDITS[index : index + group_size]
            for index in range(0, len(self.TREND_SUBREDDITS), group_size)
        ]

    @staticmethod
    def _build_feed_url(subreddit_path: str, feed_name: str, limit: int, time_window: str | None) -> str:
        """Return one Reddit RSS URL for a subreddit batch and feed type."""

        url = f"https://www.reddit.com/r/{subreddit_path}/{feed_name}.rss?limit={limit}"
        if time_window:
            url = f"{url}&t={time_window}"
        return url

    def _build_item_from_entry(
        self,
        entry: ET.Element,
        position: int,
        feed_name: str,
        time_window: str | None,
    ) -> RawSourceItem | None:
        """Normalize one Atom entry into a shared source item."""

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
            return None

        engagement = self._estimate_engagement(position, feed_name, time_window)
        metadata = {"subreddit": subreddit, "feed": feed_name}
        if time_window:
            metadata["window"] = time_window

        return RawSourceItem(
            source=self.source_name,
            external_id=external_id,
            title=title,
            url=link,
            timestamp=self._parse_updated(updated),
            engagement_score=float(engagement),
            metadata=metadata,
        )

    @staticmethod
    def _estimate_engagement(position: int, feed_name: str, time_window: str | None) -> float:
        """Estimate feed engagement with a modest boost for harder-to-reach top feeds."""

        feed_boost = 0
        if feed_name == "top" and time_window == "week":
            feed_boost = 90
        elif feed_name == "top" and time_window == "day":
            feed_boost = 60
        elif feed_name == "new":
            feed_boost = 20
        return max(BASE_ENGAGEMENT + feed_boost - position * 10, 50)

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
