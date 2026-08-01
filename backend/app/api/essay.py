"""Essay API — submit essays for grammar + holistic evaluation."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.learner_profile import profile_for_agents
from app.core.rate_limit import rate_limit_llm
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.graph.workflow import run_essay_pipeline
from app.models.entities import Essay, Mistake, Progress, User
from app.models.schemas import EssayOut, EssaySubmitRequest

router = APIRouter(prefix="/essay", tags=["essay"])


@router.post("/submit", response_model=EssayOut)
async def submit_essay(
    body: EssaySubmitRequest,
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_llm(request, str(user_id))
    user = await db.get(User, user_id)
    profile = profile_for_agents(user) if user else {}

    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    previous = {
        "grammar_score": progress.grammar_score if progress else 0,
        "writing_score": progress.writing_score if progress else 0,
        "reading_score": progress.reading_score if progress else 0,
        "speaking_score": progress.speaking_score if progress else 0,
        "vocabulary_score": progress.vocabulary_score if progress else 0,
        "learning_graph": progress.learning_graph if progress else {},
    }

    pipeline = await run_essay_pipeline(
        db,
        body.content,
        previous,
        profile,
        run_grammar_step=body.run_grammar,
    )
    grammar_feedback = pipeline.get("grammar_result") or {}
    evaluation = pipeline.get("essay_result") or {}
    updated = pipeline.get("progress_result") or {}

    essay = Essay(
        user_id=user_id,
        title=body.title,
        content=body.content,
        grammar_score=float(evaluation.get("grammar_score") or 0),
        vocabulary_score=float(evaluation.get("vocabulary_score") or 0),
        fluency_score=float(evaluation.get("fluency_score") or 0),
        naturalness_score=float(evaluation.get("naturalness_score") or 0),
        overall_score=float(evaluation.get("overall_score") or 0),
        reading_level=evaluation.get("reading_level"),
        suggestions=evaluation.get("suggestions") or [],
        grammar_feedback=grammar_feedback,
    )
    db.add(essay)
    await db.flush()

    for m in (grammar_feedback.get("mistakes") or []) + (
        grammar_feedback.get("honorific_mistakes") or []
    ):
        db.add(
            Mistake(
                user_id=user_id,
                essay_id=essay.id,
                mistake_type=m.get("mistake_type") or "grammar",
                original=m.get("original") or "",
                correction=m.get("correction") or "",
                explanation=m.get("explanation"),
                related_rule=m.get("related_rule"),
                source_ref=m.get("source_ref"),
            )
        )

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
    await db.refresh(essay)
    return essay


@router.get("/history", response_model=list[EssayOut])
async def essay_history(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Essay)
        .where(Essay.user_id == user_id)
        .order_by(Essay.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


@router.get("/{essay_id}", response_model=EssayOut)
async def get_essay(
    essay_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    essay = await db.get(Essay, essay_id)
    if not essay or essay.user_id != user_id:
        raise HTTPException(status_code=404, detail="Essay not found")
    return essay
