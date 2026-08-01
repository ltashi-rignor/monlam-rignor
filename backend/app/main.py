"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import (
    auth,
    cms,
    dashboard,
    essay,
    games,
    grammar,
    modules,
    planner,
    practice,
    progress,
    recommendations,
    tutor,
)
from app.core.config import get_settings
from app.core.security import get_current_user_id
from app.database.session import Base, engine
from app.models import entities  # noqa: F401 — register models
from app.services.seed import seed_cms_content, seed_content_library

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # Additive columns for Tibetan kid profile (safe on existing DBs)
        for stmt in (
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS school_class VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS likes TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS favorites TEXT",
        ):
            await conn.execute(text(stmt))
    await seed_content_library()
    await seed_cms_content()
    if settings.embedding_preload:
        from app.rag.embeddings import get_embeddings

        get_embeddings().warm_async()
        logger.info(
            "Embedding model warming in background (%s)",
            settings.embedding_model,
        )
    logger.info(
        "%s API ready (llm=melong via %s)",
        settings.app_name,
        settings.monlam_chat_url,
    )
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # All domain routers are JWT-protected at the route level via Depends(get_current_user_id).
    # Auth request/verify endpoints remain public.
    app.include_router(auth.router, prefix="/api")
    app.include_router(cms.router, prefix="/api")
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(planner.router, prefix="/api")
    app.include_router(grammar.router, prefix="/api")
    app.include_router(essay.router, prefix="/api")
    app.include_router(practice.router, prefix="/api")
    app.include_router(progress.router, prefix="/api")
    app.include_router(recommendations.router, prefix="/api")
    app.include_router(modules.router, prefix="/api")
    app.include_router(tutor.router, prefix="/api")
    app.include_router(games.router, prefix="/api")

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "app": settings.app_name}

    @app.get("/api/protected-ping")
    async def protected_ping(_user_id=Depends(get_current_user_id)):
        return {"ok": True, "user_id": str(_user_id)}

    return app


app = create_app()
