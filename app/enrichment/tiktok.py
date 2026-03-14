"""TikTok market metric enrichment."""

from __future__ import annotations

from datetime import datetime

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class TikTokMetricsEnricher(MarketMetricEnricher):
    """Fetch TikTok footprint metrics from a configured provider or deterministic fallback."""

    source_name = "tiktok"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        if self.settings.tiktok_metrics_url:
            try:
                return self._enrich_from_provider(target, captured_at)
            except Exception:
                pass
        return self._fallback_metrics(target, captured_at)

    def _enrich_from_provider(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        query = target.name or target.topic
        headers = {}
        if self.settings.tiktok_metrics_token:
            headers["Authorization"] = f"Bearer {self.settings.tiktok_metrics_token}"
        payload = self.get_json(
            self.build_query_url(self.settings.tiktok_metrics_url or "", {"q": query}),
            headers=headers,
        )
        views = float(payload.get("views", 0))
        videos = float(payload.get("videos", 0))
        source_url = payload.get("sourceUrl") or f"https://www.tiktok.com/search?q={query.replace(' ', '%20')}"
        metrics: list[TrendMetricSnapshot] = []
        if views > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="video_views",
                    label="TikTok views",
                    value_numeric=views,
                    value_display=self.compact_number(views),
                    unit="views",
                    period="search footprint",
                    captured_at=captured_at,
                    confidence=0.9,
                    provenance_url=str(source_url),
                    is_estimated=False,
                )
            )
        if videos > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="video_count",
                    label="TikTok videos",
                    value_numeric=videos,
                    value_display=self.compact_number(videos),
                    unit="videos",
                    period="search footprint",
                    captured_at=captured_at,
                    confidence=0.9,
                    provenance_url=str(source_url),
                    is_estimated=False,
                )
            )
        return metrics

    def _fallback_metrics(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        return []
