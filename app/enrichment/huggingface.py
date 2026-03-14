"""Hugging Face model metrics enrichment using the public API."""

from __future__ import annotations

from datetime import datetime

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class HuggingFaceEnricher(MarketMetricEnricher):
    """Fetch model download counts and likes from the Hugging Face API."""

    source_name = "huggingface"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        results = self._search_models(target)
        if not results:
            return []
        try:
            return self._build_metrics(results, target, captured_at)
        except Exception:
            return []

    def _search_models(self, target: EnrichmentTarget) -> list[dict]:
        """Search for HuggingFace models matching the topic."""

        query = target.name or target.topic
        try:
            payload = self.get_json(
                self.build_query_url(
                    "https://huggingface.co/api/models",
                    {
                        "search": query,
                        "sort": "downloads",
                        "direction": "-1",
                        "limit": "5",
                    },
                ),
                headers={"Accept": "application/json"},
            )
            if isinstance(payload, list) and payload:
                return payload
        except Exception:
            pass
        return []

    def _build_metrics(
        self, models: list[dict], target: EnrichmentTarget, captured_at: datetime,
    ) -> list[TrendMetricSnapshot]:
        """Aggregate download and like metrics across top matching models."""

        metrics: list[TrendMetricSnapshot] = []
        total_downloads = sum(m.get("downloads", 0) for m in models)
        total_likes = sum(m.get("likes", 0) for m in models)
        model_count = len(models)
        top_model = models[0] if models else {}
        top_model_id = top_model.get("modelId", "")

        provenance = f"https://huggingface.co/models?search={target.topic.replace(' ', '+')}"

        if total_downloads > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="model_downloads",
                    label="HuggingFace downloads (top models)",
                    value_numeric=float(total_downloads),
                    value_display=self.compact_number(float(total_downloads)),
                    unit="downloads",
                    period="all time (top 5 models)",
                    captured_at=captured_at,
                    confidence=0.9,
                    provenance_url=provenance,
                    is_estimated=False,
                )
            )

        if total_likes > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="model_likes",
                    label="HuggingFace likes (top models)",
                    value_numeric=float(total_likes),
                    value_display=self.compact_number(float(total_likes)),
                    unit="likes",
                    period="all time (top 5 models)",
                    captured_at=captured_at,
                    confidence=0.9,
                    provenance_url=provenance,
                    is_estimated=False,
                )
            )

        if model_count > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="model_count",
                    label="HuggingFace models",
                    value_numeric=float(model_count),
                    value_display=str(model_count),
                    unit="models",
                    period="top results",
                    captured_at=captured_at,
                    confidence=0.85,
                    provenance_url=provenance,
                    is_estimated=False,
                )
            )

        return metrics
