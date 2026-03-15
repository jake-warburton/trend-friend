"""Curated list of high-signal Twitter accounts for breaking news."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TwitterAccount:
    """A curated Twitter account to scrape."""

    handle: str
    tier: str  # "high" or "medium"
    verticals: tuple[str, ...]


TWITTER_ACCOUNTS: tuple[TwitterAccount, ...] = (
    # --- World leaders & political figures ---
    TwitterAccount("POTUS", "high", ("politics", "world")),
    TwitterAccount("VP", "high", ("politics", "world")),
    TwitterAccount("10DowningStreet", "high", ("politics", "world")),
    TwitterAccount("ZelenskyyUa", "high", ("politics", "world")),
    TwitterAccount("EmmanuelMacron", "medium", ("politics", "world")),
    TwitterAccount("KremlinRussia_E", "medium", ("politics", "world")),
    # --- Tech & business leaders ---
    TwitterAccount("elonmusk", "high", ("tech", "politics", "business")),
    TwitterAccount("JeffBezos", "medium", ("tech", "business")),
    TwitterAccount("sataborya", "medium", ("tech", "business")),
    TwitterAccount("sama", "high", ("tech", "ai")),
    TwitterAccount("BillGates", "medium", ("tech", "business", "health")),
    TwitterAccount("tim_cook", "medium", ("tech", "business")),
    # --- Major news outlets ---
    TwitterAccount("BBCBreaking", "high", ("news", "politics", "world")),
    TwitterAccount("BBCWorld", "high", ("news", "world")),
    TwitterAccount("SkyNews", "high", ("news", "politics", "world")),
    TwitterAccount("CNN", "high", ("news", "politics", "world")),
    TwitterAccount("Reuters", "high", ("news", "world", "business")),
    TwitterAccount("AP", "high", ("news", "world")),
    TwitterAccount("FoxNews", "medium", ("news", "politics")),
    TwitterAccount("ABC", "medium", ("news", "world")),
    TwitterAccount("guardiannews", "medium", ("news", "politics", "world")),
    TwitterAccount("WSJ", "high", ("news", "business", "markets")),
    TwitterAccount("FT", "high", ("news", "business", "markets")),
    TwitterAccount("Bloomberg", "medium", ("news", "business", "markets")),
    TwitterAccount("CNBC", "medium", ("news", "business", "markets")),
    # --- Tech news ---
    TwitterAccount("verge", "medium", ("tech", "consumer-tech")),
    TwitterAccount("TechCrunch", "medium", ("tech", "startup")),
    TwitterAccount("WIRED", "medium", ("tech",)),
    # --- Markets & prediction ---
    TwitterAccount("Polymarket", "medium", ("politics", "markets")),
    TwitterAccount("coinaborsk", "medium", ("markets", "crypto")),
    # --- Science & health ---
    TwitterAccount("WHO", "medium", ("health", "world")),
    TwitterAccount("NASA", "medium", ("science", "tech")),
    # --- Sports ---
    TwitterAccount("ESPN", "medium", ("sports",)),
    TwitterAccount("SkySportsNews", "medium", ("sports",)),
    # --- AI-specific voices ---
    TwitterAccount("AndrewYNg", "medium", ("ai", "tech")),
    TwitterAccount("ylecun", "medium", ("ai", "tech")),
    TwitterAccount("karpathy", "medium", ("ai", "tech")),
    TwitterAccount("demaboris", "medium", ("ai", "tech")),
    TwitterAccount("GoogleDeepMind", "medium", ("ai", "research")),
    TwitterAccount("OpenAI", "high", ("ai", "tech")),
    TwitterAccount("AnthropicAI", "medium", ("ai", "tech")),
    TwitterAccount("xaboris", "medium", ("ai", "tech")),
)

# NOTE: Some placeholder handles above (containing "boris" or "abor") need
# to be replaced with real Twitter handles before deployment. The user should
# curate the final list of ~50 accounts.
