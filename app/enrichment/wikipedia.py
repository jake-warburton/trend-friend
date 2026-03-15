"""Wikipedia summary enrichment — fetches descriptions and thumbnails for topics."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

_USER_AGENT = "SignalEye/1.0 (trend intelligence; https://signaleye.io)"

# Context hints that signal the trend is about technology/programming
_TECH_CONTEXT_TOKENS = {
    "programming", "language", "developer", "software", "framework", "library",
    "github", "npm", "pypi", "stackoverflow", "compiler", "runtime", "sdk",
    "api", "code", "coding", "package", "repository", "open source", "ide",
    "server", "database", "devops", "web", "app", "linux", "macos", "windows",
    "backend", "frontend", "typescript", "javascript", "machine learning",
    "ai", "deep learning", "neural", "algorithm", "protocol", "crypto",
    "blockchain", "smart contract", "cli", "terminal",
}

# Known ambiguous topic names mapped to their tech-context Wikipedia article title
_DISAMBIGUATION_OVERRIDES: dict[str, str] = {
    "rust": "Rust (programming language)",
    "python": "Python (programming language)",
    "swift": "Swift (programming language)",
    "go": "Go (programming language)",
    "dart": "Dart (programming language)",
    "ruby": "Ruby (programming language)",
    "julia": "Julia (programming language)",
    "r": "R (programming language)",
    "c": "C (programming language)",
    "scala": "Scala (programming language)",
    "kotlin": "Kotlin (programming language)",
    "elixir": "Elixir (programming language)",
    "haskell": "Haskell (programming language)",
    "clojure": "Clojure",
    "erlang": "Erlang (programming language)",
    "perl": "Perl",
    "elm": "Elm (programming language)",
    "zig": "Zig (programming language)",
    "carbon": "Carbon (programming language)",
    "mojo": "Mojo (programming language)",
    "react": "React (software)",
    "angular": "Angular (web framework)",
    "vue": "Vue.js",
    "next": "Next.js",
    "nest": "NestJS",
    "flask": "Flask (web framework)",
    "django": "Django (web framework)",
    "spring": "Spring Framework",
    "rails": "Ruby on Rails",
    "express": "Express.js",
    "docker": "Docker (software)",
    "kubernetes": "Kubernetes",
    "terraform": "Terraform (software)",
    "ansible": "Ansible (software)",
    "jenkins": "Jenkins (software)",
    "unity": "Unity (game engine)",
    "unreal": "Unreal Engine",
    "godot": "Godot (game engine)",
    "solana": "Solana (blockchain platform)",
    "cardano": "Cardano (blockchain platform)",
    "polkadot": "Polkadot (cryptocurrency)",
    "avalanche": "Avalanche (blockchain platform)",
    "cosmos": "Cosmos (blockchain)",
    "atom": "Atom (text editor)",
    "latex": "LaTeX",
    "redis": "Redis",
    "postgres": "PostgreSQL",
    "mongo": "MongoDB",
    "kafka": "Apache Kafka",
    "spark": "Apache Spark",
    "airflow": "Apache Airflow",
    "eclipse": "Eclipse (software)",
    "mesa": "Mesa (computer graphics)",
    "apollo": "Apollo GraphQL",
    "transformers": "Transformer (deep learning architecture)",
    "transformer": "Transformer (deep learning architecture)",
    "llama": "Llama (language model)",
    "falcon": "Falcon (language model)",
    "mistral": "Mistral AI",
    "gemma": "Gemma (language model)",
    "phi": "Phi (language model)",
    "claude": "Claude (language model)",
    "copilot": "GitHub Copilot",
    "cursor": "Cursor (text editor)",
    "vscode": "Visual Studio Code",
    "jupyter": "Project Jupyter",
    "pandas": "Pandas (software)",
    "numpy": "NumPy",
    "pytorch": "PyTorch",
    "tensorflow": "TensorFlow",
    "keras": "Keras",
    "langchain": "LangChain",
    "hugging face": "Hugging Face",
}


@dataclass(frozen=True)
class WikipediaSummary:
    """Parsed result from the Wikipedia REST summary API."""

    extract: str
    description: str | None
    thumbnail_url: str | None
    page_url: str


@dataclass(frozen=True)
class WikipediaLookupHint:
    """Context hints to disambiguate Wikipedia articles for a trend."""

    category: str
    sources: list[str]
    evidence_texts: list[str]


def fetch_wikipedia_summaries(
    titles: list[str],
    *,
    hints: dict[str, WikipediaLookupHint] | None = None,
    timeout_seconds: int = 8,
    delay_seconds: float = 0.1,
    max_workers: int = 6,
) -> dict[str, WikipediaSummary]:
    """Fetch Wikipedia summaries for a list of article titles.

    When hints are provided, ambiguous titles (like "Rust" or "Python") are
    resolved using the trend's category and source context to pick the correct
    Wikipedia article (e.g. "Rust (programming language)" instead of iron oxide).

    Returns a dict keyed by the original title.  Titles that fail silently
    return no entry.  Uses thread-based parallelism for faster batch fetches.
    """

    from concurrent.futures import ThreadPoolExecutor, as_completed

    results: dict[str, WikipediaSummary] = {}
    hints = hints or {}

    def _fetch_title(title: str) -> tuple[str, WikipediaSummary | None]:
        try:
            resolved_title = _resolve_title(title, hints.get(title))
            return title, _fetch_one(resolved_title, timeout_seconds=timeout_seconds)
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


def _resolve_title(title: str, hint: WikipediaLookupHint | None) -> str:
    """Resolve an ambiguous title to the correct Wikipedia article.

    Uses a static override table for known ambiguous names, falling back to
    context-based disambiguation via the Wikipedia search API when the title
    is short and likely ambiguous.
    """

    normalized = title.strip().lower()

    # Check static overrides — only use them if context suggests tech
    if normalized in _DISAMBIGUATION_OVERRIDES and _has_tech_context(hint):
        return _DISAMBIGUATION_OVERRIDES[normalized]

    # For short single-word titles without overrides, try search-based disambiguation
    # Only do this when we have tech context — otherwise the plain title is safer
    if hint and len(normalized.split()) == 1 and len(normalized) <= 12 and _has_tech_context(hint):
        search_result = _search_disambiguate(title, hint)
        if search_result:
            return search_result

    return title


def _has_tech_context(hint: WikipediaLookupHint | None) -> bool:
    """Return True if the trend context suggests a tech/programming topic."""

    if hint is None:
        return False

    # Check category
    tech_categories = {
        "ai-machine-learning", "developer-tools", "infrastructure-cloud",
        "data-analytics", "security-privacy", "fintech-crypto",
        "hardware-robotics", "enterprise-saas",
    }
    if hint.category in tech_categories:
        return True

    # Check sources
    dev_sources = {"github", "npm", "pypi", "stackoverflow", "huggingface", "lobsters", "devto", "hacker_news"}
    if set(hint.sources) & dev_sources:
        return True

    # Check evidence text for tech keywords
    evidence_text = " ".join(hint.evidence_texts).lower()
    matches = sum(1 for token in _TECH_CONTEXT_TOKENS if token in evidence_text)
    return matches >= 2


def _search_disambiguate(
    title: str, hint: WikipediaLookupHint, timeout_seconds: int = 5,
) -> str | None:
    """Use Wikipedia's search API to find the best article for an ambiguous title.

    Searches for the title, gets the top 5 results, and scores each against
    the trend's context to pick the most relevant one.
    """

    try:
        params = urlencode({
            "action": "query",
            "list": "search",
            "srsearch": title,
            "srlimit": "5",
            "format": "json",
        })
        url = f"https://en.wikipedia.org/w/api.php?{params}"

        try:
            import requests as _requests
            response = _requests.get(
                url,
                headers={"User-Agent": _USER_AGENT},
                timeout=timeout_seconds,
            )
            if response.status_code != 200:
                return None
            data = response.json()
        except ImportError:
            request = Request(url, headers={"User-Agent": _USER_AGENT})
            with urlopen(request, timeout=timeout_seconds) as resp:
                if resp.status != 200:
                    return None
                data = json.loads(resp.read().decode("utf-8"))

        results = data.get("query", {}).get("search", [])
        if not results:
            return None

        # Build context string from the trend
        context = f"{hint.category} {' '.join(hint.sources)} {' '.join(hint.evidence_texts)}".lower()

        best_title = None
        best_score = -1

        for result in results:
            candidate_title = result.get("title", "")
            snippet = (result.get("snippet", "") or "").lower()

            # Score based on context overlap
            score = 0
            for token in _TECH_CONTEXT_TOKENS:
                if token in snippet:
                    score += 2
                if token in candidate_title.lower():
                    score += 3

            # Bonus for title containing "(programming language)" or "(software)"
            lower_title = candidate_title.lower()
            if "(programming language)" in lower_title:
                score += 10
            elif "(software)" in lower_title:
                score += 8
            elif "(web framework)" in lower_title:
                score += 8
            elif "(game engine)" in lower_title:
                score += 6

            # Bonus for context keyword matches in snippet
            for source in hint.sources:
                if source.replace("_", " ") in snippet:
                    score += 3

            if score > best_score:
                best_score = score
                best_title = candidate_title

        # Only use the search result if we found meaningful context overlap
        if best_score >= 4 and best_title:
            return best_title

    except Exception:
        logger.debug("Wikipedia search disambiguation failed for %r", title, exc_info=True)

    return None


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
