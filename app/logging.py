"""Logging helpers for the application."""

from __future__ import annotations

import logging


def configure_logging() -> None:
    """Configure a simple process-wide logger."""

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
