"""PyPI download count enrichment using the public pypistats API."""

from __future__ import annotations

from datetime import datetime

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class PyPIDownloadsEnricher(MarketMetricEnricher):
    """Fetch recent download counts from the pypistats.org public API."""

    source_name = "pypi"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        package_name = self._resolve_package_name(target)
        if not package_name:
            return []
        try:
            return self._fetch_download_metrics(package_name, captured_at)
        except Exception:
            return []

    def _resolve_package_name(self, target: EnrichmentTarget) -> str | None:
        """Try to find a matching PyPI package for the topic."""

        candidates = [target.topic.lower().replace(" ", "-")]
        candidates.extend(alias.lower().replace(" ", "-") for alias in target.aliases)
        candidates.append(target.topic.lower().replace(" ", "_"))

        for candidate in candidates:
            try:
                payload = self.get_json(
                    f"https://pypistats.org/api/packages/{candidate}/recent",
                    headers={"Accept": "application/json"},
                )
                if payload.get("data"):
                    return candidate
            except Exception:
                continue
        return None

    def _fetch_download_metrics(self, package_name: str, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Fetch recent download counts from pypistats.org."""

        payload = self.get_json(
            f"https://pypistats.org/api/packages/{package_name}/recent",
            headers={"Accept": "application/json"},
        )
        data = payload.get("data", {})
        metrics: list[TrendMetricSnapshot] = []

        last_day = float(data.get("last_day", 0))
        last_week = float(data.get("last_week", 0))
        last_month = float(data.get("last_month", 0))

        if last_week > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="weekly_downloads",
                    label="PyPI weekly downloads",
                    value_numeric=last_week,
                    value_display=f"{self.compact_number(last_week)}/wk",
                    unit="downloads",
                    period="last 7 days",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=f"https://pypi.org/project/{package_name}/",
                    is_estimated=False,
                )
            )

        if last_month > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="monthly_downloads",
                    label="PyPI monthly downloads",
                    value_numeric=last_month,
                    value_display=f"{self.compact_number(last_month)}/mo",
                    unit="downloads",
                    period="last 30 days",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=f"https://pypi.org/project/{package_name}/",
                    is_estimated=False,
                )
            )

        if last_day > 0 and last_week > 0:
            daily_avg = last_week / 7
            if daily_avg > 0:
                day_vs_avg = ((last_day - daily_avg) / daily_avg) * 100
                metrics.append(
                    TrendMetricSnapshot(
                        source=self.source_name,
                        metric_key="daily_download_trend",
                        label="PyPI daily vs weekly avg",
                        value_numeric=round(day_vs_avg, 1),
                        value_display=f"{day_vs_avg:+.1f}%",
                        unit="percent",
                        period="today vs 7-day average",
                        captured_at=captured_at,
                        confidence=0.9,
                        provenance_url=f"https://pypi.org/project/{package_name}/",
                        is_estimated=False,
                    )
                )

        return metrics
