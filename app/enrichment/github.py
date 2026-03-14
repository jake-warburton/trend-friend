"""GitHub repository metrics enrichment using the public API."""

from __future__ import annotations

from datetime import datetime

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class GitHubMetricsEnricher(MarketMetricEnricher):
    """Fetch star count, fork count, and activity metrics from GitHub."""

    source_name = "github"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        repo_slug = self._resolve_repo(target)
        if not repo_slug:
            return []
        try:
            return self._fetch_repo_metrics(repo_slug, captured_at)
        except Exception:
            return []

    def _resolve_repo(self, target: EnrichmentTarget) -> str | None:
        """Search GitHub for the most relevant repo matching this topic."""

        headers = {"Accept": "application/vnd.github+json"}
        if self.settings.github_token:
            headers["Authorization"] = f"Bearer {self.settings.github_token}"

        query = target.name or target.topic
        try:
            payload = self.get_json(
                self.build_query_url(
                    "https://api.github.com/search/repositories",
                    {"q": query, "sort": "stars", "order": "desc", "per_page": "1"},
                ),
                headers=headers,
            )
            items = payload.get("items", [])
            if not items:
                return None
            repo = items[0]
            full_name = repo.get("full_name", "")
            stars = repo.get("stargazers_count", 0)
            if stars < 50:
                return None
            return full_name
        except Exception:
            return None

    def _fetch_repo_metrics(self, repo_slug: str, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Fetch detailed metrics for a GitHub repository."""

        headers = {"Accept": "application/vnd.github+json"}
        if self.settings.github_token:
            headers["Authorization"] = f"Bearer {self.settings.github_token}"

        repo_data = self.get_json(
            f"https://api.github.com/repos/{repo_slug}",
            headers=headers,
        )

        stars = float(repo_data.get("stargazers_count", 0))
        forks = float(repo_data.get("forks_count", 0))
        open_issues = float(repo_data.get("open_issues_count", 0))
        watchers = float(repo_data.get("subscribers_count", 0))
        provenance_url = repo_data.get("html_url", f"https://github.com/{repo_slug}")

        metrics: list[TrendMetricSnapshot] = []

        if stars > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="github_stars",
                    label="GitHub stars",
                    value_numeric=stars,
                    value_display=self.compact_number(stars),
                    unit="stars",
                    period="all time",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=provenance_url,
                    is_estimated=False,
                )
            )

        if forks > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="github_forks",
                    label="GitHub forks",
                    value_numeric=forks,
                    value_display=self.compact_number(forks),
                    unit="forks",
                    period="all time",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=provenance_url,
                    is_estimated=False,
                )
            )

        if watchers > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="github_watchers",
                    label="GitHub watchers",
                    value_numeric=watchers,
                    value_display=self.compact_number(watchers),
                    unit="watchers",
                    period="all time",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=provenance_url,
                    is_estimated=False,
                )
            )

        # Fetch recent commit activity to gauge momentum
        try:
            activity = self.get_json(
                f"https://api.github.com/repos/{repo_slug}/stats/commit_activity",
                headers=headers,
            )
            if isinstance(activity, list) and len(activity) >= 4:
                recent_4_weeks = sum(week.get("total", 0) for week in activity[-4:])
                previous_4_weeks = sum(week.get("total", 0) for week in activity[-8:-4])
                if recent_4_weeks > 0:
                    metrics.append(
                        TrendMetricSnapshot(
                            source=self.source_name,
                            metric_key="recent_commits",
                            label="GitHub commits (4 weeks)",
                            value_numeric=float(recent_4_weeks),
                            value_display=str(recent_4_weeks),
                            unit="commits",
                            period="last 4 weeks",
                            captured_at=captured_at,
                            confidence=0.95,
                            provenance_url=provenance_url,
                            is_estimated=False,
                        )
                    )
                if previous_4_weeks > 0 and recent_4_weeks > 0:
                    commit_growth = ((recent_4_weeks - previous_4_weeks) / previous_4_weeks) * 100
                    metrics.append(
                        TrendMetricSnapshot(
                            source=self.source_name,
                            metric_key="commit_growth_pct",
                            label="GitHub commit growth",
                            value_numeric=round(commit_growth, 1),
                            value_display=f"{commit_growth:+.1f}%",
                            unit="percent",
                            period="4-week vs prior 4-week",
                            captured_at=captured_at,
                            confidence=0.9,
                            provenance_url=provenance_url,
                            is_estimated=False,
                        )
                    )
        except Exception:
            pass

        return metrics
