"""Lobsters adapter for additional developer-community trend corroboration."""

from __future__ import annotations

from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter


class LobstersSourceAdapter(SourceAdapter):
    """Fetch Lobsters newest stories from the public JSON feed."""

    source_name = "lobsters"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_feed()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_feed(self) -> list[RawSourceItem]:
        limit = min(self.settings.max_items_per_source, 30)
        payload = self.get_json("https://lobste.rs/newest.json", headers={"Accept": "application/json"})
        self.raw_item_count = len(payload)
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        for entry in payload[:limit]:
            normalized = self._normalize_entry(entry)
            if normalized is None or normalized.external_id in seen_ids:
                continue
            seen_ids.add(normalized.external_id)
            items.append(normalized)
            self.kept_item_count += 1
            if len(items) >= self.settings.max_items_per_source:
                break
        return items

    def _normalize_entry(self, entry: dict[str, object]) -> RawSourceItem | None:
        short_id = str(entry.get("short_id", "")).strip()
        title = str(entry.get("title", "")).strip()
        if not short_id or not title:
            return None
        tags = entry.get("tags") if isinstance(entry.get("tags"), list) else []
        timestamp = str(entry.get("created_at", "")).strip()
        engagement = float(entry.get("score", 0)) * 6.0 + float(entry.get("comment_count", 0)) * 3.0
        return RawSourceItem(
            source=self.source_name,
            external_id=short_id,
            title=title,
            url=str(entry.get("url") or entry.get("comments_url") or f"https://lobste.rs/s/{short_id}"),
            timestamp=self.parse_iso_timestamp(timestamp) if timestamp else datetime.now(tz=timezone.utc),
            engagement_score=engagement,
            metadata={"tags": tags[:6], "submitter": str(entry.get("submitter_user", ""))},
        )

    def _fallback_items(self) -> list[RawSourceItem]:
        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="lobsters-1",
                title="Model context protocol toolchains are becoming the new plugin layer",
                url="https://lobste.rs/s/example1",
                timestamp=now,
                engagement_score=110.0,
                metadata={"tags": ["ai", "mcp", "tooling"]},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="lobsters-2",
                title="Text embedding pipelines are quietly replacing brittle search heuristics",
                url="https://lobste.rs/s/example2",
                timestamp=now,
                engagement_score=95.0,
                metadata={"tags": ["search", "embeddings", "ml"]},
            ),
        ]
