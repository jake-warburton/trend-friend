"""GitHub source adapter."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter


class GitHubSourceAdapter(SourceAdapter):
    """Fetch recently updated repositories and normalize them."""

    source_name = "github"

    def fetch(self) -> list[RawSourceItem]:
        try:
            headers = {"Accept": "application/vnd.github+json"}
            if self.settings.github_token:
                headers["Authorization"] = f"Bearer {self.settings.github_token}"
            recent_date = (datetime.now(tz=timezone.utc) - timedelta(days=30)).date().isoformat()
            base_url = (
                "https://api.github.com/search/repositories"
                f"?q=stars:%3E100+pushed:%3E{recent_date}"
                "&sort=updated&order=desc&per_page=30"
            )
            items: list[RawSourceItem] = []
            seen_ids: set[str] = set()
            for page in range(1, max(1, self.settings.github_page_limit) + 1):
                payload = self.get_json(f"{base_url}&page={page}", headers=headers)
                page_items = self.normalize_items(payload, limit=self.settings.max_items_per_source)
                self.raw_item_count += len(payload.get("items", []))
                if not page_items:
                    break
                for item in page_items:
                    if item.external_id in seen_ids:
                        continue
                    seen_ids.add(item.external_id)
                    items.append(item)
                    self.kept_item_count += 1
                    if len(items) >= self.settings.max_items_per_source:
                        return items
            return items
        except Exception as error:
            self.log_fallback(error)
            return self.normalize_items(self.sample_payload())

    def normalize_items(self, payload: dict[str, object], limit: int | None = None) -> list[RawSourceItem]:
        """Normalize GitHub search results into shared models."""

        repositories = payload.get("items", [])
        items: list[RawSourceItem] = []
        max_items = self.settings.max_items_per_source if limit is None else limit
        for repository in repositories[:max_items]:
            full_name = str(repository.get("full_name", "")).strip()
            pushed_at = str(repository.get("pushed_at", "")).strip()
            if not full_name or not pushed_at:
                continue
            description_value = repository.get("description") or ""
            description = str(description_value).strip()
            title = full_name if not description else f"{full_name} {description}"
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=str(repository.get("id", "")),
                    title=title,
                    url=str(repository.get("html_url", "")),
                    timestamp=self.parse_iso_timestamp(pushed_at),
                    engagement_score=float(repository.get("stargazers_count", 0))
                    + float(repository.get("forks_count", 0)),
                    metadata={"language": str(repository.get("language", ""))},
                )
            )
        return items

    @staticmethod
    def sample_payload() -> dict[str, object]:
        """Return deterministic fallback repositories."""

        return {
            "items": [
                {
                    "id": 2001,
                    "full_name": "openai/agents-sdk",
                    "description": "SDK for building AI agent workflows",
                    "html_url": "https://github.com/openai/agents-sdk",
                    "pushed_at": "2026-03-08T10:00:00Z",
                    "stargazers_count": 8400,
                    "forks_count": 920,
                    "language": "Python",
                },
                {
                    "id": 2002,
                    "full_name": "safecycle/battery-recovery",
                    "description": "Tooling for battery recycling operations",
                    "html_url": "https://github.com/safecycle/battery-recovery",
                    "pushed_at": "2026-03-08T08:30:00Z",
                    "stargazers_count": 2100,
                    "forks_count": 190,
                    "language": "TypeScript",
                },
            ]
        }
