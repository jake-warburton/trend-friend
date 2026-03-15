"""Wikipedia pageview metrics enrichment using the Wikimedia REST API."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class WikipediaPageviewsEnricher(MarketMetricEnricher):
    """Fetch Wikipedia article pageview counts from the public Wikimedia API."""

    source_name = "wikipedia"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        article_title = self._resolve_article(target)
        if not article_title:
            return []
        metrics: list[TrendMetricSnapshot] = []
        try:
            metrics.extend(self._fetch_pageview_metrics(article_title, captured_at))
        except Exception:
            pass
        try:
            metrics.extend(self._fetch_article_categories(article_title, captured_at))
        except Exception:
            pass
        return metrics

    def _resolve_article(self, target: EnrichmentTarget) -> str | None:
        """Try to find a matching Wikipedia article for the topic."""

        from urllib.parse import quote

        candidates = [target.name or target.topic]
        candidates.extend(target.aliases)

        for candidate in candidates:
            encoded = quote(candidate.replace(" ", "_"), safe="")
            try:
                payload = self.get_json(
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}",
                    headers={
                        "Accept": "application/json",
                        "User-Agent": "SignalEye/1.0 (trend intelligence)",
                    },
                )
                title = payload.get("title")
                if title and payload.get("extract"):
                    return title
            except Exception:
                continue
        return None

    def _fetch_article_categories(self, article_title: str, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Fetch Wikipedia categories and Wikidata description for topic classification."""

        from urllib.parse import quote

        encoded = quote(article_title.replace(" ", "_"), safe="")
        provenance = f"https://en.wikipedia.org/wiki/{encoded}"
        metrics: list[TrendMetricSnapshot] = []

        try:
            payload = self.get_json(
                f"https://en.wikipedia.org/w/api.php?action=query&titles={encoded}"
                f"&prop=categories|langlinkscount&cllimit=20&clshow=!hidden&format=json",
                headers={"User-Agent": "SignalEye/1.0 (trend intelligence)"},
            )
            pages = payload.get("query", {}).get("pages", {})
            for page_data in pages.values():
                categories = page_data.get("categories", [])
                if categories:
                    cat_names = [
                        c.get("title", "").replace("Category:", "")
                        for c in categories[:10]
                        if c.get("title", "").startswith("Category:")
                    ]
                    if cat_names:
                        metrics.append(
                            TrendMetricSnapshot(
                                source=self.source_name,
                                metric_key="wikipedia_categories",
                                label="Wikipedia categories",
                                value_numeric=float(len(cat_names)),
                                value_display=", ".join(cat_names[:8]),
                                unit="categories",
                                period="current",
                                captured_at=captured_at,
                                confidence=0.9,
                                provenance_url=provenance,
                                is_estimated=False,
                            )
                        )

                lang_count = page_data.get("langlinkscount", 0)
                if lang_count and lang_count > 0:
                    metrics.append(
                        TrendMetricSnapshot(
                            source=self.source_name,
                            metric_key="wikipedia_languages",
                            label="Wikipedia language editions",
                            value_numeric=float(lang_count),
                            value_display=f"{lang_count} languages",
                            unit="count",
                            period="current",
                            captured_at=captured_at,
                            confidence=0.95,
                            provenance_url=provenance,
                            is_estimated=False,
                        )
                    )
        except Exception:
            pass

        return metrics

    def _fetch_pageview_metrics(self, article_title: str, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Fetch daily pageview data from the Wikimedia pageviews API."""

        from urllib.parse import quote

        encoded = quote(article_title.replace(" ", "_"), safe="")
        now = datetime.now(tz=timezone.utc)
        end_date = (now - timedelta(days=1)).strftime("%Y%m%d")
        start_30d = (now - timedelta(days=31)).strftime("%Y%m%d")
        start_7d = (now - timedelta(days=8)).strftime("%Y%m%d")
        start_prev_30d = (now - timedelta(days=61)).strftime("%Y%m%d")
        end_prev_30d = (now - timedelta(days=31)).strftime("%Y%m%d")

        metrics: list[TrendMetricSnapshot] = []
        provenance = f"https://en.wikipedia.org/wiki/{encoded}"

        # Last 30 days of pageviews
        payload_30d = self.get_json(
            f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
            f"en.wikipedia/all-access/all-agents/{encoded}/daily/{start_30d}/{end_date}",
            headers={"User-Agent": "SignalEye/1.0 (trend intelligence)"},
        )
        items_30d = payload_30d.get("items", [])
        total_30d = sum(item.get("views", 0) for item in items_30d)

        if total_30d > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="monthly_pageviews",
                    label="Wikipedia monthly pageviews",
                    value_numeric=float(total_30d),
                    value_display=f"{self.compact_number(float(total_30d))}/mo",
                    unit="pageviews",
                    period="last 30 days",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=provenance,
                    is_estimated=False,
                )
            )

        # Last 7 days for weekly metric
        items_7d = [item for item in items_30d if item.get("timestamp", "") >= start_7d]
        total_7d = sum(item.get("views", 0) for item in items_7d)
        if total_7d > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="weekly_pageviews",
                    label="Wikipedia weekly pageviews",
                    value_numeric=float(total_7d),
                    value_display=f"{self.compact_number(float(total_7d))}/wk",
                    unit="pageviews",
                    period="last 7 days",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=provenance,
                    is_estimated=False,
                )
            )

        # Previous 30 days for growth calculation
        if total_30d > 0:
            try:
                payload_prev = self.get_json(
                    f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
                    f"en.wikipedia/all-access/all-agents/{encoded}/daily/{start_prev_30d}/{end_prev_30d}",
                    headers={"User-Agent": "SignalEye/1.0 (trend intelligence)"},
                )
                total_prev = sum(item.get("views", 0) for item in payload_prev.get("items", []))
                if total_prev > 0:
                    growth_pct = ((total_30d - total_prev) / total_prev) * 100
                    metrics.append(
                        TrendMetricSnapshot(
                            source=self.source_name,
                            metric_key="pageview_growth_pct",
                            label="Wikipedia pageview growth",
                            value_numeric=round(growth_pct, 1),
                            value_display=f"{growth_pct:+.1f}%",
                            unit="percent",
                            period="month-over-month",
                            captured_at=captured_at,
                            confidence=0.9,
                            provenance_url=provenance,
                            is_estimated=False,
                        )
                    )
            except Exception:
                pass

        return metrics
