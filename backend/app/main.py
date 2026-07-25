"""Xfade API — FastAPI application entrypoint.

Run locally:  uvicorn app.main:app --reload  (from backend/)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import combos, compatibility, health, sessions, tracks
from app.config import get_settings

logger = logging.getLogger("xfade")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Touch settings on boot so a missing SUPABASE_* var fails at startup rather
    # than on the first request that needs it.
    settings = get_settings()
    logger.info("xfade api starting (environment=%s)", settings.environment)
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Xfade API",
        description="ML-forward DJ combo & transition logger — v1",
        version=settings.version,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(tracks.router)
    app.include_router(compatibility.router)
    # Registered but with no handlers yet — build spec §7 step 6.
    app.include_router(combos.router)
    app.include_router(sessions.router)

    return app


app = create_app()
