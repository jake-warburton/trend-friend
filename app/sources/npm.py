"""npm registry adapter for early developer-package momentum."""

from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import quote_plus

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

QUERY_FAMILIES = ("ai", "agents", "llm", "mcp", "workflow")


class NpmSourceAdapter(SourceAdapter):
    """Fetch npm package search results from several trend-rich query families."""

    source_name = "npm"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_search()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_search(self) -> list[RawSourceItem]:
        per_query_limit = max(5, min(self.settings.max_items_per_source // len(QUERY_FAMILIES), 12))
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        for query in QUERY_FAMILIES:
            url = (
                "https://registry.npmjs.org/-/v1/search"
                f"?text={quote_plus(query)}"
                f"&size={per_query_limit}"
                "&popularity=1.0&maintenance=0.4&quality=0.6"
            )
            payload = self.get_json(url, headers={"Accept": "application/json"})
            objects = payload.get("objects", [])
            self.raw_item_count += len(objects)
            for entry in objects:
                normalized = self._normalize_entry(entry, query)
                if normalized is None or normalized.external_id in seen_ids:
                    continue
                seen_ids.add(normalized.external_id)
                items.append(normalized)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    return items
        return items

    def _normalize_entry(self, entry: dict[str, object], query_family: str) -> RawSourceItem | None:
        package = entry.get("package") if isinstance(entry.get("package"), dict) else {}
        score = entry.get("score") if isinstance(entry.get("score"), dict) else {}
        package_name = str(package.get("name", "")).strip()
        if not package_name:
            return None
        description = str(package.get("description", "")).strip()
        keywords = package.get("keywords") if isinstance(package.get("keywords"), list) else []
        title = f"{package_name} {description}".strip()
        detail_score = score.get("detail") if isinstance(score.get("detail"), dict) else {}
        engagement = (
            float(detail_score.get("popularity", 0)) * 300.0
            + float(detail_score.get("quality", 0)) * 120.0
            + float(detail_score.get("maintenance", 0)) * 80.0
        )
        date_value = str(package.get("date", "")).strip()
        return RawSourceItem(
            source=self.source_name,
            external_id=package_name,
            title=title,
            url=str(package.get("links", {}).get("npm", f"https://www.npmjs.com/package/{package_name}"))
            if isinstance(package.get("links"), dict)
            else f"https://www.npmjs.com/package/{package_name}",
            timestamp=self.parse_iso_timestamp(date_value) if date_value else datetime.now(tz=timezone.utc),
            engagement_score=engagement,
            metadata={
                "keywords": keywords[:8],
                "query_family": query_family,
                "package_name": package_name,
            },
        )

    def _fallback_items(self) -> list[RawSourceItem]:
        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="agentic-workflow",
                title="agentic-workflow SDK for AI agents and workflow automation",
                url="https://www.npmjs.com/package/agentic-workflow",
                timestamp=now,
                engagement_score=260.0,
                metadata={"keywords": ["agents", "workflow", "automation"], "package_name": "agentic-workflow"},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="mcp-client",
                title="mcp-client TypeScript client for model context protocol servers",
                url="https://www.npmjs.com/package/mcp-client",
                timestamp=now,
                engagement_score=230.0,
                metadata={"keywords": ["mcp", "ai", "typescript"], "package_name": "mcp-client"},
            ),
        ]
