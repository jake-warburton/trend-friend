"""npm download count enrichment using the public npm registry API."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class NpmDownloadsEnricher(MarketMetricEnricher):
    """Fetch weekly and monthly download counts from the npm registry."""

    source_name = "npm"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        package_name = self._resolve_package_name(target)
        if not package_name:
            return []
        try:
            return self._fetch_download_metrics(package_name, captured_at)
        except Exception:
            return []

    def _resolve_package_name(self, target: EnrichmentTarget) -> str | None:
        """Try to find a matching npm package for the topic."""

        candidates = [target.topic.lower().replace(" ", "-")]
        candidates.extend(alias.lower().replace(" ", "-") for alias in target.aliases)

        for candidate in candidates:
            try:
                self.get_json(
                    f"https://registry.npmjs.org/{candidate}",
                    headers={"Accept": "application/json"},
                )
                return candidate
            except Exception:
                continue
        return None

    def _fetch_download_metrics(self, package_name: str, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Fetch last-week and last-month download counts from npm."""

        metrics: list[TrendMetricSnapshot] = []

        weekly_payload = self.get_json(
            f"https://api.npmjs.org/downloads/point/last-week/{package_name}"
        )
        weekly_downloads = float(weekly_payload.get("downloads", 0))
        if weekly_downloads > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="weekly_downloads",
                    label="npm weekly downloads",
                    value_numeric=weekly_downloads,
                    value_display=f"{self.compact_number(weekly_downloads)}/wk",
                    unit="downloads",
                    period="last 7 days",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=f"https://www.npmjs.com/package/{package_name}",
                    is_estimated=False,
                )
            )

        monthly_payload = self.get_json(
            f"https://api.npmjs.org/downloads/point/last-month/{package_name}"
        )
        monthly_downloads = float(monthly_payload.get("downloads", 0))
        if monthly_downloads > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="monthly_downloads",
                    label="npm monthly downloads",
                    value_numeric=monthly_downloads,
                    value_display=f"{self.compact_number(monthly_downloads)}/mo",
                    unit="downloads",
                    period="last 30 days",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=f"https://www.npmjs.com/package/{package_name}",
                    is_estimated=False,
                )
            )

        # Calculate download growth rate if we can get the previous month
        if monthly_downloads > 0:
            try:
                end_date = datetime.now(tz=timezone.utc) - timedelta(days=30)
                start_date = end_date - timedelta(days=30)
                prev_payload = self.get_json(
                    f"https://api.npmjs.org/downloads/point/"
                    f"{start_date.strftime('%Y-%m-%d')}:{end_date.strftime('%Y-%m-%d')}"
                    f"/{package_name}"
                )
                prev_downloads = float(prev_payload.get("downloads", 0))
                if prev_downloads > 0:
                    growth_pct = ((monthly_downloads - prev_downloads) / prev_downloads) * 100
                    metrics.append(
                        TrendMetricSnapshot(
                            source=self.source_name,
                            metric_key="download_growth_pct",
                            label="npm download growth",
                            value_numeric=round(growth_pct, 1),
                            value_display=f"{growth_pct:+.1f}%",
                            unit="percent",
                            period="month-over-month",
                            captured_at=captured_at,
                            confidence=0.95,
                            provenance_url=f"https://www.npmjs.com/package/{package_name}",
                            is_estimated=False,
                        )
                    )
            except Exception:
                pass

        return metrics
