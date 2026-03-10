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
    database_path: Path
    web_data_path: Path
    request_timeout_seconds: int
    max_items_per_source: int
    ranking_limit: int
    github_token: Optional[str]
    reddit_user_agent: str


def load_settings() -> Settings:
    """Return immutable application settings."""

    load_dotenv_file(Path(".env"))
    return Settings(
        app_name="Trend Friend",
        database_path=Path(os.getenv("TREND_FRIEND_DATABASE_PATH", "data/trend_friend.db")),
        web_data_path=Path(os.getenv("TREND_FRIEND_WEB_DATA_PATH", "web/data")),
        request_timeout_seconds=int(os.getenv("TREND_FRIEND_REQUEST_TIMEOUT_SECONDS", "10")),
        max_items_per_source=int(os.getenv("TREND_FRIEND_MAX_ITEMS_PER_SOURCE", "30")),
        ranking_limit=int(os.getenv("TREND_FRIEND_RANKING_LIMIT", "25")),
        github_token=os.getenv("GITHUB_TOKEN"),
        reddit_user_agent=os.getenv("TREND_FRIEND_REDDIT_USER_AGENT", "trend-friend-mvp/1.0"),
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
