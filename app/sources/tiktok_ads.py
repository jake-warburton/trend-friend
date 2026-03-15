"""TikTok Commercial Content API source adapter."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)

_TIKTOK_ADS_URL = "https://business-api.tiktok.com/open_api/v1.3/creative/ads_library/list/"


class TikTokAdsSourceAdapter(SourceAdapter):
    """Fetch ad data from TikTok Commercial Content API."""

    source_name = "tiktok_ads"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_ads()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample(self.sample_payload())

    def _fetch_ads(self) -> list[RawSourceItem]:
        if not self.settings.tiktok_ads_client_key:
            raise RuntimeError("TIKTOK_ADS_CLIENT_KEY not configured")

        headers = {
            "Access-Token": self.settings.tiktok_ads_client_key,
            "Content-Type": "application/json",
        }

        data = self.get_json(
            f"{_TIKTOK_ADS_URL}?region_code=US&count=50",
            headers=headers,
        )

        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)

        for ad in data.get("data", {}).get("ads", []):
            ad_id = ad.get("ad_id", "")
            advertiser = ad.get("business_name", "Unknown")
            impressions = ad.get("impressions", 0)
            ad_format = ad.get("ad_format", "video")
            engagement = (impressions ** 0.3) * 2 + 5

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"ttad-{ad_id}",
                    title=f"TikTok Ad by {advertiser}",
                    url=f"https://library.tiktok.com/ads/detail/{ad_id}",
                    timestamp=now,
                    engagement_score=round(engagement, 2),
                    metadata={
                        "impressions": impressions,
                        "ad_count": 1,
                        "advertiser": advertiser,
                        "targeting_info": {},
                        "ad_format": ad_format,
                    },
                )
            )
            if len(items) >= self.settings.max_items_per_source:
                break

        self.raw_item_count = len(items)
        self.kept_item_count = len(items)
        return items

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
                    engagement_score=float(entry.get("engagement_score", 7.0)),
                    metadata={
                        "impressions": int(entry.get("impressions", 0)),
                        "ad_count": 1,
                        "advertiser": str(entry.get("advertiser", "")),
                        "targeting_info": {},
                        "ad_format": "video",
                    },
                )
            )
        return items

    @staticmethod
    def sample_payload() -> list[dict]:
        return [
            {"id": "ttad-1", "title": "TikTok Ad by AI Studio Pro", "url": "https://library.tiktok.com/ads/detail/1001", "advertiser": "AI Studio Pro", "impressions": 500000, "engagement_score": 12.0},
            {"id": "ttad-2", "title": "TikTok Ad by FinApp", "url": "https://library.tiktok.com/ads/detail/1002", "advertiser": "FinApp", "impressions": 250000, "engagement_score": 9.0},
            {"id": "ttad-3", "title": "TikTok Ad by LearnCode", "url": "https://library.tiktok.com/ads/detail/1003", "advertiser": "LearnCode", "impressions": 120000, "engagement_score": 7.5},
        ]
