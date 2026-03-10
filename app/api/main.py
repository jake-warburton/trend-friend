"""FastAPI application factory for Trend Friend."""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.rate_limit import rate_limiter, response_cache
from app.api.routers import alerts, auth, community, dashboard, exports, predictions, trends, sources, refresh, watchlists

# Cacheable GET endpoints with their TTL in seconds
_CACHE_ROUTES: dict[str, float] = {
    "/api/v1/trends": 30.0,
    "/api/v1/trends/latest": 30.0,
    "/api/v1/trends/history": 60.0,
    "/api/v1/dashboard/overview": 30.0,
    "/api/v1/sources": 30.0,
}


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

    rate_limit_enabled = os.getenv("TREND_FRIEND_RATE_LIMIT", "true").lower() == "true"

    @application.middleware("http")
    async def rate_limit_and_cache_middleware(request: Request, call_next):
        # Rate limiting
        if rate_limit_enabled:
            client_ip = request.client.host if request.client else "unknown"
            allowed, remaining = rate_limiter.check(client_ip)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests"},
                    headers={"Retry-After": "60", "X-RateLimit-Remaining": "0"},
                )

        # Response caching for GET requests
        if request.method == "GET":
            cache_ttl = _CACHE_ROUTES.get(request.url.path)
            if cache_ttl is not None:
                cached = response_cache.get(request.url.path)
                if cached is not None:
                    response = JSONResponse(content=cached)
                    response.headers["X-Cache"] = "HIT"
                    if rate_limit_enabled:
                        response.headers["X-RateLimit-Remaining"] = str(remaining)
                    return response

        response = await call_next(request)

        # Cache successful GET responses
        if request.method == "GET" and response.status_code == 200:
            cache_ttl = _CACHE_ROUTES.get(request.url.path)
            if cache_ttl is not None:
                body = b""
                async for chunk in response.body_iterator:
                    body += chunk if isinstance(chunk, bytes) else chunk.encode()
                import json
                try:
                    data = json.loads(body)
                    response_cache.set(request.url.path, data, ttl=cache_ttl)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass
                response = JSONResponse(content=json.loads(body), status_code=200)
                response.headers["X-Cache"] = "MISS"

        # Invalidate caches on write operations
        if request.method == "POST" and request.url.path == "/api/v1/refresh":
            response_cache.clear()

        if rate_limit_enabled and hasattr(request, "client") and request.client:
            response.headers["X-RateLimit-Remaining"] = str(remaining)

        return response

    application.include_router(auth.router, prefix="/api/v1")
    application.include_router(alerts.router, prefix="/api/v1")
    application.include_router(dashboard.router, prefix="/api/v1")
    application.include_router(predictions.router, prefix="/api/v1")
    application.include_router(trends.router, prefix="/api/v1")
    application.include_router(sources.router, prefix="/api/v1")
    application.include_router(refresh.router, prefix="/api/v1")
    application.include_router(watchlists.router, prefix="/api/v1")
    application.include_router(community.router, prefix="/api/v1")
    application.include_router(exports.router, prefix="/api/v1")

    @application.get("/api/v1/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok", "version": "1.0.0"}

    return application


app = create_app()
