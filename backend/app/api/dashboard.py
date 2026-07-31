"""Dashboard summary — fast DB aggregation (no Melong round-trip)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Essay, LearningPlan, Mistake, PracticeHistory, Progress, User
from pydantic import BaseModel

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardSummary(BaseModel):
    profile: dict[str, Any]
    progress: dict[str, Any]
    roadmap: dict[str, Any] | None
    current_week_lessons: list[dict[str, Any]]
    next_lesson: dict[str, Any] | None
    latest_practice: dict[str, Any] | None
    recent_essays: list[dict[str, Any]]
    mistake_count: int
    practice_completed_count: int
    essay_count: int


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    if progress is None:
        progress = Progress(user_id=user_id, learning_graph={})
        db.add(progress)
        await db.flush()

    plan_result = await db.execute(
        select(LearningPlan)
        .where(LearningPlan.user_id == user_id, LearningPlan.status == "active")
        .options(selectinload(LearningPlan.lessons))
        .order_by(LearningPlan.created_at.desc())
        .limit(1)
    )
    plan = plan_result.scalar_one_or_none()

    current_week = plan.current_week if plan else 1
    lessons = []
    next_lesson = None
    roadmap_payload = None
    if plan:
        roadmap_payload = {
            "id": str(plan.id),
            "title": plan.title,
            "summary": (plan.roadmap_json or {}).get("summary"),
            "current_week": plan.current_week,
            "status": plan.status,
            "weeks": (plan.roadmap_json or {}).get("weeks") or [],
        }
        sorted_lessons = sorted(
            plan.lessons, key=lambda l: (l.week_number, l.order_index)
        )
        for lesson in sorted_lessons:
            item = {
                "id": str(lesson.id),
                "title": lesson.title,
                "content": lesson.content,
                "lesson_type": lesson.lesson_type,
                "week_number": lesson.week_number,
                "order_index": lesson.order_index,
                "status": lesson.status,
            }
            if lesson.week_number == current_week:
                lessons.append(item)
            if next_lesson is None and lesson.status != "completed":
                next_lesson = item

    practice_result = await db.execute(
        select(PracticeHistory)
        .where(PracticeHistory.user_id == user_id)
        .order_by(PracticeHistory.created_at.desc())
        .limit(1)
    )
    practice = practice_result.scalar_one_or_none()
    latest_practice = None
    if practice:
        exercises = (practice.exercises_json or {}).get("exercises") or []
        latest_practice = {
            "id": str(practice.id),
            "title": (practice.exercises_json or {}).get("title"),
            "completed": practice.completed,
            "score": practice.score,
            "exercise_count": len(exercises) if isinstance(exercises, list) else 0,
            "created_at": practice.created_at.isoformat() if practice.created_at else None,
        }

    essays_result = await db.execute(
        select(Essay)
        .where(Essay.user_id == user_id)
        .order_by(Essay.created_at.desc())
        .limit(3)
    )
    essays = [
        {
            "id": str(e.id),
            "title": e.title,
            "overall_score": e.overall_score,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in essays_result.scalars().all()
    ]

    mistake_count = await db.scalar(
        select(func.count()).select_from(Mistake).where(Mistake.user_id == user_id)
    )
    practice_done = await db.scalar(
        select(func.count())
        .select_from(PracticeHistory)
        .where(PracticeHistory.user_id == user_id, PracticeHistory.completed.is_(True))
    )
    essay_count = await db.scalar(
        select(func.count()).select_from(Essay).where(Essay.user_id == user_id)
    )

    return DashboardSummary(
        profile={
            "name": user.name if user else None,
            "email": user.email if user else None,
            "age": user.age if user else None,
            "school_class": user.school_class if user else None,
            "likes": user.likes if user else None,
            "favorites": user.favorites if user else None,
        },
        progress={
            "grammar_score": progress.grammar_score,
            "writing_score": progress.writing_score,
            "reading_score": progress.reading_score,
            "speaking_score": progress.speaking_score,
            "vocabulary_score": progress.vocabulary_score,
            "next_focus": (progress.learning_graph or {}).get("next_focus") or [],
            "strengths": (progress.learning_graph or {}).get("strengths") or [],
            "weaknesses": (progress.learning_graph or {}).get("weaknesses") or [],
        },
        roadmap=roadmap_payload,
        current_week_lessons=lessons,
        next_lesson=next_lesson,
        latest_practice=latest_practice,
        recent_essays=essays,
        mistake_count=int(mistake_count or 0),
        practice_completed_count=int(practice_done or 0),
        essay_count=int(essay_count or 0),
    )
