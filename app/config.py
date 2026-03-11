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
    web_data_path: Path
    request_timeout_seconds: int
    max_items_per_source: int
    reddit_page_limit: int
    hacker_news_page_limit: int
    github_page_limit: int
    ranking_limit: int
    history_run_limit: int
    github_token: Optional[str]
    twitter_bearer_token: Optional[str]
    reddit_user_agent: str
    poll_interval_minutes: int
    health_file_path: Path
    refresh_secret: Optional[str]


def load_settings() -> Settings:
    """Return immutable application settings."""

    load_dotenv_file(Path(".env"))
    return Settings(
        app_name="Signal Eye",
        database_url=os.getenv("SIGNAL_EYE_DATABASE_URL"),
        database_path=Path(os.getenv("SIGNAL_EYE_DATABASE_PATH", "data/signal_eye.db")),
        web_data_path=Path(os.getenv("SIGNAL_EYE_WEB_DATA_PATH", "web/data")),
        request_timeout_seconds=int(os.getenv("SIGNAL_EYE_REQUEST_TIMEOUT_SECONDS", "10")),
        max_items_per_source=int(os.getenv("SIGNAL_EYE_MAX_ITEMS_PER_SOURCE", "30")),
        reddit_page_limit=int(os.getenv("SIGNAL_EYE_REDDIT_PAGE_LIMIT", "3")),
        hacker_news_page_limit=int(os.getenv("SIGNAL_EYE_HACKER_NEWS_PAGE_LIMIT", "3")),
        github_page_limit=int(os.getenv("SIGNAL_EYE_GITHUB_PAGE_LIMIT", "2")),
        ranking_limit=int(os.getenv("SIGNAL_EYE_RANKING_LIMIT", "100")),
        history_run_limit=int(os.getenv("SIGNAL_EYE_HISTORY_RUN_LIMIT", "72")),
        github_token=os.getenv("GITHUB_TOKEN"),
        twitter_bearer_token=os.getenv("TWITTER_BEARER_TOKEN"),
        reddit_user_agent=os.getenv("SIGNAL_EYE_REDDIT_USER_AGENT", "signal-eye-mvp/1.0"),
        poll_interval_minutes=int(os.getenv("SIGNAL_EYE_POLL_INTERVAL_MINUTES", "30")),
        health_file_path=Path(os.getenv("SIGNAL_EYE_HEALTH_FILE_PATH", "data/last_run.json")),
        refresh_secret=os.getenv("SIGNAL_EYE_REFRESH_SECRET"),
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
