"""arXiv source adapter for recent AI/ML/NLP research papers.

Uses the arXiv Atom API to fetch recently submitted papers from
cs.AI, cs.LG, and cs.CL categories.  Engagement is estimated from
position in the recency-sorted feed since arXiv doesn't expose
citation or download counts through this endpoint.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

ATOM_NS = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
CATEGORIES = "cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL"
BASE_ENGAGEMENT = 200
"""Base engagement value for a recently submitted arXiv paper."""


class ArxivSourceAdapter(SourceAdapter):
    """Fetch recent arXiv papers in AI/ML/NLP categories."""

    source_name = "arxiv"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_api()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_api(self) -> list[RawSourceItem]:
        """Query the arXiv Atom API for recent papers."""

        limit = min(self.settings.max_items_per_source, 100)
        url = (
            f"http://export.arxiv.org/api/query"
            f"?search_query={CATEGORIES}"
            f"&sortBy=submittedDate&sortOrder=descending"
            f"&max_results={limit}"
        )

        raw = self.get_url(url)
        root = ET.fromstring(raw.decode("utf-8"))
        entries = root.findall("atom:entry", ATOM_NS)
        self.raw_item_count = len(entries)

        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()

        for position, entry in enumerate(entries):
            title_el = entry.find("atom:title", ATOM_NS)
            id_el = entry.find("atom:id", ATOM_NS)
            published_el = entry.find("atom:published", ATOM_NS)
            summary_el = entry.find("atom:summary", ATOM_NS)
            primary_cat = entry.find("arxiv:primary_category", ATOM_NS)

            title = " ".join((title_el.text or "").split()) if title_el is not None else ""
            arxiv_id = (id_el.text or "").strip() if id_el is not None else ""
            published = (published_el.text or "") if published_el is not None else ""
            category = (primary_cat.get("term", "") if primary_cat is not None else "")

            if not title or not arxiv_id:
                continue
            if arxiv_id in seen_ids:
                continue
            seen_ids.add(arxiv_id)

            engagement = max(BASE_ENGAGEMENT - position * 4, 20)

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=arxiv_id,
                    title=title,
                    url=arxiv_id,
                    timestamp=self._parse_published(published),
                    engagement_score=float(engagement),
                    metadata={"category": category},
                )
            )
            self.kept_item_count += 1
            if len(items) >= self.settings.max_items_per_source:
                break

        return items

    @staticmethod
    def _parse_published(date_str: str) -> datetime:
        """Parse an arXiv published timestamp."""
        if not date_str:
            return datetime.now(tz=timezone.utc)
        try:
            normalized = date_str.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized)
        except (ValueError, TypeError):
            return datetime.now(tz=timezone.utc)

    def _fallback_items(self) -> list[RawSourceItem]:
        """Return deterministic sample data for local fallback runs."""

        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="http://arxiv.org/abs/0000.00001v1",
                title="Scaling Laws for Agentic Reasoning in Large Language Models",
                url="http://arxiv.org/abs/0000.00001v1",
                timestamp=now,
                engagement_score=200.0,
                metadata={"category": "cs.AI"},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="http://arxiv.org/abs/0000.00002v1",
                title="Efficient Fine-Tuning Methods for Vision-Language Alignment",
                url="http://arxiv.org/abs/0000.00002v1",
                timestamp=now,
                engagement_score=180.0,
                metadata={"category": "cs.CL"},
            ),
        ]
