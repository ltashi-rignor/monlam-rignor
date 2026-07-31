"""Progress API — learner skill graph and longitudinal scores."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.progress_agent import run_progress_update
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Essay, Mistake, PracticeHistory, Progress
from app.models.schemas import ProgressOut

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressOut)
async def get_progress(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    if not progress:
        progress = Progress(user_id=user_id, learning_graph={})
        db.add(progress)
        await db.flush()
    return progress


@router.post("/refresh", response_model=ProgressOut)
async def refresh_progress(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    previous = {
        "grammar_score": progress.grammar_score if progress else 0,
        "writing_score": progress.writing_score if progress else 0,
        "reading_score": progress.reading_score if progress else 0,
        "speaking_score": progress.speaking_score if progress else 0,
        "vocabulary_score": progress.vocabulary_score if progress else 0,
        "learning_graph": progress.learning_graph if progress else {},
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
            .limit(5)
        )
    ).scalars().all()

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
    }
    updated = await run_progress_update(activity, previous)
    if progress is None:
        progress = Progress(user_id=user_id)
        db.add(progress)
    progress.grammar_score = float(updated.get("grammar_score") or 0)
    progress.writing_score = float(updated.get("writing_score") or 0)
    progress.reading_score = float(updated.get("reading_score") or 0)
    progress.speaking_score = float(updated.get("speaking_score") or 0)
    progress.vocabulary_score = float(updated.get("vocabulary_score") or 0)
    progress.learning_graph = updated.get("learning_graph") or {}
    await db.flush()
    await db.refresh(progress)
    return progress
