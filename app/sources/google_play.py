"""Google Play Store source adapter."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

from app.models import RawSourceItem
from app.sources.base import SourceAdapter


class GooglePlaySourceAdapter(SourceAdapter):
    """Fetch Google Play Store charts and normalize them."""

    source_name = "google_play"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_live()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample()

    def _fetch_live(self) -> list[RawSourceItem]:
        """Fetch live chart data using google-play-scraper."""

        try:
            import google_play_scraper as gplay
        except ImportError:
            raise RuntimeError("google-play-scraper package not installed")

        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)
        limit = min(30, self.settings.max_items_per_source)

        chart_specs: list[tuple[str, Any, Any | None]] = [
            ("play_top_free", gplay.Collection.TOP_FREE, None),
            ("play_top_paid", gplay.Collection.TOP_PAID, None),
            ("play_top_grossing", gplay.Collection.TOP_GROSSING, None),
            ("play_games", gplay.Collection.TOP_FREE, gplay.Category.GAME),
        ]

        for chart_type, collection, category in chart_specs:
            try:
                kwargs: dict[str, Any] = {
                    "collection": collection,
                    "count": limit,
                    "country": "us",
                    "lang": "en",
                }
                if category is not None:
                    kwargs["category"] = category
                results = gplay.collection(**kwargs)

                for position, result in enumerate(results[:limit], start=1):
                    name = str(result.get("title", "")).strip()
                    if not name:
                        continue
                    developer = str(result.get("developer", "")).strip()
                    display_title = f"{name} — {developer}" if developer else name
                    app_id = str(result.get("appId", f"{chart_type}-{position}"))
                    rating = float(result.get("score", 0) or 0)
                    engagement = (limit - position) * 10 + rating * 50

                    metadata: dict[str, str] = {
                        "chart_type": chart_type,
                        "position": str(position),
                        "developer": developer,
                        "app_id": app_id,
                    }
                    if result.get("score"):
                        metadata["rating"] = str(round(result["score"], 1))
                    installs_str = str(result.get("installs", ""))
                    if installs_str:
                        metadata["installs"] = installs_str
                    icon = str(result.get("icon", ""))
                    if icon:
                        metadata["icon_url"] = icon
                    if result.get("containsAds"):
                        metadata["contains_ads"] = "true"
                    if result.get("offersIAP"):
                        metadata["has_iap"] = "true"
                    genre = str(result.get("genre", "")).strip()
                    if genre:
                        metadata["genre"] = genre
                    price_val = result.get("price")
                    if price_val is not None:
                        metadata["price"] = str(price_val)

                    items.append(
                        RawSourceItem(
                            source=self.source_name,
                            external_id=app_id,
                            title=display_title,
                            url=f"https://play.google.com/store/apps/details?id={app_id}",
                            timestamp=now,
                            engagement_score=float(max(engagement, 0)),
                            metadata=metadata,
                        )
                    )
            except Exception:
                continue

        if not items:
            items = self._fetch_serpapi_fallback()

        if not items:
            raise RuntimeError("Google Play: no live data available")

        return items[: self.settings.max_items_per_source]

    def _fetch_serpapi_fallback(self) -> list[RawSourceItem]:
        """Try SerpApi google_play engine as secondary fallback."""

        if not self.settings.serpapi_key:
            return []

        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)

        for store_type in ("apps", "games"):
            try:
                params = urlencode(
                    {
                        "engine": "google_play",
                        "store": store_type,
                        "gl": "us",
                        "hl": "en",
                        "api_key": self.settings.serpapi_key,
                    }
                )
                url = f"https://serpapi.com/search.json?{params}"
                payload = self.get_json(url)

                for position, result in enumerate(
                    payload.get("organic_results", [])[:30], start=1
                ):
                    title = str(result.get("title", "")).strip()
                    if not title:
                        continue
                    developer = str(result.get("developer", "")).strip()
                    display_title = f"{title} — {developer}" if developer else title
                    app_id = str(
                        result.get(
                            "product_id", f"serpapi-{store_type}-{position}"
                        )
                    )
                    rating = float(result.get("rating", 0) or 0)
                    engagement = (30 - position) * 10 + rating * 50

                    metadata: dict[str, str] = {
                        "chart_type": f"play_{store_type}",
                        "position": str(position),
                        "developer": developer,
                        "app_id": app_id,
                    }
                    rating_val = result.get("rating")
                    if rating_val:
                        metadata["rating"] = str(rating_val)
                    icon_url = str(result.get("thumbnail", ""))
                    if icon_url:
                        metadata["icon_url"] = icon_url

                    items.append(
                        RawSourceItem(
                            source=self.source_name,
                            external_id=app_id,
                            title=display_title,
                            url=f"https://play.google.com/store/apps/details?id={app_id}",
                            timestamp=now,
                            engagement_score=float(max(engagement, 0)),
                            metadata=metadata,
                        )
                    )
            except Exception:
                continue

        return items

    def _normalize_sample(self) -> list[RawSourceItem]:
        """Build items from the deterministic sample payload."""

        now = datetime.now(tz=timezone.utc)
        items: list[RawSourceItem] = []

        for chart_type, entries in self.sample_payload().items():
            for position, entry in enumerate(entries, start=1):
                name = entry["name"]
                developer = entry.get("developer", "")
                title = f"{name} — {developer}" if developer else name
                app_id = entry["app_id"]
                rating = float(entry.get("rating", 0))
                engagement = (30 - position) * 10 + rating * 50

                metadata: dict[str, str] = {
                    "chart_type": chart_type,
                    "position": str(position),
                    "developer": developer,
                    "app_id": app_id,
                }
                if entry.get("rating"):
                    metadata["rating"] = str(entry["rating"])
                if entry.get("installs"):
                    metadata["installs"] = entry["installs"]
                if entry.get("icon_url"):
                    metadata["icon_url"] = entry["icon_url"]

                items.append(
                    RawSourceItem(
                        source=self.source_name,
                        external_id=app_id,
                        title=title,
                        url=f"https://play.google.com/store/apps/details?id={app_id}",
                        timestamp=now,
                        engagement_score=float(max(engagement, 0)),
                        metadata=metadata,
                    )
                )

        return items[: self.settings.max_items_per_source]

    @staticmethod
    def sample_payload() -> dict[str, list[dict[str, Any]]]:
        """Return deterministic fallback chart data."""

        return {
            "play_top_free": [
                {
                    "app_id": "com.openai.chatgpt",
                    "name": "ChatGPT",
                    "developer": "OpenAI",
                    "rating": 4.7,
                    "installs": "100M+",
                    "icon_url": "https://play-lh.googleusercontent.com/chatgpt-icon",
                },
                {
                    "app_id": "com.zhiliaoapp.musically",
                    "name": "TikTok",
                    "developer": "TikTok Pte. Ltd.",
                    "rating": 4.4,
                    "installs": "1B+",
                    "icon_url": "https://play-lh.googleusercontent.com/tiktok-icon",
                },
                {
                    "app_id": "com.instagram.android",
                    "name": "Instagram",
                    "developer": "Meta Platforms",
                    "rating": 4.3,
                    "installs": "5B+",
                    "icon_url": "https://play-lh.googleusercontent.com/instagram-icon",
                },
            ],
            "play_games": [
                {
                    "app_id": "com.supercell.clashofclans",
                    "name": "Clash of Clans",
                    "developer": "Supercell",
                    "rating": 4.5,
                    "installs": "500M+",
                    "icon_url": "https://play-lh.googleusercontent.com/coc-icon",
                },
                {
                    "app_id": "com.king.candycrushsaga",
                    "name": "Candy Crush Saga",
                    "developer": "King",
                    "rating": 4.6,
                    "installs": "1B+",
                    "icon_url": "https://play-lh.googleusercontent.com/candy-icon",
                },
                {
                    "app_id": "com.roblox.client",
                    "name": "Roblox",
                    "developer": "Roblox Corporation",
                    "rating": 4.4,
                    "installs": "500M+",
                    "icon_url": "https://play-lh.googleusercontent.com/roblox-icon",
                },
            ],
        }
