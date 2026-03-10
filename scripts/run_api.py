"""Start the Trend Friend REST API server."""

from __future__ import annotations

import os

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.logging import configure_logging


def main() -> None:
    """Launch the API server with uvicorn."""

    import uvicorn

    configure_logging()
    host = os.getenv("TREND_FRIEND_API_HOST", "0.0.0.0")
    port = int(os.getenv("TREND_FRIEND_API_PORT", "8000"))
    reload = os.getenv("TREND_FRIEND_API_RELOAD", "true").lower() == "true"

    uvicorn.run(
        "app.api.main:app",
        host=host,
        port=port,
        reload=reload,
    )


if __name__ == "__main__":
    main()
