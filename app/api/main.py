"""FastAPI application factory for Trend Friend."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import alerts, auth, dashboard, trends, sources, refresh, watchlists


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""

    application = FastAPI(
        title="Trend Friend API",
        description="REST API for the Trend Friend trend intelligence platform.",
        version="1.0.0",
    )

    allowed_origins = os.getenv(
        "TREND_FRIEND_CORS_ORIGINS",
        "http://localhost:3000",
    ).split(",")

    application.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(auth.router, prefix="/api/v1")
    application.include_router(alerts.router, prefix="/api/v1")
    application.include_router(dashboard.router, prefix="/api/v1")
    application.include_router(trends.router, prefix="/api/v1")
    application.include_router(sources.router, prefix="/api/v1")
    application.include_router(refresh.router, prefix="/api/v1")
    application.include_router(watchlists.router, prefix="/api/v1")

    @application.get("/api/v1/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok", "version": "1.0.0"}

    return application


app = create_app()
