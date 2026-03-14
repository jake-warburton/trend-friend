"""Wikipedia summary enrichment — fetches descriptions and thumbnails for topics."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from urllib.parse import quote
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

_USER_AGENT = "SignalEye/1.0 (trend intelligence; https://signaleye.io)"


@dataclass(frozen=True)
class WikipediaSummary:
    """Parsed result from the Wikipedia REST summary API."""

    extract: str
    description: str | None
    thumbnail_url: str | None
    page_url: str


def fetch_wikipedia_summaries(
    titles: list[str],
    *,
    timeout_seconds: int = 8,
    delay_seconds: float = 0.1,
) -> dict[str, WikipediaSummary]:
    """Fetch Wikipedia summaries for a list of article titles.

    Returns a dict keyed by the original title.  Titles that fail silently
    return no entry.
    """

    results: dict[str, WikipediaSummary] = {}
    for title in titles:
        try:
            summary = _fetch_one(title, timeout_seconds=timeout_seconds)
            if summary is not None:
                results[title] = summary
        except Exception:
            logger.debug("Wikipedia summary fetch failed for %r", title, exc_info=True)
        if delay_seconds > 0:
            time.sleep(delay_seconds)
    return results


def _fetch_one(title: str, *, timeout_seconds: int) -> WikipediaSummary | None:
    encoded = quote(title.replace(" ", "_"), safe="")
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}"
    request = Request(url, headers={"Accept": "application/json", "User-Agent": _USER_AGENT})

    try:
        import requests as _requests

        response = _requests.get(
            url,
            headers={"Accept": "application/json", "User-Agent": _USER_AGENT},
            timeout=timeout_seconds,
        )
        if response.status_code != 200:
            return None
        payload = response.json()
    except ImportError:
        with urlopen(request, timeout=timeout_seconds) as resp:
            if resp.status != 200:
                return None
            payload = json.loads(resp.read().decode("utf-8"))

    extract = (payload.get("extract") or "").strip()
    if not extract:
        return None

    page_url = (
        (payload.get("content_urls") or {}).get("desktop", {}).get("page")
        or f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'), safe='')}"
    )

    return WikipediaSummary(
        extract=extract,
        description=(payload.get("description") or "").strip() or None,
        thumbnail_url=(payload.get("thumbnail") or {}).get("source"),
        page_url=page_url,
    )
