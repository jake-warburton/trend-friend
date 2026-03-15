"""Facebook Ad Library source adapter."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)

_AD_LIBRARY_URL = "https://graph.facebook.com/v19.0/ads_archive"
_SEARCH_KEYWORDS = [
    "AI", "machine learning", "SaaS", "cloud", "fintech",
    "cybersecurity", "automation", "blockchain",
]


class FacebookAdLibrarySourceAdapter(SourceAdapter):
    """Fetch active ad data from the Meta Ad Library API."""

    source_name = "facebook_ad_library"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_ads()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample(self.sample_payload())

    def _fetch_ads(self) -> list[RawSourceItem]:
        if not self.settings.meta_app_token:
            raise RuntimeError("META_APP_TOKEN not configured")

        items: list[RawSourceItem] = []
        per_keyword = max(self.settings.max_items_per_source // len(_SEARCH_KEYWORDS), 3)

        for keyword in _SEARCH_KEYWORDS:
            try:
                data = self.get_json(
                    f"{_AD_LIBRARY_URL}?search_terms={keyword}&ad_type=ALL"
                    f"&ad_reached_countries=['US']&fields=id,ad_creative_bodies,"
                    f"page_name,ad_delivery_start_time,impressions"
                    f"&limit={per_keyword}&access_token={self.settings.meta_app_token}",
                )
                for ad in data.get("data", [])[:per_keyword]:
                    ad_id = ad.get("id", "")
                    page_name = ad.get("page_name", "Unknown")
                    bodies = ad.get("ad_creative_bodies", [])
                    ad_copy = bodies[0] if bodies else ""
                    start_time = ad.get("ad_delivery_start_time", "")

                    timestamp = datetime.now(tz=timezone.utc)
                    if start_time:
                        try:
                            timestamp = self.parse_iso_timestamp(start_time)
                        except (ValueError, TypeError):
                            pass

                    items.append(
                        RawSourceItem(
                            source=self.source_name,
                            external_id=f"fb-{ad_id}",
                            title=f"Ad by {page_name}: {ad_copy[:100]}" if ad_copy else f"Ad by {page_name}",
                            url=f"https://www.facebook.com/ads/library/?id={ad_id}",
                            timestamp=timestamp,
                            engagement_score=10.0,
                            metadata={
                                "ad_copy": ad_copy[:500],
                                "advertiser": page_name,
                                "targeting_info": {},
                                "ad_format": "feed",
                                "spend_estimate": None,
                                "platform": "facebook",
                            },
                        )
                    )
            except Exception as exc:
                LOGGER.warning("Facebook Ad Library fetch failed for '%s': %s", keyword, exc)

        self.raw_item_count = len(items)
        self.kept_item_count = min(len(items), self.settings.max_items_per_source)
        return items[:self.settings.max_items_per_source]

    def _normalize_sample(self, payload: list[dict]) -> list[RawSourceItem]:
        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)
        for entry in payload[:self.settings.max_items_per_source]:
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=str(entry["id"]),
                    title=str(entry["title"]),
                    url=str(entry.get("url", "")),
                    timestamp=now,
                    engagement_score=float(entry.get("engagement_score", 10.0)),
                    metadata={
                        "ad_copy": str(entry.get("ad_copy", "")),
                        "advertiser": str(entry.get("advertiser", "")),
                        "targeting_info": {},
                        "ad_format": "feed",
                        "spend_estimate": None,
                        "platform": "facebook",
                    },
                )
            )
        return items

    @staticmethod
    def sample_payload() -> list[dict]:
        return [
            {"id": "fb-1", "title": "Ad by TechCorp: Transform your business with AI-powered automation", "url": "https://www.facebook.com/ads/library/?id=1001", "ad_copy": "Transform your business with AI-powered automation", "advertiser": "TechCorp", "engagement_score": 15.0},
            {"id": "fb-2", "title": "Ad by CloudSecure: Enterprise security made simple", "url": "https://www.facebook.com/ads/library/?id=1002", "ad_copy": "Enterprise security made simple", "advertiser": "CloudSecure", "engagement_score": 12.0},
            {"id": "fb-3", "title": "Ad by DataFlow: Real-time analytics platform", "url": "https://www.facebook.com/ads/library/?id=1003", "ad_copy": "Real-time analytics for modern teams", "advertiser": "DataFlow", "engagement_score": 10.0},
        ]
