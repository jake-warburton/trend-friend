"""Google Ads Transparency Center source adapter via SerpApi."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)

_SERPAPI_URL = "https://serpapi.com/search.json"
_SEARCH_ADVERTISERS = [
    "Google", "Microsoft", "Amazon", "Meta", "Apple",
    "Salesforce", "Adobe", "Oracle", "IBM", "SAP",
]


class GoogleAdsTransparencySourceAdapter(SourceAdapter):
    """Fetch ad transparency data via SerpApi's Google Ads Transparency engine."""

    source_name = "google_ads_transparency"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_transparency()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample(self.sample_payload())

    def _fetch_transparency(self) -> list[RawSourceItem]:
        if not self.settings.serpapi_key:
            raise RuntimeError("SERPAPI_KEY not configured")

        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)
        per_advertiser = max(self.settings.max_items_per_source // len(_SEARCH_ADVERTISERS), 2)

        for advertiser in _SEARCH_ADVERTISERS:
            try:
                data = self.get_json(
                    f"{_SERPAPI_URL}?engine=google_ads_transparency"
                    f"&advertiser_id={advertiser}&region=US"
                    f"&api_key={self.settings.serpapi_key}",
                )
                ads = data.get("ads", [])
                ad_count = len(ads)
                ad_formats = list({ad.get("format", "text") for ad in ads})
                regions = list({ad.get("region", "US") for ad in ads})
                format_diversity = len(ad_formats)
                engagement = ad_count * 5 + format_diversity * 10

                if ad_count > 0:
                    items.append(
                        RawSourceItem(
                            source=self.source_name,
                            external_id=f"gat-{hash(advertiser) & 0xFFFFFFFF:08x}",
                            title=f"Ads by {advertiser}: {ad_count} active ads across {format_diversity} formats",
                            url=f"https://adstransparency.google.com/advertiser/{advertiser}",
                            timestamp=now,
                            engagement_score=round(engagement, 2),
                            metadata={
                                "advertiser": advertiser,
                                "ad_count": ad_count,
                                "ad_formats": ad_formats,
                                "regional_targeting": regions,
                            },
                        )
                    )
            except Exception as exc:
                LOGGER.warning("Google Ads Transparency fetch failed for '%s': %s", advertiser, exc)

            if len(items) >= per_advertiser * len(_SEARCH_ADVERTISERS):
                break

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
                    engagement_score=float(entry.get("engagement_score", 15.0)),
                    metadata={
                        "advertiser": str(entry.get("advertiser", "")),
                        "ad_count": int(entry.get("ad_count", 0)),
                        "ad_formats": entry.get("ad_formats", []),
                        "regional_targeting": entry.get("regional_targeting", ["US"]),
                    },
                )
            )
        return items

    @staticmethod
    def sample_payload() -> list[dict]:
        return [
            {"id": "gat-1", "title": "Ads by Google: 150 active ads across 4 formats", "url": "https://adstransparency.google.com/advertiser/Google", "advertiser": "Google", "ad_count": 150, "ad_formats": ["text", "image", "video", "responsive"], "regional_targeting": ["US", "GB", "DE"], "engagement_score": 790.0},
            {"id": "gat-2", "title": "Ads by Microsoft: 95 active ads across 3 formats", "url": "https://adstransparency.google.com/advertiser/Microsoft", "advertiser": "Microsoft", "ad_count": 95, "ad_formats": ["text", "image", "video"], "regional_targeting": ["US", "GB"], "engagement_score": 505.0},
            {"id": "gat-3", "title": "Ads by Salesforce: 60 active ads across 2 formats", "url": "https://adstransparency.google.com/advertiser/Salesforce", "advertiser": "Salesforce", "ad_count": 60, "ad_formats": ["text", "image"], "regional_targeting": ["US"], "engagement_score": 320.0},
        ]
