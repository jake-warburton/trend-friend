"""Product Hunt source adapter for commercial/launch momentum signals.

Uses the public Atom feed at producthunt.com/feed which returns
recently featured products.  This captures commercial momentum —
new tools, AI wrappers, developer platforms — that complement
the social/developer/knowledge signals from other sources.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}
BASE_ENGAGEMENT = 300
"""Base engagement value for a Product Hunt featured product."""


class ProductHuntSourceAdapter(SourceAdapter):
    """Fetch recently featured Product Hunt launches via Atom feed."""

    source_name = "producthunt"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_rss()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_rss(self) -> list[RawSourceItem]:
        """Fetch the Product Hunt Atom feed."""

        url = "https://www.producthunt.com/feed"
        headers = {
            "User-Agent": self.settings.reddit_user_agent,
            "Accept": "application/atom+xml",
        }

        raw = self.get_url(url, headers=headers)
        root = ET.fromstring(raw.decode("utf-8"))
        entries = root.findall("atom:entry", ATOM_NS)
        self.raw_item_count = len(entries)

        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()

        for position, entry in enumerate(entries):
            title_el = entry.find("atom:title", ATOM_NS)
            link_el = entry.find("atom:link", ATOM_NS)
            published_el = entry.find("atom:published", ATOM_NS)
            id_el = entry.find("atom:id", ATOM_NS)
            content_el = entry.find("atom:content", ATOM_NS)

            name = (title_el.text or "").strip() if title_el is not None else ""
            link = (link_el.get("href", "") if link_el is not None else "")
            published = (published_el.text or "") if published_el is not None else ""
            external_id = (id_el.text or "").strip() if id_el is not None else ""
            tagline = _extract_tagline(content_el)

            if not name or not external_id:
                continue
            if external_id in seen_ids:
                continue
            seen_ids.add(external_id)

            # Combine product name and tagline for better topic extraction
            title = f"{name}: {tagline}" if tagline else name

            engagement = max(BASE_ENGAGEMENT - position * 5, 30)

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=external_id,
                    title=title,
                    url=link,
                    timestamp=self._parse_published(published),
                    engagement_score=float(engagement),
                    metadata={},
                )
            )
            self.kept_item_count += 1
            if len(items) >= self.settings.max_items_per_source:
                break

        return items

    @staticmethod
    def _parse_published(date_str: str) -> datetime:
        """Parse a Product Hunt published timestamp."""
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
                external_id="ph-1",
                title="DevAgent: AI coding assistant for internal developer platforms",
                url="https://www.producthunt.com/products/devagent",
                timestamp=now,
                engagement_score=300.0,
                metadata={},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="ph-2",
                title="LaunchKit: Open source deployment toolkit for startups",
                url="https://www.producthunt.com/products/launchkit",
                timestamp=now,
                engagement_score=280.0,
                metadata={},
            ),
        ]


def _extract_tagline(content_el: ET.Element | None) -> str:
    """Extract the first paragraph as a plain-text tagline."""
    if content_el is None or not content_el.text:
        return ""
    html_text = content_el.text
    # Extract first <p>...</p> content only (skip nav links)
    match = re.search(r"<p>(.*?)</p>", html_text, re.DOTALL)
    if not match:
        return ""
    # Strip nested HTML tags and whitespace
    text = re.sub(r"<[^>]+>", "", match.group(1)).strip()
    text = " ".join(text.split())
    return text[:200]
