"""CoinGecko source adapter."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TrendFriend/1.0)"}

_TRENDING_URL = "https://api.coingecko.com/api/v3/search/trending"
_MARKETS_URL = (
    "https://api.coingecko.com/api/v3/coins/markets"
    "?vs_currency=usd&order=market_cap_desc&per_page=20&page=1"
    "&sparkline=false&price_change_percentage=24h"
)


class CoinGeckoSourceAdapter(SourceAdapter):
    """Fetch trending coins and top market movers from CoinGecko."""

    source_name = "coingecko"

    def fetch(self) -> list[RawSourceItem]:
        try:
            items: list[RawSourceItem] = []
            seen_ids: set[str] = set()

            trending_items = self._fetch_trending()
            market_items = self._fetch_markets()

            self.raw_item_count = len(trending_items) + len(market_items)

            for item in trending_items + market_items:
                if item.external_id in seen_ids:
                    continue
                seen_ids.add(item.external_id)
                items.append(item)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    break

            return items
        except Exception as error:
            self.log_fallback(error)
            return [
                item
                for item in (self._normalize_market(data) for data in self.sample_payload())
                if item
            ]

    def _fetch_trending(self) -> list[RawSourceItem]:
        """Fetch trending coins, NFTs, and categories."""

        data = self.get_json(_TRENDING_URL, headers=_HEADERS)
        items: list[RawSourceItem] = []

        for position, entry in enumerate(data.get("coins", [])):
            coin = entry.get("item", {})
            name = str(coin.get("name", "")).strip()
            coin_id = str(coin.get("id", "")).strip()
            if not name or not coin_id:
                continue

            price_data = coin.get("data", {})
            pct_change = 0.0
            pct_obj = price_data.get("price_change_percentage_24h")
            if isinstance(pct_obj, dict):
                pct_change = float(pct_obj.get("usd", 0))

            engagement = (10 - position) * 100

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"trending-{coin_id}",
                    title=f"{name} ({str(coin.get('symbol', '')).upper()}) trending on CoinGecko",
                    url=f"https://www.coingecko.com/en/coins/{coin_id}",
                    timestamp=datetime.now(tz=timezone.utc),
                    engagement_score=float(max(engagement, 0)),
                    metadata={
                        "symbol": str(coin.get("symbol", "")).upper(),
                        "market_cap_rank": int(coin.get("market_cap_rank") or 0),
                        "price_change_24h": pct_change,
                        "type": "trending_coin",
                    },
                )
            )

        for position, nft in enumerate(data.get("nfts", [])):
            nft_name = str(nft.get("name", "")).strip()
            nft_id = str(nft.get("id", "")).strip()
            if not nft_name or not nft_id:
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"trending-nft-{nft_id}",
                    title=f"{nft_name} NFT trending on CoinGecko",
                    url=f"https://www.coingecko.com/en/nft/{nft_id}",
                    timestamp=datetime.now(tz=timezone.utc),
                    engagement_score=float(max((10 - position) * 100, 0)),
                    metadata={"type": "trending_nft"},
                )
            )

        for position, cat in enumerate(data.get("categories", [])):
            cat_name = str(cat.get("name", "")).strip()
            cat_id = str(cat.get("id", "")).strip() or cat_name.lower().replace(" ", "-")
            if not cat_name:
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"trending-cat-{cat_id}",
                    title=f"{cat_name} category trending on CoinGecko",
                    url=f"https://www.coingecko.com/en/categories/{cat_id}",
                    timestamp=datetime.now(tz=timezone.utc),
                    engagement_score=float(max((10 - position) * 100, 0)),
                    metadata={"type": "trending_category"},
                )
            )

        return items

    def _fetch_markets(self) -> list[RawSourceItem]:
        """Fetch top coins by market cap."""

        data = self.get_json(_MARKETS_URL, headers=_HEADERS)
        items: list[RawSourceItem] = []
        for coin in data:
            normalized = self._normalize_market(coin)
            if normalized is not None:
                items.append(normalized)
        return items

    def _normalize_market(self, coin: dict[str, object]) -> Optional[RawSourceItem]:
        """Normalize a single market-data coin entry."""

        name = str(coin.get("name", "")).strip()
        coin_id = str(coin.get("id", "")).strip()
        if not name or not coin_id:
            return None

        pct_change = float(coin.get("price_change_percentage_24h") or 0)
        rank = int(coin.get("market_cap_rank") or 0)
        rank_inverse = max(0, 21 - rank) if rank > 0 else 0
        engagement = abs(pct_change) * 50 + rank_inverse

        return RawSourceItem(
            source=self.source_name,
            external_id=f"market-{coin_id}",
            title=f"{name} ({str(coin.get('symbol', '')).upper()}) — ${coin.get('current_price', 0):,.2f}",
            url=f"https://www.coingecko.com/en/coins/{coin_id}",
            timestamp=datetime.now(tz=timezone.utc),
            engagement_score=float(max(engagement, 0)),
            metadata={
                "symbol": str(coin.get("symbol", "")).upper(),
                "market_cap_rank": rank,
                "price_change_24h": pct_change,
                "market_cap": float(coin.get("market_cap") or 0),
                "total_volume": float(coin.get("total_volume") or 0),
                "current_price": float(coin.get("current_price") or 0),
                "type": "market_mover",
            },
        )

    @staticmethod
    def sample_payload() -> list[dict[str, object]]:
        """Return deterministic fallback items."""

        return [
            {
                "id": "bitcoin",
                "symbol": "btc",
                "name": "Bitcoin",
                "current_price": 62000,
                "market_cap": 1200000000000,
                "total_volume": 30000000000,
                "price_change_percentage_24h": 2.5,
                "market_cap_rank": 1,
            },
            {
                "id": "ethereum",
                "symbol": "eth",
                "name": "Ethereum",
                "current_price": 3400,
                "market_cap": 410000000000,
                "total_volume": 15000000000,
                "price_change_percentage_24h": -1.8,
                "market_cap_rank": 2,
            },
        ]
