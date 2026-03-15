"""Google Keyword Planner source adapter."""

from __future__ import annotations

import logging
from math import log10
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)


class GoogleKeywordPlannerSourceAdapter(SourceAdapter):
    """Fetch keyword intelligence from Google Keyword Planner API."""

    source_name = "google_keyword_planner"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_keywords()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample(self.sample_payload())

    def _fetch_keywords(self) -> list[RawSourceItem]:
        """Fetch keyword data from Google Ads Keyword Planner API."""

        if not all([
            self.settings.google_ads_client_id,
            self.settings.google_ads_developer_token,
            self.settings.google_ads_refresh_token,
            self.settings.google_ads_customer_id,
        ]):
            raise RuntimeError("Google Ads credentials not configured")

        try:
            from google.ads.googleads.client import GoogleAdsClient
        except ImportError:
            raise RuntimeError("google-ads package not installed")

        credentials = {
            "developer_token": self.settings.google_ads_developer_token,
            "client_id": self.settings.google_ads_client_id,
            "client_secret": self.settings.google_ads_client_secret or "",
            "refresh_token": self.settings.google_ads_refresh_token,
            "login_customer_id": self.settings.google_ads_customer_id,
        }
        client = GoogleAdsClient.load_from_dict(credentials)
        keyword_plan_idea_service = client.get_service("KeywordPlanIdeaService")

        request = client.get_type("GenerateKeywordIdeasRequest")
        request.customer_id = self.settings.google_ads_customer_id
        request.language = client.get_service("GoogleAdsService").language_constant_path("1000")
        request.geo_target_constants = [
            client.get_service("GoogleAdsService").geo_target_constant_path("2840")
        ]
        request.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
        request.keyword_seed.keywords.extend([
            "AI", "machine learning", "blockchain", "cloud computing",
            "cybersecurity", "fintech", "SaaS", "automation",
        ])

        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)
        response = keyword_plan_idea_service.generate_keyword_ideas(request=request)

        for idea in response:
            keyword = idea.text
            metrics = idea.keyword_idea_metrics
            cpc_micros = metrics.average_cpc_in_micros or 0
            cpc = cpc_micros / 1_000_000
            search_volume = metrics.avg_monthly_searches or 0
            competition = metrics.competition.name if metrics.competition else "UNSPECIFIED"
            engagement = cpc * log10(search_volume + 1) if search_volume > 0 else 0.0

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"gkp-{hash(keyword) & 0xFFFFFFFF:08x}",
                    title=f"Keyword: {keyword} (CPC: ${cpc:.2f}, Vol: {search_volume:,})",
                    url=f"https://ads.google.com/aw/keywordplanner/ideas?keyword={keyword.replace(' ', '+')}",
                    timestamp=now,
                    engagement_score=engagement,
                    metadata={
                        "cpc": round(cpc, 2),
                        "search_volume": search_volume,
                        "competition_level": competition,
                        "keyword_suggestions": [],
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
            cpc = float(entry.get("cpc", 0))
            volume = int(entry.get("search_volume", 0))
            engagement = cpc * log10(volume + 1) if volume > 0 else 0.0
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=str(entry["id"]),
                    title=str(entry["title"]),
                    url=str(entry.get("url", "")),
                    timestamp=now,
                    engagement_score=engagement,
                    metadata={
                        "cpc": cpc,
                        "search_volume": volume,
                        "competition_level": str(entry.get("competition_level", "MEDIUM")),
                        "keyword_suggestions": [],
                    },
                )
            )
        return items

    @staticmethod
    def sample_payload() -> list[dict]:
        return [
            {"id": "gkp-1", "title": "Keyword: AI automation (CPC: $4.50, Vol: 110,000)", "url": "https://ads.google.com/aw/keywordplanner/ideas?keyword=AI+automation", "cpc": 4.50, "search_volume": 110000, "competition_level": "HIGH"},
            {"id": "gkp-2", "title": "Keyword: cloud security (CPC: $12.30, Vol: 74,000)", "url": "https://ads.google.com/aw/keywordplanner/ideas?keyword=cloud+security", "cpc": 12.30, "search_volume": 74000, "competition_level": "HIGH"},
            {"id": "gkp-3", "title": "Keyword: low-code platform (CPC: $8.75, Vol: 33,000)", "url": "https://ads.google.com/aw/keywordplanner/ideas?keyword=low-code+platform", "cpc": 8.75, "search_volume": 33000, "competition_level": "MEDIUM"},
        ]
