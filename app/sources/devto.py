"""DEV Community adapter for free builder and creator trend signals."""

from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import quote_plus

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

QUERY_TAGS = ("ai", "webdev", "startup", "productivity", "machinelearning")


class DevToSourceAdapter(SourceAdapter):
    """Fetch top DEV Community posts across a few trend-rich tag slices."""

    source_name = "devto"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_articles()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_articles(self) -> list[RawSourceItem]:
        per_tag_limit = max(5, min(self.settings.max_items_per_source // len(QUERY_TAGS), 15))
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        for tag in QUERY_TAGS:
            url = (
                "https://dev.to/api/articles"
                f"?per_page={per_tag_limit}"
                "&top=7"
                f"&tag={quote_plus(tag)}"
            )
            payload = self.get_json(url, headers={"Accept": "application/json"})
            self.raw_item_count += len(payload)
            for article in payload:
                normalized = self._normalize_article(article, tag)
                if normalized is None or normalized.external_id in seen_ids:
                    continue
                seen_ids.add(normalized.external_id)
                items.append(normalized)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    return items
        return items

    def _normalize_article(self, article: dict[str, object], query_tag: str) -> RawSourceItem | None:
        article_id = str(article.get("id", "")).strip()
        title = str(article.get("title", "")).strip()
        published_at = str(article.get("published_at") or article.get("published_timestamp") or "").strip()
        if not article_id or not title:
            return None
        tags = article.get("tag_list") or []
        if isinstance(tags, str):
            tags = [tag for tag in tags.split(",") if tag]
        engagement = (
            float(article.get("public_reactions_count", 0))
            + float(article.get("comments_count", 0)) * 4.0
            + float(article.get("positive_reactions_count", 0))
        )
        return RawSourceItem(
            source=self.source_name,
            external_id=article_id,
            title=title,
            url=str(article.get("url", "")),
            timestamp=self.parse_iso_timestamp(published_at) if published_at else datetime.now(tz=timezone.utc),
            engagement_score=engagement,
            metadata={
                "tags": tags[:6],
                "query_tag": query_tag,
                "user": str(article.get("user", {}).get("name", "")) if isinstance(article.get("user"), dict) else "",
            },
        )

    def _fallback_items(self) -> list[RawSourceItem]:
        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="devto-1",
                title="AI agent observability patterns for production teams",
                url="https://dev.to/example/ai-agent-observability",
                timestamp=now,
                engagement_score=420.0,
                metadata={"tags": ["ai", "observability", "agent"]},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="devto-2",
                title="Why model context protocol is showing up in every toolchain",
                url="https://dev.to/example/model-context-protocol",
                timestamp=now,
                engagement_score=360.0,
                metadata={"tags": ["mcp", "ai", "tooling"]},
            ),
        ]
