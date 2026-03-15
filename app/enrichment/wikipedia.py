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
    max_workers: int = 6,
) -> dict[str, WikipediaSummary]:
    """Fetch Wikipedia summaries for a list of article titles.

    Returns a dict keyed by the original title.  Titles that fail silently
    return no entry.  Uses thread-based parallelism for faster batch fetches.
    """

    from concurrent.futures import ThreadPoolExecutor, as_completed

    results: dict[str, WikipediaSummary] = {}

    def _fetch_title(title: str) -> tuple[str, WikipediaSummary | None]:
        try:
            return title, _fetch_one(title, timeout_seconds=timeout_seconds)
        except Exception:
            logger.debug("Wikipedia summary fetch failed for %r", title, exc_info=True)
            return title, None

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_fetch_title, title): title for title in titles}
        for future in as_completed(futures):
            title, summary = future.result()
            if summary is not None:
                results[title] = summary

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
