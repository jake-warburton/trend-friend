"""Topic categorization into product-facing sectors."""

from __future__ import annotations

import re

# Keywords shorter than this threshold are matched as whole words only
# to avoid false positives from substring matches (e.g. "ev" in "pageviews").
_WORD_BOUNDARY_THRESHOLD = 4

CATEGORY_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "geopolitics-world",
        (
            "ceasefire", "sanctions", "nato", "tariff", "trade war", "red sea",
            "gaza", "ukraine", "russia", "china", "taiwan", "middle east",
            "shipping route", "defense", "foreign policy", "embassy", "diplomatic",
            "missile", "military", "border", "election", "white house", "prime minister",
            "president", "senate", "congress", "supreme court", "cabinet", "campaign",
            "trump", "biden", "starmer", "putin", "zelensky", "netanyahu",
        ),
    ),
    (
        "business-economy",
        (
            "inflation", "interest rate", "fed", "central bank", "jobs report",
            "bond yield", "oil price", "earnings", "recession", "gdp", "consumer spending",
            "housing market", "labor market", "supply chain", "retail sales", "trade deficit",
        ),
    ),
    (
        "sports",
        (
            "premier league", "champions league", "nba", "nfl", "mlb", "nhl",
            "formula 1", "f1", "world cup", "olympics", "tennis", "golf",
            "title race", "playoffs", "grand slam", "transfer window", "uefa",
            "lakers", "arsenal", "liverpool", "manchester united", "real madrid",
            "nfl draft", "march madness", "super bowl",
        ),
    ),
    (
        "culture-entertainment",
        (
            "box office", "streaming", "netflix", "hollywood", "celebrity",
            "album", "film", "movie", "tv series", "music video", "festival",
            "awards", "grammys", "oscars", "playstation", "xbox", "nintendo",
            "grand theft auto", "gta", "fortnite", "call of duty", "minecraft",
            "ign", "variety", "billboard", "taylor swift", "superman", "marvel",
        ),
    ),
    (
        "general-news",
        (
            "breaking news", "top stories", "headline", "court ruling", "wildfire",
            "storm warning", "earthquake", "plane crash", "school shooting",
        ),
    ),
    (
        "ai-machine-learning",
        (
            "ai", "llm", "gpt", "openai", "anthropic", "claude", "gemini",
            "agent", "inference", "neural", "transformer", "diffusion",
            "model", "prompt", "copilot", "chatbot", "deep learning",
            "machine learning", "natural language", "computer vision",
        ),
    ),
    (
        "developer-tools",
        (
            "github", "sdk", "cli", "compiler", "framework", "typescript",
            "python", "devtool", "ide", "debugger", "linter",
            "npm", "cargo", "rust", "golang", "open source",
            "git", "devops", "ci/cd",
        ),
    ),
    (
        "fintech-crypto",
        (
            "payment", "checkout", "fintech", "crypto", "bitcoin",
            "ethereum", "defi", "blockchain", "nft", "trading", "banking",
            "lending", "insurance", "stock", "investment", "wallet",
        ),
    ),
    (
        "health-biotech",
        (
            "health", "biotech", "pharma", "drug", "clinical", "medical",
            "genomic", "diagnostic", "therapy", "vaccine", "crispr",
            "mental health", "telehealth", "wearable",
        ),
    ),
    (
        "energy-climate",
        (
            "battery", "solar", "wind energy", "renewable", "carbon", "climate",
            "electric vehicle", "nuclear", "fusion", "hydrogen",
            "sustainability", "recycling", "energy grid",
        ),
    ),
    (
        "infrastructure-cloud",
        (
            "cloud", "infra", "kubernetes", "server", "hosting", "compute",
            "aws", "azure", "gcp", "docker", "microservice", "serverless",
            "edge computing", "cdn",
        ),
    ),
    (
        "security-privacy",
        (
            "security", "auth", "identity", "vulnerability", "encryption",
            "zero trust", "ransomware", "malware", "firewall",
            "privacy", "compliance", "gdpr",
        ),
    ),
    (
        "data-analytics",
        (
            "data", "database", "analytics", "warehouse", "metadata",
            "etl", "pipeline", "lakehouse", "sql", "nosql", "vector",
            "observability", "monitoring",
        ),
    ),
    (
        "consumer-tech",
        (
            "creator", "social", "video", "content", "stream", "podcast",
            "gaming", "metaverse", "app", "mobile",
            "tiktok", "youtube", "instagram",
        ),
    ),
    (
        "health-fitness",
        (
            "fitness", "workout", "exercise", "gym", "running", "yoga",
            "weight loss", "nutrition", "protein", "supplement", "diet",
            "intermittent fasting", "keto", "meal prep", "calorie",
            "ozempic", "semaglutide", "glp-1", "cold plunge",
            "gut health", "sleep", "wellness",
        ),
    ),
    (
        "beauty-fashion",
        (
            "skincare", "retinol", "sunscreen", "moisturizer", "serum",
            "makeup", "cosmetic", "beauty", "fashion", "streetwear",
            "clothing", "sneaker", "style", "fragrance", "perfume",
        ),
    ),
    (
        "food-beverage",
        (
            "recipe", "cooking", "restaurant", "food", "beverage",
            "coffee", "matcha", "sourdough", "ferment", "plant based",
            "vegan", "organic", "snack", "meal kit",
        ),
    ),
    (
        "home-lifestyle",
        (
            "home improvement", "interior design", "furniture", "decor",
            "gardening", "smart home", "home automation", "diy",
            "real estate", "mortgage", "renovation", "appliance",
        ),
    ),
    (
        "travel-mobility",
        (
            "travel", "hotel", "airline", "tourism", "digital nomad",
            "remote work", "coworking", "backpacking",
            "electric vehicle", "ebike", "scooter", "ride share",
        ),
    ),
    (
        "education-career",
        (
            "online course", "bootcamp", "certification", "tutoring",
            "edtech", "scholarship", "career", "job market",
            "side hustle", "freelance", "passive income", "dropshipping",
        ),
    ),
    (
        "pets-animals",
        (
            "dog", "cat", "pet", "puppy", "kitten", "veterinary",
            "pet food", "pet insurance", "animal",
        ),
    ),
    (
        "enterprise-saas",
        (
            "calendar", "meeting", "workflow", "project", "automation",
            "saas", "crm", "erp", "collaboration", "productivity",
            "no-code", "low-code",
        ),
    ),
    (
        "hardware-robotics",
        (
            "robot", "chip", "drone", "hardware", "semiconductor",
            "sensor", "iot", "3d print", "manufacturing", "lidar",
            "quantum", "processor",
        ),
    ),
    (
        "science-research",
        (
            "wiki", "wikipedia", "reference", "education", "research",
            "academic", "peer review", "arxiv", "paper", "physics",
            "mathematics", "astronomy", "space",
        ),
    ),
)

DEFAULT_CATEGORY = "general-tech"


def _keyword_matches(keyword: str, text: str) -> bool:
    """Check if a keyword matches within text.

    Short keywords (< 4 chars) use word-boundary matching to avoid
    false substring hits like 'ev' matching 'pageviews'.
    """

    if len(keyword) < _WORD_BOUNDARY_THRESHOLD:
        return bool(re.search(r"\b" + re.escape(keyword) + r"\b", text))
    return keyword in text


def categorize_topic(topic: str, source_counts: dict[str, int] | None = None) -> str:
    """Assign a product-facing category to a topic based on keyword matching.

    Matches the topic string against known keyword rules. Falls back to
    source-based heuristics and finally to the default category.
    """

    normalized = topic.lower()
    for category, keywords in CATEGORY_RULES:
        if any(_keyword_matches(keyword, normalized) for keyword in keywords):
            return category

    if source_counts:
        if "github" in source_counts:
            return "developer-tools"
        if "google_news" in source_counts:
            return "general-news"
        if "polymarket" in source_counts:
            return "fintech-crypto"
        if "wikipedia" in source_counts:
            return "science-research"
        if "google_trends" in source_counts:
            return "general-tech"

    return DEFAULT_CATEGORY


def list_categories() -> list[str]:
    """Return all known category slugs in display order."""

    return [category for category, _ in CATEGORY_RULES] + [DEFAULT_CATEGORY]
