"""Progress API — learner skill graph and longitudinal scores."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.agents.progress_agent import run_progress_update
from app.core.learner_profile import profile_for_agents
from app.core.rate_limit import rate_limit_llm
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Essay, Mistake, PracticeHistory, Progress, User
from app.models.schemas import ProgressOut
from app.services.progress_sync import (
    merge_practice_stats_into_graph,
    practice_stats_from_rows,
    sync_progress_from_activity,
)

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressOut)
async def get_progress(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    progress = await sync_progress_from_activity(db, user_id, progress)
    return progress


@router.post("/refresh", response_model=ProgressOut)
async def refresh_progress(
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_llm(request, str(user_id))
    user = await db.get(User, user_id)
    profile = profile_for_agents(user) if user else {}
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    # Sync practice/module activity first so Melong sees real numbers.
    progress = await sync_progress_from_activity(db, user_id, progress)

    previous = {
        "grammar_score": progress.grammar_score,
        "writing_score": progress.writing_score,
        "reading_score": progress.reading_score,
        "speaking_score": progress.speaking_score,
        "vocabulary_score": progress.vocabulary_score,
        "learning_graph": progress.learning_graph or {},
    }

    essays = (
        await db.execute(
            select(Essay)
            .where(Essay.user_id == user_id)
            .order_by(Essay.created_at.desc())
            .limit(5)
        )
    ).scalars().all()
    mistakes = (
        await db.execute(
            select(Mistake)
            .where(Mistake.user_id == user_id)
            .order_by(Mistake.created_at.desc())
            .limit(20)
        )
    ).scalars().all()
    practices = (
        await db.execute(
            select(PracticeHistory)
            .where(PracticeHistory.user_id == user_id)
            .order_by(PracticeHistory.created_at.desc())
            .limit(10)
        )
    ).scalars().all()

    practice_stats = practice_stats_from_rows(list(practices))
    activity_meta = (progress.learning_graph or {}).get("activity") or {}

    activity = {
        "recent_essays": [
            {
                "overall_score": e.overall_score,
                "grammar_score": e.grammar_score,
                "vocabulary_score": e.vocabulary_score,
            }
            for e in essays
        ],
        "recent_mistakes": [
            {"type": m.mistake_type, "original": m.original} for m in mistakes
        ],
        "recent_practice": [
            {"completed": p.completed, "score": p.score} for p in practices
        ],
        "practice_stats": practice_stats,
        "modules": activity_meta,
    }
    updated = await run_progress_update(activity, previous, profile)

    progress.grammar_score = float(updated.get("grammar_score") or progress.grammar_score or 0)
    progress.writing_score = float(updated.get("writing_score") or progress.writing_score or 0)
    progress.reading_score = float(updated.get("reading_score") or progress.reading_score or 0)
    progress.speaking_score = float(updated.get("speaking_score") or progress.speaking_score or 0)
    progress.vocabulary_score = float(
        updated.get("vocabulary_score") or progress.vocabulary_score or 0
    )
    # Never let Melong wipe practice tracking fields.
    progress.learning_graph = merge_practice_stats_into_graph(
        updated.get("learning_graph") or {},
        practice_stats,
        activity_meta,
    )
    flag_modified(progress, "learning_graph")
    await db.flush()
    await db.refresh(progress)
    return progress
