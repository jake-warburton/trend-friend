"""YouTube discovery adapter for free social-video trend signals."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

QUERY_FAMILIES = (
    # Tech & AI
    ("agents", "ai agents"),
    ("mcp", "model context protocol"),
    ("builders", "open source ai tools"),
    ("robotics", "ai robotics"),
    ("coding", "vibe coding ai"),
    # Consumer & lifestyle
    ("fitness", "fitness trend 2026"),
    ("skincare", "skincare routine trending"),
    ("food", "food trend 2026"),
    ("home", "smart home automation"),
    # Business & finance
    ("startup", "startup idea trending"),
    ("investing", "investing trend 2026"),
    ("sidehustle", "side hustle passive income"),
)


class YouTubeSourceAdapter(SourceAdapter):
    """Fetch recent videos for trend-rich YouTube query families."""

    source_name = "youtube"

    def fetch(self) -> list[RawSourceItem]:
        if not self.settings.youtube_api_key:
            self.log_fallback(RuntimeError("YOUTUBE_API_KEY not set"))
            return self._fallback_items()
        try:
            return self._fetch_recent_videos()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_recent_videos(self) -> list[RawSourceItem]:
        per_query_limit = max(3, min(self.settings.max_items_per_source // len(QUERY_FAMILIES), 6))
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        published_after = (datetime.now(tz=timezone.utc) - timedelta(days=10)).isoformat().replace("+00:00", "Z")
        for query_family, query in QUERY_FAMILIES:
            search_payload = self.get_json(
                "https://www.googleapis.com/youtube/v3/search"
                f"?part=snippet&type=video&order=date&maxResults={per_query_limit}"
                f"&publishedAfter={quote_plus(published_after)}"
                f"&q={quote_plus(query)}"
                f"&key={quote_plus(self.settings.youtube_api_key or '')}"
            )
            search_items = search_payload.get("items", [])
            self.raw_item_count += len(search_items)
            video_ids = [
                str(item.get("id", {}).get("videoId", "")).strip()
                for item in search_items
                if isinstance(item, dict)
            ]
            video_ids = [video_id for video_id in video_ids if video_id]
            if not video_ids:
                continue
            stats_payload = self.get_json(
                "https://www.googleapis.com/youtube/v3/videos"
                f"?part=snippet,statistics&id={quote_plus(','.join(video_ids))}"
                f"&key={quote_plus(self.settings.youtube_api_key or '')}"
            )
            normalized_by_id = {item.external_id: item for item in self._normalize_videos(stats_payload, query_family)}
            for video_id in video_ids:
                normalized = normalized_by_id.get(video_id)
                if normalized is None or normalized.external_id in seen_ids:
                    continue
                seen_ids.add(normalized.external_id)
                items.append(normalized)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    return items
        return items

    def _normalize_videos(self, payload: dict[str, object], query_family: str) -> list[RawSourceItem]:
        normalized_items: list[RawSourceItem] = []
        for item in payload.get("items", []):
            if not isinstance(item, dict):
                continue
            video_id = str(item.get("id", "")).strip()
            snippet = item.get("snippet") if isinstance(item.get("snippet"), dict) else {}
            statistics = item.get("statistics") if isinstance(item.get("statistics"), dict) else {}
            title = str(snippet.get("title", "")).strip()
            if not video_id or not title:
                continue
            published_at = str(snippet.get("publishedAt", "")).strip()
            timestamp = self.parse_iso_timestamp(published_at) if published_at else datetime.now(tz=timezone.utc)
            normalized_items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=video_id,
                    title=title,
                    url=f"https://www.youtube.com/watch?v={video_id}",
                    timestamp=timestamp,
                    engagement_score=self._engagement_score(statistics),
                    metadata={
                        "channel_title": str(snippet.get("channelTitle", "")).strip(),
                        "tags": snippet.get("tags", [])[:8] if isinstance(snippet.get("tags"), list) else [],
                        "query_family": query_family,
                    },
                )
            )
        return normalized_items

    def _engagement_score(self, statistics: dict[str, object]) -> float:
        views = self._stat_as_float(statistics, "viewCount")
        likes = self._stat_as_float(statistics, "likeCount")
        comments = self._stat_as_float(statistics, "commentCount")
        return round((views ** 0.35) * 1.4 + (likes * 0.18) + (comments * 1.6), 2)

    def _stat_as_float(self, statistics: dict[str, object], key: str) -> float:
        try:
            return float(statistics.get(key, 0))
        except (TypeError, ValueError):
            return 0.0

    def _fallback_items(self) -> list[RawSourceItem]:
        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="yt-agentic-demo",
                title="AI agents are escaping demos and showing up in real operator workflows",
                url="https://www.youtube.com/watch?v=yt-agentic-demo",
                timestamp=now,
                engagement_score=245.0,
                metadata={
                    "channel_title": "Builder Signals",
                    "query_family": "agents",
                    "tags": ["ai", "agents", "automation"],
                },
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="yt-mcp-stack",
                title="Model Context Protocol stacks are becoming the new AI integration layer",
                url="https://www.youtube.com/watch?v=yt-mcp-stack",
                timestamp=now,
                engagement_score=212.0,
                metadata={"channel_title": "AI Infra Weekly", "query_family": "mcp", "tags": ["mcp", "llm", "tooling"]},
            ),
        ]
