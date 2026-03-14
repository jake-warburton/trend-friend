"""Application configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class Settings:
    """Centralized runtime settings."""

    app_name: str
    database_url: Optional[str]
    database_path: Path
    enable_postgres_runtime: bool
    web_data_path: Path
    request_timeout_seconds: int
    request_retry_count: int
    source_cache_ttl_seconds: int
    max_items_per_source: int
    reddit_page_limit: int
    hacker_news_page_limit: int
    github_page_limit: int
    enable_experimental_sources: bool
    enable_twitter_source: bool
    ranking_limit: int
    experimental_ranking_limit: int
    history_run_limit: int
    market_enrichment_enabled: bool
    market_enrichment_limit: int
    github_token: Optional[str]
    twitter_bearer_token: Optional[str]
    youtube_api_key: Optional[str]
    google_search_metrics_url: Optional[str]
    google_search_metrics_token: Optional[str]
    tiktok_metrics_url: Optional[str]
    tiktok_metrics_token: Optional[str]
    youtube_search_days: int
    reddit_user_agent: str
    poll_interval_minutes: int
    health_file_path: Path
    refresh_secret: Optional[str]
    serpapi_key: str


def load_settings() -> Settings:
    """Return immutable application settings."""

    load_dotenv_file(Path(".env"))
    return Settings(
        app_name="Signal Eye",
        database_url=os.getenv("SIGNAL_EYE_DATABASE_URL"),
        database_path=Path(os.getenv("SIGNAL_EYE_DATABASE_PATH", "data/signal_eye.db")),
        enable_postgres_runtime=os.getenv("SIGNAL_EYE_ENABLE_POSTGRES_RUNTIME", "false").lower() == "true",
        web_data_path=Path(os.getenv("SIGNAL_EYE_WEB_DATA_PATH", "web/data")),
        request_timeout_seconds=int(os.getenv("SIGNAL_EYE_REQUEST_TIMEOUT_SECONDS", "10")),
        request_retry_count=int(os.getenv("SIGNAL_EYE_REQUEST_RETRY_COUNT", "2")),
        source_cache_ttl_seconds=int(os.getenv("SIGNAL_EYE_SOURCE_CACHE_TTL_SECONDS", "600")),
        max_items_per_source=int(os.getenv("SIGNAL_EYE_MAX_ITEMS_PER_SOURCE", "45")),
        reddit_page_limit=int(os.getenv("SIGNAL_EYE_REDDIT_PAGE_LIMIT", "4")),
        hacker_news_page_limit=int(os.getenv("SIGNAL_EYE_HACKER_NEWS_PAGE_LIMIT", "3")),
        github_page_limit=int(os.getenv("SIGNAL_EYE_GITHUB_PAGE_LIMIT", "3")),
        enable_experimental_sources=os.getenv("SIGNAL_EYE_ENABLE_EXPERIMENTAL_SOURCES", "true").lower() == "true",
        enable_twitter_source=os.getenv("SIGNAL_EYE_ENABLE_TWITTER_SOURCE", "false").lower() == "true",
        ranking_limit=int(os.getenv("SIGNAL_EYE_RANKING_LIMIT", "200")),
        experimental_ranking_limit=int(os.getenv("SIGNAL_EYE_EXPERIMENTAL_RANKING_LIMIT", "12")),
        history_run_limit=int(os.getenv("SIGNAL_EYE_HISTORY_RUN_LIMIT", "72")),
        market_enrichment_enabled=os.getenv("SIGNAL_EYE_MARKET_ENRICHMENT_ENABLED", "true").lower() == "true",
        market_enrichment_limit=int(os.getenv("SIGNAL_EYE_MARKET_ENRICHMENT_LIMIT", "50")),
        github_token=os.getenv("GITHUB_TOKEN"),
        twitter_bearer_token=os.getenv("TWITTER_BEARER_TOKEN"),
        youtube_api_key=os.getenv("YOUTUBE_API_KEY"),
        google_search_metrics_url=os.getenv("SIGNAL_EYE_GOOGLE_SEARCH_METRICS_URL"),
        google_search_metrics_token=os.getenv("SIGNAL_EYE_GOOGLE_SEARCH_METRICS_TOKEN"),
        tiktok_metrics_url=os.getenv("SIGNAL_EYE_TIKTOK_METRICS_URL"),
        tiktok_metrics_token=os.getenv("SIGNAL_EYE_TIKTOK_METRICS_TOKEN"),
        youtube_search_days=int(os.getenv("SIGNAL_EYE_YOUTUBE_SEARCH_DAYS", "30")),
        reddit_user_agent=os.getenv("SIGNAL_EYE_REDDIT_USER_AGENT", "signal-eye-mvp/1.0"),
        poll_interval_minutes=int(os.getenv("SIGNAL_EYE_POLL_INTERVAL_MINUTES", "30")),
        health_file_path=Path(os.getenv("SIGNAL_EYE_HEALTH_FILE_PATH", "data/last_run.json")),
        refresh_secret=os.getenv("SIGNAL_EYE_REFRESH_SECRET"),
        serpapi_key=os.environ.get("SERPAPI_KEY", ""),
    )


def load_dotenv_file(path: Path) -> None:
    """Populate unset environment variables from a simple .env file."""

    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped_line = line.strip()
        if not stripped_line or stripped_line.startswith("#") or "=" not in stripped_line:
            continue
        key, value = stripped_line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())
