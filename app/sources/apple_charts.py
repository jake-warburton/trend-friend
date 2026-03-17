"""Apple Charts source adapter (music, podcasts, apps)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

_CHART_ENDPOINTS = {
    "music": "https://rss.applemarketingtools.com/api/v2/us/music/most-played/50/songs.json",
    "podcasts": "https://rss.applemarketingtools.com/api/v2/us/podcasts/top/50/podcasts.json",
    "apps": "https://rss.applemarketingtools.com/api/v2/us/apps/top-free/50/apps.json",
    "apps_paid": "https://rss.applemarketingtools.com/api/v2/us/apps/top-paid/50/apps.json",
    "apps_grossing": "https://rss.applemarketingtools.com/api/v2/us/apps/top-grossing/50/apps.json",
}


class AppleChartsSourceAdapter(SourceAdapter):
    """Fetch Apple Music, Podcast, and App Store charts and normalize them."""

    source_name = "apple_charts"

    def fetch(self) -> list[RawSourceItem]:
        try:
            items: list[RawSourceItem] = []
            for chart_type, url in _CHART_ENDPOINTS.items():
                payload = self.get_json(url)
                items.extend(self._normalize_chart(payload, chart_type))
            return items[: self.settings.max_items_per_source]
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample()

    def _normalize_chart(
        self, payload: dict[str, Any], chart_type: str
    ) -> list[RawSourceItem]:
        """Normalize a single Apple RSS chart feed into shared models."""

        feed = payload.get("feed", {})
        results = feed.get("results", [])
        now = datetime.now(tz=timezone.utc)
        items: list[RawSourceItem] = []

        for position, entry in enumerate(results, start=1):
            name = str(entry.get("name", "")).strip()
            if not name:
                continue

            artist_or_dev = str(
                entry.get("artistName", entry.get("developerName", ""))
            ).strip()
            title = f"{name} — {artist_or_dev}" if artist_or_dev else name
            entry_url = str(entry.get("url", ""))
            entry_id = entry.get("id", entry_url or f"{chart_type}-{position}")

            release_date = entry.get("releaseDate")
            if release_date:
                try:
                    timestamp = datetime.strptime(release_date, "%Y-%m-%d").replace(
                        tzinfo=timezone.utc
                    )
                except (ValueError, TypeError):
                    timestamp = now
            else:
                timestamp = now

            engagement = (50 - position) * 10 + 50

            metadata: dict[str, str] = {
                "chart_type": chart_type,
                "position": str(position),
            }
            metadata["app_id"] = str(entry_id)
            artwork_url = str(entry.get("artworkUrl100", ""))
            if artwork_url:
                metadata["artwork_url"] = artwork_url
            if chart_type in ("music", "podcasts") and artist_or_dev:
                metadata["artist"] = artist_or_dev
            elif chart_type.startswith("apps") and artist_or_dev:
                metadata["developer"] = artist_or_dev

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=str(entry_id),
                    title=title,
                    url=entry_url,
                    timestamp=timestamp,
                    engagement_score=float(max(engagement, 0)),
                    metadata=metadata,
                )
            )

        return items

    def _normalize_sample(self) -> list[RawSourceItem]:
        """Build items from the deterministic sample payload."""

        items: list[RawSourceItem] = []
        for chart_type, payload in self.sample_payload().items():
            items.extend(self._normalize_chart(payload, chart_type))
        return items

    @staticmethod
    def sample_payload() -> dict[str, dict[str, Any]]:
        """Return deterministic fallback chart data."""

        return {
            "music": {
                "feed": {
                    "title": "Top Songs",
                    "results": [
                        {
                            "id": "music-1",
                            "artistName": "Kendrick Lamar",
                            "name": "Not Like Us",
                            "url": "https://music.apple.com/us/album/not-like-us/1",
                            "releaseDate": "2024-05-04",
                        },
                        {
                            "id": "music-2",
                            "artistName": "Sabrina Carpenter",
                            "name": "Espresso",
                            "url": "https://music.apple.com/us/album/espresso/2",
                            "releaseDate": "2024-04-12",
                        },
                        {
                            "id": "music-3",
                            "artistName": "Billie Eilish",
                            "name": "Birds of a Feather",
                            "url": "https://music.apple.com/us/album/birds-of-a-feather/3",
                            "releaseDate": "2024-05-17",
                        },
                    ],
                }
            },
            "podcasts": {
                "feed": {
                    "title": "Top Podcasts",
                    "results": [
                        {
                            "id": "pod-1",
                            "artistName": "The New York Times",
                            "name": "The Daily",
                            "url": "https://podcasts.apple.com/us/podcast/the-daily/1",
                        },
                        {
                            "id": "pod-2",
                            "artistName": "Joe Rogan",
                            "name": "The Joe Rogan Experience",
                            "url": "https://podcasts.apple.com/us/podcast/the-joe-rogan-experience/2",
                        },
                        {
                            "id": "pod-3",
                            "artistName": "Lex Fridman",
                            "name": "Lex Fridman Podcast",
                            "url": "https://podcasts.apple.com/us/podcast/lex-fridman-podcast/3",
                        },
                    ],
                }
            },
            "apps": {
                "feed": {
                    "title": "Top Free Apps",
                    "results": [
                        {
                            "id": "app-1",
                            "developerName": "OpenAI",
                            "name": "ChatGPT",
                            "url": "https://apps.apple.com/us/app/chatgpt/1",
                        },
                        {
                            "id": "app-2",
                            "developerName": "ByteDance",
                            "name": "CapCut",
                            "url": "https://apps.apple.com/us/app/capcut/2",
                        },
                        {
                            "id": "app-3",
                            "developerName": "Meta Platforms",
                            "name": "Threads",
                            "url": "https://apps.apple.com/us/app/threads/3",
                        },
                    ],
                }
            },
            "apps_paid": {
                "feed": {
                    "title": "Top Paid Apps",
                    "results": [
                        {
                            "id": "app-paid-1",
                            "developerName": "Lightricks",
                            "name": "Facetune",
                            "url": "https://apps.apple.com/us/app/facetune/1",
                        },
                        {
                            "id": "app-paid-2",
                            "developerName": "Savage Interactive",
                            "name": "Procreate",
                            "url": "https://apps.apple.com/us/app/procreate/2",
                        },
                        {
                            "id": "app-paid-3",
                            "developerName": "LumaTouch",
                            "name": "LumaFusion",
                            "url": "https://apps.apple.com/us/app/lumafusion/3",
                        },
                    ],
                }
            },
            "apps_grossing": {
                "feed": {
                    "title": "Top Grossing Apps",
                    "results": [
                        {
                            "id": "app-gross-1",
                            "developerName": "King",
                            "name": "Candy Crush Saga",
                            "url": "https://apps.apple.com/us/app/candy-crush-saga/1",
                        },
                        {
                            "id": "app-gross-2",
                            "developerName": "Roblox Corporation",
                            "name": "Roblox",
                            "url": "https://apps.apple.com/us/app/roblox/2",
                        },
                        {
                            "id": "app-gross-3",
                            "developerName": "Disney",
                            "name": "Disney+",
                            "url": "https://apps.apple.com/us/app/disney-plus/3",
                        },
                    ],
                }
            },
        }
