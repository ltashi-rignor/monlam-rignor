"""Practice API — adaptive daily exercises from recent mistakes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.practice_agent import run_practice
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Mistake, PracticeHistory, Progress
from app.models.schemas import PracticeGenerateRequest, PracticeOut, PracticeSubmitRequest

router = APIRouter(prefix="/practice", tags=["practice"])


@router.post("/generate", response_model=PracticeOut)
async def generate_practice(
    body: PracticeGenerateRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    mistakes_result = await db.execute(
        select(Mistake)
        .where(Mistake.user_id == user_id)
        .order_by(Mistake.created_at.desc())
        .limit(20)
    )
    mistakes = [
        {
            "mistake_type": m.mistake_type,
            "original": m.original,
            "correction": m.correction,
            "explanation": m.explanation,
            "related_rule": m.related_rule,
        }
        for m in mistakes_result.scalars().all()
    ]
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    progress_data = {
        "grammar_score": progress.grammar_score if progress else 0,
        "writing_score": progress.writing_score if progress else 0,
        "reading_score": progress.reading_score if progress else 0,
        "speaking_score": progress.speaking_score if progress else 0,
        "vocabulary_score": progress.vocabulary_score if progress else 0,
        "learning_graph": progress.learning_graph if progress else {},
    }
    exercises = await run_practice(mistakes, progress_data, body.focus)
    record = PracticeHistory(
        user_id=user_id,
        exercises_json=exercises,
        based_on_mistakes=mistakes[:10],
        completed=False,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.post("/submit", response_model=PracticeOut)
async def submit_practice(
    body: PracticeSubmitRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    record = await db.get(PracticeHistory, body.practice_id)
    if not record or record.user_id != user_id:
        raise HTTPException(status_code=404, detail="Practice session not found")
    record.completed = True
    record.score = body.score
    exercises = dict(record.exercises_json or {})
    exercises["submitted_answers"] = body.answers
    record.exercises_json = exercises
    await db.flush()
    await db.refresh(record)
    return record


@router.get("/history", response_model=list[PracticeOut])
async def practice_history(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeHistory)
        .where(PracticeHistory.user_id == user_id)
        .order_by(PracticeHistory.created_at.desc())
        .limit(30)
    )
    return list(result.scalars().all())


@router.get("/latest", response_model=PracticeOut)
async def latest_practice(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeHistory)
        .where(PracticeHistory.user_id == user_id)
        .order_by(PracticeHistory.created_at.desc())
        .limit(1)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="No practice yet")
    return record
