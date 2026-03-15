"""TikTok source adapter using public Creative Center and search APIs.

Fetches trending hashtags from TikTok's Creative Center Trending API
and falling back to the TikTok Discover/Trending endpoint.  These
surfaces capture short-form video momentum — viral challenges, creator
trends, and cultural moments — that complement the developer and
knowledge signals from other sources.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

CREATIVE_CENTER_URL = (
    "https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list"
    "?page=1&limit=50&period=7&country_code=US&sort_by=popular"
)

DISCOVER_TRENDING_URL = "https://www.tiktok.com/api/discover/trending"

HEADERS = {"User-Agent": "Mozilla/5.0"}


class TikTokSourceAdapter(SourceAdapter):
    """Fetch trending hashtags and topics from TikTok public APIs."""

    source_name = "tiktok"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_trends()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_trends(self) -> list[RawSourceItem]:
        """Try Creative Center API first, fall back to Discover endpoint."""

        items = self._fetch_creative_center()
        if items:
            return items
        return self._fetch_discover()

    def _fetch_creative_center(self) -> list[RawSourceItem]:
        """Fetch trending hashtags from the TikTok Creative Center API."""

        data = self.get_json(CREATIVE_CENTER_URL, headers=HEADERS)

        hashtag_list = (data.get("data") or {}).get("list") or []
        self.raw_item_count += len(hashtag_list)

        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()

        for entry in hashtag_list:
            item = self._build_creative_center_item(entry)
            if item is None or item.external_id in seen_ids:
                continue
            seen_ids.add(item.external_id)
            items.append(item)
            self.kept_item_count += 1
            if len(items) >= self.settings.max_items_per_source:
                break

        return items

    def _fetch_discover(self) -> list[RawSourceItem]:
        """Fetch trending topics from the TikTok Discover endpoint."""

        data = self.get_json(DISCOVER_TRENDING_URL, headers=HEADERS)

        topic_list = data if isinstance(data, list) else (data.get("data") or [])
        self.raw_item_count += len(topic_list)

        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()

        for entry in topic_list:
            item = self._build_discover_item(entry)
            if item is None or item.external_id in seen_ids:
                continue
            seen_ids.add(item.external_id)
            items.append(item)
            self.kept_item_count += 1
            if len(items) >= self.settings.max_items_per_source:
                break

        return items

    def _build_creative_center_item(self, entry: dict) -> RawSourceItem | None:
        """Normalize one Creative Center trending hashtag into a source item."""

        hashtag = (entry.get("hashtag_name") or entry.get("name") or "").strip()
        if not hashtag:
            return None

        hashtag_id = str(entry.get("hashtag_id") or entry.get("id") or hashtag)
        view_count = int(entry.get("trend_value") or entry.get("view_count") or 0)
        video_count = int(entry.get("video_count") or 0)
        country = entry.get("country_code") or "US"

        engagement = _calculate_engagement(view_count, video_count)

        return RawSourceItem(
            source=self.source_name,
            external_id=f"tt-cc:{hashtag_id}",
            title=f"#{hashtag}",
            url=f"https://www.tiktok.com/tag/{hashtag}",
            timestamp=datetime.now(tz=timezone.utc),
            engagement_score=engagement,
            metadata={
                "view_count": view_count,
                "video_count": video_count,
                "hashtag": hashtag,
                "country": country,
                "period": 7,
            },
            geo_country_code=country,
            geo_detection_mode="explicit",
            geo_confidence=0.8,
        )

    def _build_discover_item(self, entry: dict) -> RawSourceItem | None:
        """Normalize one Discover trending topic into a source item."""

        title = (entry.get("title") or entry.get("name") or "").strip()
        if not title:
            return None

        topic_id = str(entry.get("id") or title)
        view_count = int(entry.get("view_count") or entry.get("views") or 0)
        video_count = int(entry.get("video_count") or entry.get("videos") or 0)

        engagement = _calculate_engagement(view_count, video_count)

        return RawSourceItem(
            source=self.source_name,
            external_id=f"tt-disc:{topic_id}",
            title=title,
            url=f"https://www.tiktok.com/discover/{topic_id}",
            timestamp=datetime.now(tz=timezone.utc),
            engagement_score=engagement,
            metadata={
                "view_count": view_count,
                "video_count": video_count,
            },
        )

    def _fallback_items(self) -> list[RawSourceItem]:
        """Return deterministic sample data for local fallback runs."""

        now = datetime.now(tz=timezone.utc)
        items: list[RawSourceItem] = []
        for entry in self.sample_payload():
            views = entry.get("views", 0)
            videos = entry.get("videos", 0)
            engagement = _calculate_engagement(views, videos)
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=entry["id"],
                    title=entry["title"],
                    url=f"https://www.tiktok.com/tag/{entry.get('hashtag', '')}",
                    timestamp=now,
                    engagement_score=engagement,
                    metadata={
                        "view_count": views,
                        "video_count": videos,
                        "hashtag": entry.get("hashtag", ""),
                    },
                )
            )
        return items[: self.settings.max_items_per_source]

    @staticmethod
    def sample_payload() -> list[dict]:
        return [
            {
                "id": "tt-1",
                "title": "AI-generated content creation",
                "hashtag": "aicontent",
                "views": 2_500_000_000,
                "videos": 450_000,
            },
            {
                "id": "tt-2",
                "title": "Fitness challenge trends",
                "hashtag": "fitnesschallenge",
                "views": 1_800_000_000,
                "videos": 320_000,
            },
        ]


def _calculate_engagement(view_count: int, video_count: int) -> float:
    """Compute engagement score: views^0.3 * 2 + video_count * 0.5.

    This normalizes TikTok's massive view numbers to be comparable
    with other source adapters.
    """

    views_component = math.pow(max(view_count, 0), 0.3) * 2
    videos_component = max(video_count, 0) * 0.5
    return round(views_component + videos_component, 2)
