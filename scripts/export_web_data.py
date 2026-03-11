"""Export latest and historical trend payloads for the web app."""

from __future__ import annotations

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.exports.web_data import export_web_data_payloads
from app.logging import configure_logging


def main() -> None:
    """Export web-facing JSON payloads from stored trend snapshots."""

    configure_logging()
    settings = load_settings()
    export_web_data_payloads(settings)


if __name__ == "__main__":
    main()
