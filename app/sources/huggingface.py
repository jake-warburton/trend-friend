"""Hugging Face adapter for open model, dataset, and space momentum."""

from __future__ import annotations

from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

API_SPECS = (
    ("models", "https://huggingface.co/api/models?sort=trendingScore&direction=-1"),
    ("datasets", "https://huggingface.co/api/datasets?sort=trendingScore&direction=-1"),
    ("spaces", "https://huggingface.co/api/spaces?sort=trendingScore&direction=-1"),
)


class HuggingFaceSourceAdapter(SourceAdapter):
    """Fetch trending Hugging Face entities via the public API."""

    source_name = "huggingface"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_trending()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_trending(self) -> list[RawSourceItem]:
        per_kind_limit = max(4, min(self.settings.max_items_per_source // len(API_SPECS), 12))
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        headers = {"Accept": "application/json"}
        for kind, base_url in API_SPECS:
            payload = self.get_json(f"{base_url}&limit={per_kind_limit}", headers=headers)
            self.raw_item_count += len(payload)
            for entry in payload:
                normalized = self._normalize_entry(entry, kind)
                if normalized is None or normalized.external_id in seen_ids:
                    continue
                seen_ids.add(normalized.external_id)
                items.append(normalized)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    return items
        return items

    def _normalize_entry(self, entry: dict[str, object], kind: str) -> RawSourceItem | None:
        repo_id = str(entry.get("id") or entry.get("modelId") or "").strip()
        if not repo_id:
            return None
        pipeline_tag = str(entry.get("pipeline_tag") or "").strip()
        card_data = entry.get("cardData") if isinstance(entry.get("cardData"), dict) else {}
        tags = entry.get("tags") if isinstance(entry.get("tags"), list) else []
        likes = float(entry.get("likes", 0))
        downloads = float(entry.get("downloads", 0))
        timestamp = datetime.now(tz=timezone.utc)
        title_bits = [repo_id]
        if pipeline_tag:
            title_bits.append(pipeline_tag.replace("-", " "))
        if card_data and card_data.get("language"):
            title_bits.append(str(card_data.get("language")))
        return RawSourceItem(
            source=self.source_name,
            external_id=f"{kind}:{repo_id}",
            title=" ".join(part for part in title_bits if part),
            url=f"https://huggingface.co/{repo_id}",
            timestamp=timestamp,
            engagement_score=likes * 6.0 + downloads * 0.002 + (15.0 if kind == "spaces" else 0.0),
            metadata={
                "kind": kind,
                "tags": tags[:8],
                "pipeline_tag": pipeline_tag,
                "package_name": repo_id.split("/")[-1],
            },
        )

    def _fallback_items(self) -> list[RawSourceItem]:
        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="models:Qwen/Qwen2.5-Coder-32B-Instruct",
                title="Qwen/Qwen2.5-Coder-32B-Instruct code generation",
                url="https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct",
                timestamp=now,
                engagement_score=540.0,
                metadata={"kind": "models", "tags": ["code", "llm", "agent"], "pipeline_tag": "text-generation"},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="spaces:example/agent-playground",
                title="example/agent-playground ai agents",
                url="https://huggingface.co/spaces/example/agent-playground",
                timestamp=now,
                engagement_score=410.0,
                metadata={"kind": "spaces", "tags": ["agents", "demo", "tooling"], "pipeline_tag": "text-generation"},
            ),
        ]
