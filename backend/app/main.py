"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import Depends, FastAPI, Request
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
    story,
    tutor,
)
from app.core.config import get_settings
from app.core.security import get_current_user_id
from app.database.session import engine
from app.models import entities  # noqa: F401 — register models
from app.services.seed import seed_cms_content, seed_content_library

# Uvicorn configures logging first; force=True so our handlers still attach.
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:     %(name)s — %(message)s",
    force=True,
)
logger = logging.getLogger("app.main")
# Same stream uvicorn uses for "Application startup complete"
uv_logger = logging.getLogger("uvicorn.error")


def _boot(msg: str) -> None:
    """Always visible in the uvicorn terminal."""
    uv_logger.info(msg)
    logger.info(msg)


def _run_migrations() -> None:
    # Prevent alembic.ini fileConfig from clobbering uvicorn logging (can hang --reload).
    os.environ["ALEMBIC_SKIP_LOG_CONFIG"] = "1"
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    t0 = time.perf_counter()
    _boot(f"Starting {settings.app_name} (env={settings.app_env})")

    if settings.jwt_is_weak:
        _boot(
            "WARNING: JWT_SECRET is weak or default — set a ≥32-char secret before deployment"
        )

    _boot("Running database migrations…")
    try:
        _run_migrations()
    except Exception:
        logger.exception("Alembic migration failed")
        raise
    _boot(f"Migrations OK ({time.perf_counter() - t0:.1f}s)")

    _boot("Seeding content library…")
    await seed_content_library()
    _boot("Seeding CMS…")
    await seed_cms_content()
    _boot("Seed OK")

    if settings.embedding_preload:
        from app.rag.embeddings import get_embeddings

        get_embeddings().warm_async()
        _boot(
            f"Embedding model warming in background ({settings.embedding_model})"
        )

    _boot(
        f"Ready — Melong chat {settings.monlam_chat_url} "
        f"| OCR {settings.monlam_ocr_single_url} "
        f"| took {time.perf_counter() - t0:.1f}s"
    )
    yield
    _boot("Shutting down — disposing DB engine")
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    docs_url = "/docs" if settings.docs_enabled else None
    redoc_url = "/redoc" if settings.docs_enabled else None
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )

    origins = settings.cors_origin_list
    if "*" in origins and settings.is_production:
        raise RuntimeError("Refusing to start with CORS * in production")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        # Skip noisy health probes in access-style logs? Keep them — user wants visibility.
        started = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - started) * 1000
        path = request.url.path
        # Don't log static noise; still log API.
        if path.startswith("/api"):
            uv_logger.info(
                "%s %s → %s (%.0fms)",
                request.method,
                path,
                response.status_code,
                ms,
            )
        return response

    app.include_router(auth.router, prefix="/api")
    app.include_router(cms.router, prefix="/api")
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(planner.router, prefix="/api")
    app.include_router(grammar.router, prefix="/api")
    app.include_router(essay.router, prefix="/api")
    app.include_router(story.router, prefix="/api")
    app.include_router(practice.router, prefix="/api")
    app.include_router(progress.router, prefix="/api")
    app.include_router(recommendations.router, prefix="/api")
    app.include_router(modules.router, prefix="/api")
    app.include_router(tutor.router, prefix="/api")
    app.include_router(games.router, prefix="/api")

    @app.get("/api/health")
    @app.get("/api/health/live")
    async def health_live():
        return {"status": "ok", "app": settings.app_name}

    @app.get("/api/health/ready")
    async def health_ready():
        checks: dict[str, str] = {}
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as exc:
            logger.exception("Readiness DB check failed")
            checks["database"] = f"error:{type(exc).__name__}"
            return {
                "status": "not_ready",
                "app": settings.app_name,
                "checks": checks,
            }

        from app.services.llm import melong_is_rate_limited

        key = (settings.monlam_api_key or "").strip()
        if not key or key.startswith("YOUR_"):
            checks["melong"] = "not_configured"
        elif melong_is_rate_limited():
            checks["melong"] = "rate_limited"
        else:
            checks["melong"] = "configured"

        return {
            "status": "ready",
            "app": settings.app_name,
            "checks": checks,
            "env": settings.app_env if not settings.is_production else "production",
        }

    @app.get("/api/protected-ping")
    async def protected_ping(_user_id=Depends(get_current_user_id)):
        return {"ok": True, "user_id": str(_user_id)}

    return app


app = create_app()
