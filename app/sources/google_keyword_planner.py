"""Google Keyword Planner source adapter (SerpApi-backed).

Uses SerpApi's Google Search engine to discover which advertisers are
bidding on trend-relevant keywords, and Google Trends for relative
interest data.  This replaces the direct Google Ads API integration
which requires a Manager account + developer token approval.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from urllib.parse import quote_plus

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)

_SERPAPI_URL = "https://serpapi.com/search.json"

_KEYWORDS_PER_RUN = 8


class GoogleKeywordPlannerSourceAdapter(SourceAdapter):
    """Fetch keyword intelligence via SerpApi Google Search + Trends."""

    source_name = "google_keyword_planner"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_keywords()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample(self.sample_payload())

    def _check_serpapi_budget(self, min_remaining: int = 20) -> None:
        """Raise if SerpApi search budget is too low to proceed."""
        try:
            import urllib.request, json as _json
            url = f"https://serpapi.com/account.json?api_key={self.settings.serpapi_key}"
            with urllib.request.urlopen(url, timeout=10) as resp:
                account = _json.loads(resp.read())
            remaining = account.get("total_searches_left", 0)
            if remaining < min_remaining:
                raise RuntimeError(
                    f"SerpApi budget too low: {remaining} searches remaining "
                    f"(minimum {min_remaining} required)"
                )
            LOGGER.info("SerpApi budget check: %d searches remaining", remaining)
        except RuntimeError:
            raise
        except Exception as exc:
            LOGGER.warning("SerpApi budget check failed, proceeding anyway: %s", exc)

    @staticmethod
    def _pick_keywords_for_run(
        trend_topics: list[str],
        already_scraped: set[str] | None = None,
    ) -> list[str]:
        """Pick the top trending keywords we haven't scraped this month.

        Takes the first ``_KEYWORDS_PER_RUN`` topics from *trend_topics*
        that are not in *already_scraped*, so each run covers new ground
        and the merged payload accumulates over time.
        """
        if not trend_topics:
            return []
        seen = already_scraped or set()
        batch = []
        for topic in trend_topics:
            if topic.lower() not in seen:
                batch.append(topic)
                if len(batch) >= _KEYWORDS_PER_RUN:
                    break
        # If all top topics are already scraped, re-scrape the top ones
        # to refresh their data.
        if not batch:
            batch = trend_topics[:_KEYWORDS_PER_RUN]
        return batch

    def _fetch_keywords(self) -> list[RawSourceItem]:
        if not self.settings.serpapi_key:
            raise RuntimeError("SERPAPI_KEY not configured")

        trend_topics: list[str] = getattr(self.settings, "_ad_intel_trend_topics", [])
        already_scraped: set[str] = getattr(self.settings, "_ad_intel_already_scraped", set())
        keywords = self._pick_keywords_for_run(trend_topics, already_scraped)
        if not keywords:
            raise RuntimeError("No trend topics available for ad intelligence")
        LOGGER.info(
            "Ad intelligence keyword batch: %s (%d already scraped, %d trends total)",
            keywords, len(already_scraped), len(trend_topics),
        )

        # 1 call per keyword: YouTube only (returns real ad data on free tier)
        self._check_serpapi_budget(min_remaining=len(keywords) + 10)

        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)

        for keyword in keywords:
            try:
                yt_data = self.get_json(
                    f"{_SERPAPI_URL}?engine=youtube&search_query={quote_plus(keyword)}"
                    f"&api_key={self.settings.serpapi_key}",
                )
            except Exception as exc:
                LOGGER.warning("SerpApi YouTube Search failed for '%s': %s", keyword, exc)
                continue

            yt_ads = yt_data.get("ads_results", [])
            ad_count = len(yt_ads)

            advertisers: list[str] = []
            for ad in yt_ads[:10]:
                channel = ad.get("channel", {})
                name = channel.get("name", "") if isinstance(channel, dict) else ""
                if name and name not in advertisers:
                    advertisers.append(name)

            # Competition heuristic based on YouTube ad count
            if ad_count >= 5:
                competition = "HIGH"
            elif ad_count >= 2:
                competition = "MEDIUM"
            elif ad_count >= 1:
                competition = "LOW"
            else:
                competition = "NONE"

            engagement = ad_count

            ad_copies = []
            for ad in yt_ads[:5]:
                channel = ad.get("channel", {})
                ad_copies.append({
                    "title": ad.get("title", ""),
                    "advertiser": channel.get("name", "") if isinstance(channel, dict) else "",
                    "description": ad.get("description", ""),
                    "position": ad.get("position_on_page", 0),
                    "platform": "youtube",
                })

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"gkp-yt-{hash(keyword) & 0xFFFFFFFF:08x}",
                    title=f"Keyword: {keyword} ({ad_count} YouTube ads, competition: {competition})",
                    url=f"https://www.youtube.com/results?search_query={quote_plus(keyword)}",
                    timestamp=now,
                    engagement_score=round(engagement, 2),
                    metadata={
                        "search_keyword": keyword,
                        "ad_count": ad_count,
                        "youtube_ad_count": ad_count,
                        "has_ads": ad_count > 0,
                        "competition_level": competition,
                        "top_advertisers": advertisers,
                        "ad_copies": ad_copies,
                    },
                )
            )

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
                    engagement_score=float(entry.get("engagement_score", 10.0)),
                    metadata={
                        "search_keyword": str(entry.get("search_keyword", "")),
                        "ad_count": int(entry.get("ad_count", 0)),
                        "has_ads": bool(entry.get("has_ads", False)),
                        "competition_level": str(entry.get("competition_level", "MEDIUM")),
                        "top_advertisers": entry.get("top_advertisers", []),
                        "related_keywords": entry.get("related_keywords", []),
                        "organic_result_count": int(entry.get("organic_result_count", 0)),
                        "ad_copies": entry.get("ad_copies", []),
                    },
                )
            )
        return items

    @staticmethod
    def sample_payload() -> list[dict]:
        return [
            {
                "id": "gkp-serp-1",
                "title": "Keyword: AI (6 ads, competition: HIGH)",
                "url": "https://www.google.com/search?q=AI",
                "search_keyword": "AI",
                "ad_count": 6,
                "has_ads": True,
                "competition_level": "HIGH",
                "top_advertisers": ["Google Cloud", "IBM Watson", "Microsoft Azure"],
                "related_keywords": ["AI tools", "AI chatbot", "AI image generator"],
                "organic_result_count": 10,
                "engagement_score": 110.0,
            },
            {
                "id": "gkp-serp-2",
                "title": "Keyword: cybersecurity (4 ads, competition: HIGH)",
                "url": "https://www.google.com/search?q=cybersecurity",
                "search_keyword": "cybersecurity",
                "ad_count": 4,
                "has_ads": True,
                "competition_level": "HIGH",
                "top_advertisers": ["CrowdStrike", "Palo Alto Networks", "Fortinet"],
                "related_keywords": ["cybersecurity jobs", "cybersecurity certification"],
                "organic_result_count": 10,
                "engagement_score": 80.0,
            },
            {
                "id": "gkp-serp-3",
                "title": "Keyword: SaaS (2 ads, competition: MEDIUM)",
                "url": "https://www.google.com/search?q=SaaS",
                "search_keyword": "SaaS",
                "ad_count": 2,
                "has_ads": True,
                "competition_level": "MEDIUM",
                "top_advertisers": ["HubSpot", "Salesforce"],
                "related_keywords": ["SaaS meaning", "SaaS companies"],
                "organic_result_count": 10,
                "engagement_score": 50.0,
            },
            {
                "id": "gkp-serp-4",
                "title": "Keyword: machine learning (3 ads, competition: MEDIUM)",
                "url": "https://www.google.com/search?q=machine+learning",
                "search_keyword": "machine learning",
                "ad_count": 3,
                "has_ads": True,
                "competition_level": "MEDIUM",
                "top_advertisers": ["Coursera", "Google Cloud"],
                "related_keywords": ["machine learning course", "ML models"],
                "organic_result_count": 10,
                "engagement_score": 65.0,
            },
        ]
