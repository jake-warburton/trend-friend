"""PyPI release adapter for early Python-package trend corroboration."""

from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
from xml.etree import ElementTree

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

RSS_URL = "https://pypi.org/rss/updates.xml"
TREND_KEYWORDS = (
    "agent",
    "agents",
    "ai",
    "automation",
    "copilot",
    "embedding",
    "embeddings",
    "inference",
    "llm",
    "mcp",
    "model",
    "multimodal",
    "rag",
    "retrieval",
    "robot",
    "robotics",
    "search",
    "vector",
    "vision",
    "workflow",
)
MAX_RSS_CANDIDATES = 36


class PyPISourceAdapter(SourceAdapter):
    """Fetch newly updated PyPI packages and keep trend-rich releases."""

    source_name = "pypi"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_updates()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_updates(self) -> list[RawSourceItem]:
        rss_payload = self.get_url(RSS_URL, headers={"Accept": "application/rss+xml"})
        entries = self._parse_rss(rss_payload)
        self.raw_item_count = len(entries)
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        for package_name, published_at, release_url in entries[:MAX_RSS_CANDIDATES]:
            if package_name in seen_ids:
                continue
            package_payload = self.get_json(
                f"https://pypi.org/pypi/{quote(package_name)}/json",
                headers={"Accept": "application/json"},
            )
            normalized = self._normalize_package(package_payload, package_name, published_at, release_url)
            if normalized is None:
                continue
            seen_ids.add(package_name)
            items.append(normalized)
            self.kept_item_count += 1
            if len(items) >= self.settings.max_items_per_source:
                break
        return items

    def _parse_rss(self, payload: bytes) -> list[tuple[str, datetime, str]]:
        root = ElementTree.fromstring(payload)
        entries: list[tuple[str, datetime, str]] = []
        for item in root.findall("./channel/item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            package_name = title.split()[0].strip() if title else ""
            if not package_name:
                continue
            try:
                published_at = parsedate_to_datetime(pub_date).astimezone(timezone.utc) if pub_date else datetime.now(
                    tz=timezone.utc
                )
            except (TypeError, ValueError):
                published_at = datetime.now(tz=timezone.utc)
            entries.append((package_name, published_at, link))
        return entries

    def _normalize_package(
        self,
        payload: dict[str, object],
        package_name: str,
        published_at: datetime,
        release_url: str,
    ) -> RawSourceItem | None:
        info = payload.get("info") if isinstance(payload.get("info"), dict) else {}
        if not info:
            return None
        summary = str(info.get("summary", "")).strip()
        keywords = self._split_keywords(info.get("keywords"))
        classifiers = self._extract_classifiers(info.get("classifiers"))
        project_urls = info.get("project_urls") if isinstance(info.get("project_urls"), dict) else {}
        metadata_text = " ".join(
            value
            for value in (
                package_name,
                summary,
                " ".join(keywords),
                " ".join(classifiers),
            )
            if value
        ).lower()
        if not any(keyword in metadata_text for keyword in TREND_KEYWORDS):
            return None
        upload_time = self._latest_release_time(payload, published_at)
        engagement = self._engagement_score(
            package_name=package_name,
            summary=summary,
            keywords=keywords,
            classifiers=classifiers,
            project_urls=project_urls,
            uploaded_at=upload_time,
        )
        title = f"{package_name} {summary}".strip()
        return RawSourceItem(
            source=self.source_name,
            external_id=package_name,
            title=title,
            url=str(
                info.get("package_url")
                or info.get("project_url")
                or release_url
                or f"https://pypi.org/project/{package_name}/"
            ),
            timestamp=upload_time,
            engagement_score=engagement,
            metadata={
                "keywords": keywords[:8],
                "classifiers": classifiers[:6],
                "package_name": package_name,
                "summary": summary,
            },
        )

    def _latest_release_time(self, payload: dict[str, object], fallback: datetime) -> datetime:
        urls = payload.get("urls") if isinstance(payload.get("urls"), list) else []
        latest = fallback
        for entry in urls:
            if not isinstance(entry, dict):
                continue
            uploaded = str(entry.get("upload_time_iso_8601") or entry.get("upload_time") or "").strip()
            if not uploaded:
                continue
            try:
                timestamp = self.parse_iso_timestamp(uploaded)
            except ValueError:
                continue
            if timestamp > latest:
                latest = timestamp
        return latest

    def _engagement_score(
        self,
        package_name: str,
        summary: str,
        keywords: list[str],
        classifiers: list[str],
        project_urls: dict[str, object],
        uploaded_at: datetime,
    ) -> float:
        metadata_text = " ".join((package_name, summary, " ".join(keywords), " ".join(classifiers))).lower()
        keyword_matches = sum(1 for keyword in TREND_KEYWORDS if keyword in metadata_text)
        project_url_bonus = 20.0 if project_urls else 0.0
        classifier_bonus = min(len(classifiers), 6) * 4.0
        keyword_bonus = min(len(keywords), 6) * 6.0
        age_hours = max((datetime.now(tz=timezone.utc) - uploaded_at).total_seconds() / 3600, 0.0)
        freshness_bonus = max(0.0, 72.0 - min(age_hours, 72.0))
        return round(
            55.0 + (keyword_matches * 16.0) + keyword_bonus + classifier_bonus + project_url_bonus + freshness_bonus,
            2,
        )

    def _split_keywords(self, value: object) -> list[str]:
        if isinstance(value, str):
            return [part.strip() for part in value.replace(";", ",").split(",") if part.strip()]
        return []

    def _extract_classifiers(self, value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        classifiers: list[str] = []
        for entry in value:
            if not isinstance(entry, str):
                continue
            simplified = entry.split("::")[-1].strip()
            if simplified:
                classifiers.append(simplified)
        return classifiers

    def _fallback_items(self) -> list[RawSourceItem]:
        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="agent-observability",
                title="agent-observability Python package for tracing AI agent workflows",
                url="https://pypi.org/project/agent-observability/",
                timestamp=now,
                engagement_score=188.0,
                metadata={"keywords": ["ai", "agents", "observability"], "package_name": "agent-observability"},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="mcp-toolkit",
                title="mcp-toolkit Python helpers for model context protocol servers",
                url="https://pypi.org/project/mcp-toolkit/",
                timestamp=now,
                engagement_score=172.0,
                metadata={"keywords": ["mcp", "llm", "tooling"], "package_name": "mcp-toolkit"},
            ),
        ]
