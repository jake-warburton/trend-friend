"""Topic extraction pipeline."""

from __future__ import annotations

from dataclasses import dataclass
import re
from math import log10

from app.models import NormalizedSignal, RawSourceItem
from app.sources.catalog import signal_type_for_source
from app.topics.audience import assign_audience_flags
from app.topics.geo import assign_geo_flags
from app.topics.normalize import (
    is_meaningful_topic,
    normalize_topic_name,
    remove_stop_words,
    tokenize_text,
)

MAX_TOPICS_PER_ITEM = 3
MAX_BIGRAMS_PER_ITEM = 2
SOURCE_TOPIC_LIMITS = {
    "chrome_web_store": 2,
    "curated_feeds": 2,
    "google_news": 2,
    "google_trends": 2,
    "hacker_news": 2,
    "polymarket": 2,
    "product_hunt": 1,
    "producthunt": 1,
    "twitter": 2,
    "youtube": 2,
    "mastodon": 2,
    "coingecko": 2,
    "apple_charts": 1,
}
SOURCE_BIGRAM_LIMITS = {
    "chrome_web_store": 1,
    "curated_feeds": 0,
    "google_news": 1,
    "google_trends": 1,
    "hacker_news": 1,
    "polymarket": 1,
    "twitter": 1,
    "youtube": 1,
    "mastodon": 1,
    "coingecko": 1,
    "apple_charts": 0,
}
SOURCE_LOW_SIGNAL_TOKENS = {
    "chrome_web_store": {"assistant", "browser", "chrome", "extension", "extensions", "sidebar", "tool"},
    "curated_feeds": {"announces", "explains", "introducing", "latest", "new", "says", "using", "why"},
    "google_news": {"live", "updates", "update", "latest", "watch", "watching", "says", "know"},
    "hacker_news": {"watching", "people", "report", "reports", "footage"},
    "twitter": {"watching", "people", "report", "reports", "footage"},
    "youtube": {"build", "building", "demo", "explained", "how", "review", "tutorial", "using", "video"},
    "mastodon": {"boost", "fediverse", "mastodon", "toot", "instance"},
    "coingecko": {"coin", "coingecko", "trending", "market", "category"},
    "apple_charts": {"top", "free", "chart", "charts"},
}
BIGRAM_HEAD_TOKENS = {
    "analytics",
    "automation",
    "battery",
    "center",
    "cloud",
    "copilot",
    "database",
    "filesystem",
    "framework",
    "guitar",
    "inference",
    "infrastructure",
    "lisp",
    "market",
    "model",
    "models",
    "monitoring",
    "network",
    "origin",
    "page",
    "payments",
    "pipeline",
    "plant",
    "platform",
    "pricing",
    "recycling",
    "robotics",
    "sales",
    "sensors",
    "software",
    "stack",
    "storage",
    "strategy",
    "supply",
    "systems",
    "tuner",
    "view",
    "vision",
    "war",
    "words",
    "workflow",
    "workflows",
    "solo",
}
BIGRAM_MODIFIER_TOKENS = {
    "agent",
    "agents",
    "ai",
    "audio",
    "battery",
    "climate",
    "common",
    "copyleft",
    "data",
    "developer",
    "distributed",
    "electric",
    "embedded",
    "enterprise",
    "filesystem",
    "guitar",
    "open",
    "posthog",
    "pricing",
    "quantum",
    "robot",
    "robotics",
    "sales",
    "saas",
    "street",
    "supply",
    "vector",
    "vercel",
    "video",
    "warehouse",
}
LOW_SIGNAL_BIGRAM_TOKENS = {
    "all",
    "accidentally",
    "adopted",
    "after",
    "amid",
    "away",
    "based",
    "becomes",
    "build",
    "can",
    "cost",
    "coverage",
    "cross",
    "doesn",
    "each",
    "everything",
    "extend",
    "extends",
    "fans",
    "finally",
    "film",
    "find",
    "have",
    "getting",
    "graphing",
    "has",
    "hn",
    "here",
    "if",
    "immediately",
    "interview",
    "its",
    "last",
    "learned",
    "legal",
    "legitimate",
    "launch",
    "list",
    "matters",
    "men",
    "most",
    "need",
    "now",
    "opinionated",
    "others",
    "per",
    "process",
    "promote",
    "reimagining",
    "remotely",
    "react",
    "released",
    "rule",
    "rules",
    "rumors",
    "shuts",
    "show",
    "same",
    "score",
    "started",
    "stories",
    "supports",
    "successful",
    "take",
    "that",
    "them",
    "t20",
    "two",
    "use",
    "user",
    "was",
    "walk",
    "walking",
    "watch",
    "were",
    "what",
    "will",
    "wanna",
    "years",
    "you",
    "your",
    "dead",
    "collaborate",
    "dont",
    "mention",
}
METADATA_TOPIC_KEYS = (
    "tags",
    "keywords",
    "tag_list",
    "pipeline_tag",
    "library_name",
    "package_name",
    "channel_title",
)
GENERIC_METADATA_TOPICS = {
    "ai",
    "api",
    "app",
    "apps",
    "cli",
    "dataset",
    "datasets",
    "developer",
    "javascript",
    "library",
    "machine-learning",
    "model",
    "models",
    "nodejs",
    "open-source",
    "opensource",
    "package",
    "packages",
    "python package",
    "python",
    "space",
    "spaces",
    "tool",
    "tools",
    "youtube channel",
}
GENERIC_METADATA_PREFIXES = (
    "format ",
    "language ",
    "license ",
    "region ",
    "size categories ",
    "task categories ",
)
NOISY_FALLBACK_SOURCES = {
    "curated_feeds",
    "google_news",
    "hacker_news",
    "reddit",
    "twitter",
    "youtube",
}
PRODUCT_HUNT_SOURCES = {"product_hunt", "producthunt"}
HIGH_CONFIDENCE_TOPIC_THRESHOLD = 0.78
MIN_BIGRAM_CONFIDENCE = 0.2
MAX_ENTITY_SPAN_TOKENS = 4
ENTITY_SPAN_CONNECTOR_TOKENS = {"and", "for", "of", "the", "to"}
ENTITY_SPAN_STOP_TOKENS = {
    "capabilities",
    "capability",
    "discussion",
    "explain",
    "explains",
    "explanation",
    "guide",
    "instructions",
    "people",
    "promote",
    "repeatable",
    "thoughts",
    "tips",
    "tutorial",
    "using",
}
CONVERSATIONAL_PATTERNS = (
    "do you feel it too",
    "feel really alone",
    "i feel really alone",
    "i will not promote",
    "will not promote",
)
ENTITY_SPAN_LEAD_STOP_TOKENS = {"can", "could", "does", "how", "is", "should", "were", "will", "why"}
ENTITY_SPAN_TAIL_STOP_TOKENS = {
    "capabilities",
    "coverage",
    "explained",
    "instructions",
    "learned",
    "promote",
    "reimagining",
    "supports",
}
NEWS_HEADLINE_WRAPPER_PHRASES = (
    "breaking news",
    "fans react",
    "latest on",
    "live updates",
    "score updates",
    "top stories",
    "watch live",
    "what to know",
)
NEWS_EXACT_PHRASE_TOPICS = {
    "donald trump",
    "grand theft auto",
    "iran war",
    "joe biden",
    "los angeles lakers",
    "premier league",
    "taylor swift",
    "trade war",
    "us president",
}
NEWS_ENTITY_STOP_WORDS = {
    "again",
    "amid",
    "after",
    "comments",
    "fans",
    "latest",
    "live",
    "react",
    "released",
    "rumors",
    "says",
    "stories",
    "updates",
    "watch",
}
ENTITY_PREFIX_PATTERNS = (
    re.compile(r"^\s*([A-Z][A-Za-z0-9+.-]*(?:\s+[A-Z][A-Za-z0-9+.-]*){0,3})\s*[:|–-]"),
)


@dataclass(frozen=True)
class ExtractedTopicCandidate:
    """A ranked topic candidate before final filtering."""

    raw_text: str
    normalized_topic: str
    strategy: str
    confidence: float


def extract_candidate_topics(title: str, source_name: str | None = None) -> list[str]:
    """Extract ranked candidates from a title."""

    working_title = clean_tweet_text(title) if source_name == "twitter" else title
    tokens = remove_stop_words(tokenize_text(working_title))
    if source_name:
        blocked_tokens = SOURCE_LOW_SIGNAL_TOKENS.get(source_name, set())
        tokens = [token for token in tokens if token not in blocked_tokens]
    if not tokens:
        return []
    ranked_candidates: list[ExtractedTopicCandidate] = []
    ranked_candidates.extend(infer_entity_span_topics(working_title, source_name))

    source_specific_topics = infer_source_specific_topics(title, tokens, source_name)
    ranked_candidates.extend(
        build_ranked_candidates(source_specific_topics, strategy="canonical_rule", confidence=0.96)
    )

    canonical_topics = infer_canonical_topics(tokens)
    ranked_candidates.extend(build_ranked_candidates(canonical_topics, strategy="canonical_rule", confidence=0.9))

    repository_topic = infer_repository_topic(title)
    if repository_topic:
        ranked_candidates.append(
            ExtractedTopicCandidate(
                raw_text=repository_topic,
                normalized_topic=repository_topic,
                strategy="repository",
                confidence=0.99,
            )
        )

    has_strong_entity_span = any(
        candidate.strategy == "entity_span" and candidate.confidence >= HIGH_CONFIDENCE_TOPIC_THRESHOLD
        for candidate in ranked_candidates
    )
    if not repository_topic and not source_specific_topics and not has_strong_entity_span:
        ranked_candidates.extend(infer_meaningful_bigrams(tokens))

    if (
        not ranked_candidates
        and source_name not in {"google_news", "google_trends", "hacker_news", "polymarket", "reddit", "twitter"}
    ):
        ranked_candidates.extend(infer_meaningful_unigrams(tokens))

    ranked_candidates.sort(key=lambda candidate: -candidate.confidence)
    exact_phrase_topics = exact_phrase_topics_for_title(title)
    seen: set[str] = set()
    ordered_candidates: list[str] = []
    added_bigrams = 0
    max_topics = SOURCE_TOPIC_LIMITS.get(source_name or "", MAX_TOPICS_PER_ITEM)
    max_bigrams = SOURCE_BIGRAM_LIMITS.get(source_name or "", MAX_BIGRAMS_PER_ITEM)
    protected_multiword_topics = {normalize_topic_name(topic) for topic in source_specific_topics + canonical_topics}
    for candidate in ranked_candidates:
        normalized = candidate.normalized_topic
        if not normalized:
            continue
        if not is_meaningful_candidate_for_source(normalized, source_name, candidate.strategy):
            continue
        if not topic_passes_quality_gate(candidate, title, source_name, exact_phrase_topics):
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        is_non_canonical_bigram = (
            candidate.strategy == "bigram" and " " in normalized and normalized not in protected_multiword_topics
        )
        if is_non_canonical_bigram and added_bigrams >= max_bigrams:
            continue
        ordered_candidates.append(normalized)
        if is_non_canonical_bigram:
            added_bigrams += 1
        if len(ordered_candidates) >= max_topics:
            break
    return [
        topic
        for topic in ordered_candidates
        if not any(
            topic != other
            and (
                set(topic.split()) < set(other.split())
                or (other.startswith(topic) and len(other.split()) > len(topic.split()))
            )
            for other in ordered_candidates
        )
    ]


def extract_candidate_topics_for_item(item: RawSourceItem) -> list[str]:
    """Extract candidates from the title plus selective metadata topic hints."""

    candidates: list[str] = []
    seen: set[str] = set()
    metadata_topics = infer_metadata_topics(item)
    title_topics = extract_candidate_topics(item.title, source_name=item.source)
    for candidate in metadata_topics + title_topics:
        normalized = normalize_topic_name(candidate)
        if not normalized or normalized in seen or not is_meaningful_topic(normalized):
            continue
        seen.add(normalized)
        candidates.append(normalized)
        if len(candidates) >= SOURCE_TOPIC_LIMITS.get(item.source, MAX_TOPICS_PER_ITEM):
            break
    return candidates


def infer_source_specific_topics(title: str, tokens: list[str], source_name: str | None) -> list[str]:
    """Return source-specific canonical topics before general extraction heuristics."""

    if source_name in PRODUCT_HUNT_SOURCES:
        return infer_product_hunt_topics(title)
    if source_name == "google_news":
        return infer_google_news_topics(title, tokens)
    if source_name == "polymarket":
        return infer_polymarket_topics(tokens)
    if source_name == "huggingface":
        return infer_huggingface_topics(tokens)
    if source_name == "youtube":
        return infer_youtube_topics(tokens)
    if source_name == "coingecko":
        return infer_coingecko_topics(title, tokens)
    if source_name == "mastodon":
        return infer_mastodon_topics(title, tokens)
    if source_name == "stackoverflow":
        return infer_stackoverflow_topics(title, tokens)
    if source_name == "twitter":
        return infer_twitter_topics(title, tokens)
    return []


def infer_google_news_topics(title: str, tokens: list[str]) -> list[str]:
    """Extract clearer entity-like phrases from broad news headlines."""

    token_set = set(tokens)
    normalized_title = normalize_topic_name(title)
    inferred_topics: list[str] = []
    inferred_topics.extend(infer_google_news_entity_topics(title))

    phrase_patterns: tuple[tuple[str, str], ...] = (
        ("donald trump", "donald trump"),
        ("joe biden", "joe biden"),
        ("taylor swift", "taylor swift"),
        ("grand theft auto", "grand theft auto"),
        ("nfl draft", "nfl draft"),
        ("iran war", "iran war"),
        ("red sea shipping", "red sea shipping"),
        ("ceasefire talks", "ceasefire talks"),
        ("fed rate cuts", "fed rate cuts"),
        ("fed rate cut", "fed rate cuts"),
        ("inflation data", "inflation data"),
        ("oil prices", "oil prices"),
        ("los angeles lakers", "los angeles lakers"),
        ("premier league title race", "premier league title race"),
        ("premier league", "premier league"),
        ("champions league", "champions league"),
        ("transfer window", "transfer window"),
        ("court ruling", "court ruling"),
        ("storm warning", "storm warning"),
        ("wildfire risk", "wildfire risk"),
        ("trade war", "trade war"),
        ("shipping risks", "shipping risks"),
    )
    for trigger, topic in phrase_patterns:
        if trigger in normalized_title:
            inferred_topics.append(topic)

    entity_patterns: tuple[tuple[set[str], str], ...] = (
        ({"red", "sea", "shipping"}, "red sea shipping"),
        ({"red", "sea", "shipping", "risks"}, "red sea shipping"),
        ({"ceasefire", "talks"}, "ceasefire talks"),
        ({"fed", "rate", "cuts"}, "fed rate cuts"),
        ({"fed", "rate", "cut"}, "fed rate cuts"),
        ({"inflation", "data"}, "inflation data"),
        ({"iran", "war"}, "iran war"),
        ({"oil", "prices"}, "oil prices"),
        ({"los", "angeles", "lakers"}, "los angeles lakers"),
        ({"premier", "league", "title", "race"}, "premier league title race"),
        ({"premier", "league"}, "premier league"),
        ({"champions", "league"}, "champions league"),
        ({"transfer", "window"}, "transfer window"),
        ({"court", "ruling"}, "court ruling"),
        ({"storm", "warning"}, "storm warning"),
        ({"wildfire", "risk"}, "wildfire risk"),
        ({"trade", "war"}, "trade war"),
        ({"nfl", "draft"}, "nfl draft"),
    )
    for required_tokens, topic in entity_patterns:
        if required_tokens <= token_set and topic not in inferred_topics:
            inferred_topics.append(topic)

    if {"red", "sea"} <= token_set and ("shipping" in token_set or "risks" in token_set):
        inferred_topics.insert(0, "red sea shipping")
    if {"fed", "rate"} <= token_set and ("cut" in token_set or "cuts" in token_set):
        inferred_topics.insert(0, "fed rate cuts")

    country_or_region_pairs: tuple[tuple[str, str, str], ...] = (
        ("ukraine", "ceasefire", "ukraine ceasefire"),
        ("gaza", "ceasefire", "gaza ceasefire"),
        ("china", "tariffs", "china tariffs"),
        ("taiwan", "defense", "taiwan defense"),
        ("europe", "inflation", "europe inflation"),
        ("us", "inflation", "us inflation"),
        ("us", "jobs", "us jobs"),
    )
    for left, right, topic in country_or_region_pairs:
        if left in token_set and right in token_set:
            inferred_topics.append(topic)

    seen: set[str] = set()
    ordered_topics: list[str] = []
    for topic in inferred_topics:
        normalized = normalize_topic_name(topic)
        if normalized and normalized not in seen:
            seen.add(normalized)
            ordered_topics.append(normalized)
    return [
        topic
        for topic in ordered_topics
        if not any(
            topic != other and set(topic.split()) < set(other.split())
            for other in ordered_topics
        )
    ]


def infer_google_news_entity_topics(title: str) -> list[str]:
    """Extract strong named entities and title phrases from news headlines."""

    leading_segment = re.split(r"\s*[:|–-]\s*", title, maxsplit=1)[0].strip()
    if not leading_segment:
        return []
    normalized_segment = normalize_topic_name(leading_segment)
    if any(phrase in normalized_segment for phrase in NEWS_HEADLINE_WRAPPER_PHRASES):
        return []

    spans = re.findall(
        r"\b(?:[A-Z][A-Za-z0-9+.'-]*|[A-Z]{2,})(?:\s+(?:[A-Z][A-Za-z0-9+.'-]*|[A-Z]{2,}|of|for|and|the)){1,4}\b",
        leading_segment,
    )
    topics: list[str] = []
    for span in spans:
        normalized = normalize_entity_span(span, "google_news")
        if not normalized or normalized in topics:
            continue
        if normalized.startswith("grand theft auto "):
            normalized = "grand theft auto"
        tokens = normalized.split()
        if any(token in NEWS_ENTITY_STOP_WORDS for token in tokens):
            continue
        topics.append(normalized)
    return topics


def infer_repository_topic(title: str) -> str | None:
    """Extract a stable topic from a leading owner/repository identifier."""

    repository_match = re.match(r"^\s*([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)\b", title)
    if repository_match is None:
        return None
    owner_name, repository_name = repository_match.group(1).split("/", maxsplit=1)
    repository_tokens = tokenize_text(repository_name)
    if not repository_tokens:
        return None
    topic = " ".join(repository_tokens)
    return normalize_topic_name(topic) if topic else None


def infer_meaningful_bigrams(tokens: list[str]) -> list[ExtractedTopicCandidate]:
    """Return a small set of higher-signal bigrams from an ordered token list."""

    scored_bigrams: list[ExtractedTopicCandidate] = []
    for index, (first, second) in enumerate(zip(tokens, tokens[1:])):
        if first == second:
            continue
        if token_contains_number(first) or token_contains_number(second):
            continue
        if second == "ai":
            continue
        if first in LOW_SIGNAL_BIGRAM_TOKENS or second in LOW_SIGNAL_BIGRAM_TOKENS:
            continue
        bigram = f"{first} {second}"
        normalized = normalize_topic_name(bigram)
        if is_meaningful_topic(normalized):
            confidence = min(0.95, score_bigram_candidate(first, second, index) / 10.0)
            scored_bigrams.append(
                ExtractedTopicCandidate(
                    raw_text=bigram,
                    normalized_topic=normalized,
                    strategy="bigram",
                    confidence=confidence,
                )
            )
    scored_bigrams.sort(key=lambda item: (-item.confidence, item.normalized_topic))
    return scored_bigrams


def infer_meaningful_unigrams(tokens: list[str]) -> list[ExtractedTopicCandidate]:
    """Return fallback single-token topics after removing weak tokens."""

    candidates: list[ExtractedTopicCandidate] = []
    for token in tokens:
        if token in LOW_SIGNAL_BIGRAM_TOKENS or token_contains_number(token):
            continue
        candidates.append(
            ExtractedTopicCandidate(
                raw_text=token,
                normalized_topic=token,
                strategy="unigram",
                confidence=0.45,
            )
        )
        if len(candidates) >= MAX_TOPICS_PER_ITEM:
            break
    return candidates


def token_contains_number(token: str) -> bool:
    """Return True for numeric or year-like tokens that make weak topic fragments."""

    return any(character.isdigit() for character in token)


def score_bigram_candidate(first: str, second: str, index: int) -> float:
    """Prefer noun-like domain phrases over generic adjacent token pairs."""

    score = 0.0
    if second in BIGRAM_HEAD_TOKENS:
        score += 4.0
    if first in BIGRAM_MODIFIER_TOKENS:
        score += 2.5
    if len(second) >= 7:
        score += 0.75
    if len(first) >= 6:
        score += 0.35
    # Slightly prefer later surviving phrases over headline framing near the start.
    score += min(index, 5) * 0.15
    return score


def infer_canonical_topics(tokens: list[str]) -> list[str]:
    """Add a few explicit topic heuristics for high-value recurring concepts."""

    inferred_topics: list[str] = []
    token_set = set(tokens)
    if "robotics" in token_set:
        inferred_topics.append("robotics")
    if "battery" in token_set and ("recycling" in token_set or "recovery" in token_set):
        inferred_topics.append("battery recycling")
    if "certificate" in token_set and "origin" in token_set:
        inferred_topics.append("certificate origin")
    if "common" in token_set and "lisp" in token_set:
        inferred_topics.append("common lisp")
    if "english" in token_set and "words" in token_set:
        inferred_topics.append("english words")
    if "street" in token_set and "view" in token_set:
        inferred_topics.append("street view")
    if "world" in token_set and "cup" in token_set:
        inferred_topics.append("world cup")
    if {"iran", "war"} <= token_set:
        inferred_topics.append("iran war")
    if {"donald", "trump"} <= token_set:
        inferred_topics.append("donald trump")
    if {"joe", "biden"} <= token_set:
        inferred_topics.append("joe biden")
    if {"us", "president"} <= token_set:
        inferred_topics.append("us president")
    if {"premier", "league"} <= token_set:
        inferred_topics.append("premier league")
    if {"nfl", "draft"} <= token_set:
        inferred_topics.append("nfl draft")
    if {"grand", "theft", "auto"} <= token_set:
        inferred_topics.append("grand theft auto")
    if {"taylor", "swift"} <= token_set:
        inferred_topics.append("taylor swift")
    if ("ai" in token_set or "openai" in token_set or "artificial" in token_set) and (
        "agent" in token_set or "agents" in token_set
    ):
        inferred_topics.append("ai agents")
    if "copyleft" in token_set and "erosion" in token_set:
        inferred_topics.append("copyleft erosion")
    if "stargate" in token_set and "data" in token_set:
        inferred_topics.append("stargate data")
    if {"model", "context", "protocol"} <= token_set:
        inferred_topics.append("model context protocol")
    if {"battery", "energy", "storage"} <= token_set:
        inferred_topics.append("battery energy storage")
    if {"retrieval", "augmented", "generation"} <= token_set:
        inferred_topics.append("retrieval augmented generation")
    if {"large", "language", "models"} <= token_set:
        inferred_topics.append("large language models")
    # Consumer / health / fitness
    if {"intermittent", "fasting"} <= token_set:
        inferred_topics.append("intermittent fasting")
    if {"cold", "plunge"} <= token_set or {"ice", "bath"} <= token_set:
        inferred_topics.append("cold plunge")
    if {"meal", "prep"} <= token_set:
        inferred_topics.append("meal prep")
    if {"weight", "loss"} <= token_set:
        inferred_topics.append("weight loss")
    if {"plant", "based"} <= token_set:
        inferred_topics.append("plant based diet")
    if {"gut", "health"} <= token_set:
        inferred_topics.append("gut health")
    if "ozempic" in token_set or "semaglutide" in token_set:
        inferred_topics.append("glp-1 drugs")
    if {"retinol"} <= token_set or {"skincare", "routine"} <= token_set:
        inferred_topics.append("skincare")
    if {"electric", "vehicle"} <= token_set or {"electric", "vehicles"} <= token_set:
        inferred_topics.append("electric vehicles")
    if {"solar", "panel"} <= token_set or {"solar", "panels"} <= token_set or {"solar", "energy"} <= token_set:
        inferred_topics.append("solar energy")
    if {"heat", "pump"} <= token_set:
        inferred_topics.append("heat pump")
    if {"smart", "home"} <= token_set:
        inferred_topics.append("smart home")
    if {"home", "automation"} <= token_set:
        inferred_topics.append("home automation")
    if {"digital", "nomad"} <= token_set:
        inferred_topics.append("digital nomad")
    if {"remote", "work"} <= token_set:
        inferred_topics.append("remote work")
    if {"side", "hustle"} <= token_set:
        inferred_topics.append("side hustle")
    if {"passive", "income"} <= token_set:
        inferred_topics.append("passive income")
    if {"dropshipping"} <= token_set:
        inferred_topics.append("dropshipping")
    if {"print", "demand"} <= token_set:
        inferred_topics.append("print on demand")
    # Finance & crypto
    if {"interest", "rate"} <= token_set or {"interest", "rates"} <= token_set:
        inferred_topics.append("interest rates")
    if {"stock", "market"} <= token_set:
        inferred_topics.append("stock market")
    if {"real", "estate"} <= token_set:
        inferred_topics.append("real estate")
    if {"supply", "chain"} <= token_set:
        inferred_topics.append("supply chain")
    return inferred_topics


def infer_polymarket_topics(tokens: list[str]) -> list[str]:
    """Collapse threshold-style Polymarket titles into stable asset/company topics."""

    token_set = set(tokens)
    if "bitcoin" in token_set or "btc" in token_set:
        return ["bitcoin"]
    if "ethereum" in token_set or "eth" in token_set:
        return ["ethereum"]
    if {"crude", "oil"} <= token_set or "oil" in token_set:
        return ["crude oil"]
    if "fed" in token_set:
        return ["federal reserve"]
    if "openai" in token_set or "gpt" in token_set:
        return ["openai"]
    if "solana" in token_set or "sol" in token_set:
        return ["solana"]
    return []


def infer_huggingface_topics(tokens: list[str]) -> list[str]:
    """Prefer stable model-family or task phrases for Hugging Face items."""

    token_set = set(tokens)
    inferred_topics: list[str] = []
    if {"text", "embedding"} <= token_set:
        inferred_topics.append("text embeddings")
    if {"image", "generation"} <= token_set:
        inferred_topics.append("image generation")
    if {"speech", "recognition"} <= token_set:
        inferred_topics.append("speech recognition")
    if {"vision", "language"} <= token_set:
        inferred_topics.append("vision language models")
    if {"agent", "agents"} & token_set and ("framework" in token_set or "tool" in token_set):
        inferred_topics.append("ai agents")
    return inferred_topics


def infer_youtube_topics(tokens: list[str]) -> list[str]:
    """Prefer durable topics over generic creator framing for YouTube titles."""

    token_set = set(tokens)
    inferred_topics: list[str] = []
    if {"vibe", "coding"} <= token_set:
        inferred_topics.append("vibe coding")
    if {"ai", "avatar"} <= token_set:
        inferred_topics.append("ai avatars")
    if {"video", "generation"} <= token_set:
        inferred_topics.append("video generation")
    if {"open", "source"} <= token_set and ("ai" in token_set or "llm" in token_set):
        inferred_topics.append("open source ai")
    if {"model", "context", "protocol"} <= token_set:
        inferred_topics.append("model context protocol")
    if ("agent" in token_set or "agents" in token_set) and ("workflow" in token_set or "automation" in token_set):
        inferred_topics.append("ai agents")
    return inferred_topics


def infer_coingecko_topics(title: str, tokens: list[str]) -> list[str]:
    """Extract coin or category names from CoinGecko titles."""

    # Titles like "Bitcoin (BTC) trending on CoinGecko" or "DeFi category trending"
    # Extract the name before the parenthetical or dash
    inferred: list[str] = []
    for separator in (" (", " —", " trending"):
        if separator in title:
            prefix = title.split(separator, 1)[0].strip()
            normalized = normalize_topic_name(prefix)
            if normalized and is_meaningful_topic(normalized) and normalized not in {"nft"}:
                inferred.append(normalized)
            break
    return inferred


def infer_mastodon_topics(title: str, tokens: list[str]) -> list[str]:
    """Extract topics from Mastodon hashtags and statuses."""

    inferred: list[str] = []
    # Hashtag titles like "#ai" → "ai"
    if title.startswith("#"):
        tag_name = title.lstrip("#").strip().lower()
        # Split camelCase hashtags (e.g., "MachineLearning" → "machine learning")
        parts = re.sub(r"([a-z])([A-Z])", r"\1 \2", tag_name).lower()
        normalized = normalize_topic_name(parts)
        if normalized and is_meaningful_topic(normalized):
            inferred.append(normalized)
    return inferred


_TWITTER_CLEAN_PATTERNS = (
    re.compile(r"https?://\S+"),          # URLs
    re.compile(r"@\w+"),                   # @mentions
    re.compile(r"[^\w\s'.,;:!?/$%&+-]", re.UNICODE),  # Emojis and special chars
    re.compile(r"[.]{2,}"),               # Ellipsis
    re.compile(r"\bRT\b"),                # Retweet marker
    re.compile(r"\n+"),                   # Newlines
)

# Conversational filler common in tweets but not in headlines
_TWITTER_FILLER = re.compile(
    r"\b(who do you|what do you|how do you|fill out|check out|let me know|"
    r"here's what|what to expect|do you have|winning it all|sound off|"
    r"drop your|share your|tell us|tag someone|link in bio)\b",
    re.IGNORECASE,
)


def clean_tweet_text(text: str) -> str:
    """Strip URLs, @mentions, emojis, filler, and noise from tweet text for topic extraction."""
    cleaned = text
    for pattern in _TWITTER_CLEAN_PATTERNS:
        cleaned = pattern.sub(" ", cleaned)
    # Strip hashtag symbols but keep the word
    cleaned = cleaned.replace("#", "")
    # Remove conversational filler
    cleaned = _TWITTER_FILLER.sub(" ", cleaned)
    # Handle possessives before case normalization
    cleaned = re.sub(r"'[Ss]\b", "", cleaned)
    # Normalize ALL CAPS to title case for entity span extraction
    # Keep short acronyms (2-4 chars) as-is (e.g., ICE, NATO, NCAA)
    words = cleaned.split()
    normalized_words = []
    for word in words:
        if len(word) > 4 and word.isupper() and word.isalpha():
            normalized_words.append(word.title())
        else:
            normalized_words.append(word)
    cleaned = " ".join(normalized_words)
    # Remove BREAKING: / JUST IN: prefixes
    cleaned = re.sub(r"^(BREAKING|JUST IN|WATCH|LIVE|EXCLUSIVE|ALERT)\s*[:\-–|]\s*", "", cleaned, flags=re.IGNORECASE)
    # Collapse whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def infer_twitter_topics(title: str, tokens: list[str]) -> list[str]:
    """Extract topics from tweets: hashtags first, then key phrases from cleaned text."""

    inferred: list[str] = []

    # 1. Extract hashtags as high-confidence topics
    hashtags = re.findall(r"#(\w{2,})", title)
    for tag in hashtags:
        # Split camelCase (e.g., "NCAATournament" → "ncaa tournament")
        parts = re.sub(r"([a-z])([A-Z])", r"\1 \2", tag).lower()
        normalized = normalize_topic_name(parts)
        if normalized and is_meaningful_topic(normalized) and normalized not in inferred:
            inferred.append(normalized)

    # 2. Clean tweet text and extract entity-span topics from it
    cleaned = clean_tweet_text(title)
    if cleaned:
        entity_topics = infer_entity_span_topics(cleaned, "twitter")
        for candidate in entity_topics:
            normalized = normalize_topic_name(candidate.raw_text)
            if normalized and is_meaningful_topic(normalized) and normalized not in inferred:
                inferred.append(normalized)

    return inferred


def infer_stackoverflow_topics(title: str, tokens: list[str]) -> list[str]:
    """Extract technology topics from Stack Overflow question titles and tags."""

    inferred: list[str] = []
    token_set = set(tokens)

    # Well-known tech compound phrases that appear in SO questions
    so_phrases: tuple[tuple[set[str], str], ...] = (
        ({"react", "native"}, "react native"),
        ({"next", "js"}, "next.js"),
        ({"node", "js"}, "node.js"),
        ({"vue", "js"}, "vue.js"),
        ({"type", "script"}, "typescript"),
        ({"machine", "learning"}, "machine learning"),
        ({"deep", "learning"}, "deep learning"),
        ({"web", "assembly"}, "webassembly"),
        ({"docker", "compose"}, "docker compose"),
        ({"spring", "boot"}, "spring boot"),
    )
    for phrase_tokens, phrase in so_phrases:
        if phrase_tokens <= token_set:
            inferred.append(phrase)

    return inferred


def infer_product_hunt_topics(title: str) -> list[str]:
    """Prefer the shipped product name over launch tagline fragments."""

    prefix = title.split(":", 1)[0].strip()
    if not prefix:
        return []
    prefix = re.sub(r"\s+by\s+[A-Za-z0-9_.+-]+$", "", prefix, flags=re.IGNORECASE).strip()
    normalized = normalize_topic_name(prefix)
    if not normalized:
        return []
    if not is_meaningful_product_hunt_name(normalized):
        return []
    return [normalized]


def is_meaningful_product_hunt_name(topic_name: str) -> bool:
    """Allow short launch names while still rejecting obvious wrappers."""

    if is_meaningful_topic(topic_name):
        return True
    tokens = topic_name.split()
    if len(tokens) == 1:
        return len(tokens[0]) >= 3 and tokens[0] not in LOW_SIGNAL_BIGRAM_TOKENS
    non_connector_tokens = [token for token in tokens if token not in ENTITY_SPAN_CONNECTOR_TOKENS]
    if len(non_connector_tokens) < 2 or len(tokens) > MAX_ENTITY_SPAN_TOKENS:
        return False
    if any(token in LOW_SIGNAL_BIGRAM_TOKENS for token in non_connector_tokens):
        return False
    return True


def is_meaningful_candidate_for_source(topic_name: str, source_name: str | None, strategy: str) -> bool:
    """Apply source-aware meaningfulness checks without weakening the global baseline."""

    if is_meaningful_topic(topic_name):
        return True
    return source_name in PRODUCT_HUNT_SOURCES and strategy == "canonical_rule" and is_meaningful_product_hunt_name(
        topic_name
    )


def build_signals_from_items(items: list[RawSourceItem]) -> list[NormalizedSignal]:
    """Convert raw source items into topic-level normalized signals."""

    signals: list[NormalizedSignal] = []
    for item in items:
        geo = assign_geo_flags(item)
        audience = assign_audience_flags(item, geo)
        for topic in extract_candidate_topics_for_item(item):
            signals.append(
                NormalizedSignal(
                    topic=topic,
                    source=item.source,
                    signal_type=signal_type_for_source(item.source),
                    value=signal_value_for_item(item),
                    timestamp=item.timestamp,
                    evidence=item.title,
                    evidence_url=item.url,
                    language_code=audience.language_code,
                    audience_flags=audience.audience_flags,
                    market_flags=audience.market_flags,
                    geo_flags=geo.flags,
                    geo_country_code=geo.country_code,
                    geo_region=geo.region,
                    geo_detection_mode=geo.detection_mode,
                    geo_confidence=geo.confidence,
                )
            )
    return signals


def signal_value_for_item(item: RawSourceItem) -> float:
    """Return a source-aware signal value without changing signal type semantics."""

    if item.source != "polymarket":
        return item.engagement_score
    return polymarket_signal_value(item)


def polymarket_signal_value(item: RawSourceItem) -> float:
    """Compress market size into a distinct, conviction-aware Polymarket signal."""

    volume_24hr = _metadata_float(item.metadata, "volume24hr", item.engagement_score)
    liquidity = _metadata_float(item.metadata, "liquidity", 0.0)
    open_interest = _metadata_float(item.metadata, "open_interest", 0.0)
    market_activity = max(volume_24hr + (liquidity * 0.15), 0.0)
    market_depth = max(open_interest, 0.0)
    normalized_value = (log10(market_activity + 1.0) * 9.0) + (log10(market_depth + 1.0) * 4.0)

    if volume_24hr >= 100_000 or open_interest >= 250_000:
        normalized_value *= 1.2
    elif volume_24hr < 5_000 and open_interest < 25_000:
        normalized_value *= 0.45

    return round(normalized_value, 2)


def infer_metadata_topics(item: RawSourceItem) -> list[str]:
    """Return conservative topic hints from structured metadata fields."""

    metadata_topics: list[str] = []
    for key in METADATA_TOPIC_KEYS:
        metadata_value = item.metadata.get(key)
        values = _metadata_values(metadata_value)
        for value in values:
            normalized = normalize_topic_name(value)
            if (
                not normalized
                or normalized in metadata_topics
                or normalized in GENERIC_METADATA_TOPICS
                or is_blocked_metadata_topic(normalized)
                or not is_meaningful_topic(normalized)
            ):
                continue
            metadata_topics.append(normalized)
    return metadata_topics


def is_blocked_metadata_topic(topic_name: str) -> bool:
    """Return True for structural metadata labels that should not become trends."""

    normalized_label = topic_name.replace("-", " ")
    if normalized_label.startswith(GENERIC_METADATA_PREFIXES):
        return True
    return normalized_label in {"language en", "region us"}


def build_ranked_candidates(topics: list[str], strategy: str, confidence: float) -> list[ExtractedTopicCandidate]:
    """Convert normalized topic strings into ranked candidates."""

    candidates: list[ExtractedTopicCandidate] = []
    for topic in topics:
        normalized = normalize_topic_name(topic)
        if not normalized:
            continue
        candidates.append(
            ExtractedTopicCandidate(
                raw_text=topic,
                normalized_topic=normalized,
                strategy=strategy,
                confidence=confidence,
            )
        )
    return candidates


def infer_entity_span_topics(title: str, source_name: str | None) -> list[ExtractedTopicCandidate]:
    """Prefer leading branded or title-cased phrases over generic token pairs."""

    raw_title = title.strip()
    if not raw_title:
        return []
    if source_name == "google_news":
        return []
    normalized_title = normalize_topic_name(raw_title)
    if any(pattern in normalized_title for pattern in CONVERSATIONAL_PATTERNS):
        return []

    spans: list[ExtractedTopicCandidate] = []
    leading_segment = re.split(r"\s*[:|–-]\s*", raw_title, maxsplit=1)[0].strip()
    for pattern in ENTITY_PREFIX_PATTERNS:
        match = pattern.match(raw_title)
        if match is None:
            continue
        candidate = normalize_entity_span(match.group(1), source_name)
        if candidate is None:
            continue
        spans.append(
            ExtractedTopicCandidate(
                raw_text=match.group(1).strip(),
                normalized_topic=candidate,
                strategy="entity_span",
                confidence=0.98,
            )
        )

    title_case_spans = re.findall(
        r"\b(?:[A-Z][A-Za-z0-9+.-]*|[A-Z]{2,})(?:\s+(?:[A-Z][A-Za-z0-9+.-]*|[A-Z]{2,}|of|for|and|to|the)){1,3}\b",
        leading_segment,
    )
    for span in title_case_spans:
        candidate = normalize_entity_span(span, source_name)
        if candidate is None:
            continue
        spans.append(
            ExtractedTopicCandidate(
                raw_text=span,
                normalized_topic=candidate,
                strategy="entity_span",
                confidence=0.88,
            )
        )

    deduped: dict[str, ExtractedTopicCandidate] = {}
    for candidate in spans:
        previous = deduped.get(candidate.normalized_topic)
        if previous is None or previous.confidence < candidate.confidence:
            deduped[candidate.normalized_topic] = candidate
    return list(deduped.values())


def normalize_entity_span(span: str, source_name: str | None) -> str | None:
    """Normalize a raw entity span and reject generic wrapper phrases."""

    normalized = normalize_topic_name(span)
    if not normalized or not is_meaningful_topic(normalized):
        return None
    tokens = normalized.split()
    if len(tokens) > MAX_ENTITY_SPAN_TOKENS:
        return None
    if tokens[0] in ENTITY_SPAN_LEAD_STOP_TOKENS or tokens[-1] in ENTITY_SPAN_TAIL_STOP_TOKENS:
        return None
    if any(token in LOW_SIGNAL_BIGRAM_TOKENS for token in tokens[:-1]):
        return None
    if any(token in ENTITY_SPAN_STOP_TOKENS for token in tokens[1:]):
        return None
    if tokens[0] in {"hi", "hello", "why"}:
        return None
    if source_name in NOISY_FALLBACK_SOURCES and len(tokens) == 1 and len(tokens[0]) < 6:
        return None
    return normalized


def exact_phrase_topics_for_title(title: str) -> set[str]:
    """Return normalized two-to-four-token exact phrases seen in the original title."""

    tokens = tokenize_text(title)
    exact_topics: set[str] = set()
    for window_size in range(2, 5):
        for index in range(len(tokens) - window_size + 1):
            phrase = " ".join(tokens[index : index + window_size])
            normalized = normalize_topic_name(phrase)
            if normalized:
                exact_topics.add(normalized)
    return exact_topics


def topic_passes_quality_gate(
    candidate: ExtractedTopicCandidate,
    title: str,
    source_name: str | None,
    exact_phrase_topics: set[str],
) -> bool:
    """Return True when a candidate is precise enough to keep."""

    normalized_title = normalize_topic_name(title)
    if candidate.normalized_topic in NEWS_EXACT_PHRASE_TOPICS:
        return True
    if candidate.normalized_topic in {"alone journey", "capabilities repeatable"}:
        return False
    if any(fragment in candidate.normalized_topic for fragment in {"latest on", "watch live", "what know"}):
        return False
    if any(pattern in normalized_title for pattern in CONVERSATIONAL_PATTERNS):
        return candidate.strategy in {"canonical_rule", "entity_span", "repository"}
    if (
        candidate.strategy == "bigram"
        and candidate.confidence < MIN_BIGRAM_CONFIDENCE
        and candidate.normalized_topic not in exact_phrase_topics
    ):
        return False
    if source_name in NOISY_FALLBACK_SOURCES and candidate.confidence < HIGH_CONFIDENCE_TOPIC_THRESHOLD:
        return candidate.normalized_topic in exact_phrase_topics and candidate.strategy != "unigram"
    return True


def _metadata_values(value: object) -> list[str]:
    """Normalize a metadata field into a list of text values."""

    if value is None:
        return []
    if isinstance(value, str):
        return [part.strip() for part in re.split(r"[|,]", value) if part.strip()]
    if isinstance(value, (list, tuple, set)):
        values: list[str] = []
        for item in value:
            values.extend(_metadata_values(item))
        return values
    return [str(value).strip()]


def _metadata_float(metadata: dict[str, object], key: str, default: float = 0.0) -> float:
    """Read a numeric metadata value safely."""

    try:
        return float(metadata.get(key, default))
    except (TypeError, ValueError):
        return default
