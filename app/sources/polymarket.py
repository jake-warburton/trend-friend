"""Polymarket source adapter."""

from __future__ import annotations

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

GAMMA_EVENTS_URL = (
    "https://gamma-api.polymarket.com/events"
    "?active=true&closed=false&order=volume24hr&ascending=false"
)
BLOCKED_TITLE_MARKERS = (
    "election",
    "nominee",
    "president",
    "presidential",
    "senate",
    "governor",
    "mayor",
    "prime minister",
    "republican",
    "democratic",
    "fifa",
    "uefa",
    "champions league",
    "premier league",
    "masters",
    "tournament",
    "game ",
    " game",
    "winner",
    " vs ",
    "dota",
    "eurovision",
    "f1",
    "drivers' champion",
    "world cup",
    "nba",
    "nfl",
    "mlb",
    "nhl",
    "iran",
    "israel",
    "hormuz",
    "war",
    "strike",
    "missile",
    "ceasefire",
)


class PolymarketSourceAdapter(SourceAdapter):
    """Fetch active high-volume prediction markets and normalize them."""

    source_name = "polymarket"

    def fetch(self) -> list[RawSourceItem]:
        try:
            headers = {
                "Accept": "application/json",
                "User-Agent": self.settings.reddit_user_agent,
            }
            payload = self.get_json(
                f"{GAMMA_EVENTS_URL}&limit={self.settings.max_items_per_source}",
                headers=headers,
            )
            items = self.normalize_items(payload, limit=self.settings.max_items_per_source)
            self.raw_item_count = len(payload) if isinstance(payload, list) else 0
            self.kept_item_count = len(items)
            return items
        except Exception as error:
            self.log_fallback(error)
            payload = self.sample_payload()
            items = self.normalize_items(payload, limit=self.settings.max_items_per_source)
            self.raw_item_count = len(payload)
            self.kept_item_count = len(items)
            return items

    def normalize_items(self, payload: list[dict[str, object]], limit: int | None = None) -> list[RawSourceItem]:
        """Normalize Gamma event markets into shared models."""

        max_items = self.settings.max_items_per_source if limit is None else limit
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        for event in payload:
            event_title = str(event.get("title", "")).strip()
            event_slug = str(event.get("slug", "")).strip()
            markets = event.get("markets") or []
            if not isinstance(markets, list):
                continue
            best_item: RawSourceItem | None = None
            for market in markets:
                if not isinstance(market, dict):
                    continue
                market_id = str(market.get("id", "")).strip()
                question = str(market.get("question", "")).strip()
                end_date = str(
                    market.get("endDate")
                    or market.get("end_date_iso")
                    or event.get("endDate")
                    or event.get("createdAt")
                    or ""
                ).strip()
                if not market_id or not question or not end_date or market_id in seen_ids:
                    continue
                if not self._is_supported_market_title(question, event_title):
                    continue
                url = self._build_market_url(event_slug, str(market.get("slug", "")).strip())
                volume_24hr = _to_float(market.get("volume24hr"))
                liquidity = _to_float(market.get("liquidity"))
                title = question if question.endswith("?") else f"{question}?"
                if event_title and event_title.lower() not in title.lower():
                    title = f"{title} {event_title}"
                candidate = RawSourceItem(
                    source=self.source_name,
                    external_id=market_id,
                    title=title,
                    url=url,
                    timestamp=self.parse_iso_timestamp(end_date),
                    engagement_score=volume_24hr + (liquidity * 0.1),
                    metadata={
                        "event_title": event_title,
                        "category": str(event.get("category", "")).strip(),
                        "market_slug": str(market.get("slug", "")).strip(),
                    },
                )
                if best_item is None or candidate.engagement_score > best_item.engagement_score:
                    best_item = candidate
            if best_item is not None:
                seen_ids.add(best_item.external_id)
                items.append(best_item)
                if len(items) >= max_items:
                    return items
        return items

    @staticmethod
    def _build_market_url(event_slug: str, market_slug: str) -> str:
        """Build a stable Polymarket URL for a market."""

        slug = market_slug or event_slug
        return f"https://polymarket.com/event/{slug}" if slug else "https://polymarket.com"

    @staticmethod
    def _is_supported_market_title(question: str, event_title: str) -> bool:
        """Keep business/tech/crypto-style markets, excluding obvious politics and sports."""

        normalized = f"{question} {event_title}".lower()
        return not any(marker in normalized for marker in BLOCKED_TITLE_MARKERS)

    @staticmethod
    def sample_payload() -> list[dict[str, object]]:
        """Return deterministic fallback market data."""

        return [
            {
                "title": "Will OpenAI release GPT-5 by June 2026?",
                "slug": "openai-release-gpt-5-by-june-2026",
                "category": "technology",
                "createdAt": "2026-03-12T08:00:00Z",
                "markets": [
                    {
                        "id": "pm-1001",
                        "question": "Will OpenAI release GPT-5 by June 2026?",
                        "slug": "will-openai-release-gpt-5-by-june-2026",
                        "volume24hr": 420000,
                        "liquidity": 180000,
                        "endDate": "2026-06-30T23:59:59Z",
                    }
                ],
            },
            {
                "title": "Will the SEC approve a Solana ETF in 2026?",
                "slug": "sec-approve-solana-etf-2026",
                "category": "crypto",
                "createdAt": "2026-03-12T08:30:00Z",
                "markets": [
                    {
                        "id": "pm-1002",
                        "question": "Will the SEC approve a Solana ETF in 2026?",
                        "slug": "will-the-sec-approve-a-solana-etf-in-2026",
                        "volume24hr": 260000,
                        "liquidity": 95000,
                        "endDate": "2026-12-31T23:59:59Z",
                    }
                ],
            },
        ]


def _to_float(value: object) -> float:
    """Convert numeric-looking API values to float safely."""

    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0
