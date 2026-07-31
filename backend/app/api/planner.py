"""Planner API — generate and fetch personalized learning roadmaps."""

from __future__ import annotations

from uuid import UUID

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.planner_agent import run_planner
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import LearningPlan, Lesson, User
from app.models.schemas import (
    LearningPlanOut,
    LessonOut,
    LessonStatusUpdate,
    PlannerRequest,
)

router = APIRouter(prefix="/planner", tags=["planner"])


def _plan_to_out(plan: LearningPlan) -> LearningPlanOut:
    lessons = [
        {
            "id": str(l.id),
            "title": l.title,
            "content": l.content,
            "lesson_type": l.lesson_type,
            "week_number": l.week_number,
            "order_index": l.order_index,
            "status": l.status,
        }
        for l in sorted(plan.lessons, key=lambda x: (x.week_number, x.order_index))
    ]
    return LearningPlanOut(
        id=plan.id,
        title=plan.title,
        roadmap_json=plan.roadmap_json or {},
        current_week=plan.current_week,
        status=plan.status,
        lessons=lessons,
    )


@router.get("/roadmap", response_model=LearningPlanOut)
async def get_roadmap(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearningPlan)
        .where(LearningPlan.user_id == user_id, LearningPlan.status == "active")
        .options(selectinload(LearningPlan.lessons))
        .order_by(LearningPlan.created_at.desc())
        .limit(1)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="No learning plan yet")
    return _plan_to_out(plan)


@router.post("/generate", response_model=LearningPlanOut)
async def generate_roadmap(
    body: PlannerRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user or not user.profile_complete:
        raise HTTPException(
            status_code=400,
            detail="Complete your learner profile before generating a roadmap",
        )

    existing = await db.execute(
        select(LearningPlan)
        .where(LearningPlan.user_id == user_id, LearningPlan.status == "active")
        .options(selectinload(LearningPlan.lessons))
        .order_by(LearningPlan.created_at.desc())
        .limit(1)
    )
    plan = existing.scalar_one_or_none()
    if plan and not body.regenerate:
        return _plan_to_out(plan)

    if plan and body.regenerate:
        plan.status = "archived"
        await db.flush()

    profile = {
        "name": user.name,
        "age": user.age,
        "school_class": user.school_class,
        "likes": user.likes,
        "favorites": user.favorites,
    }
    roadmap = await run_planner(profile)
    plan = LearningPlan(
        user_id=user_id,
        title=roadmap.get("title") or "Personal Learning Roadmap",
        roadmap_json=roadmap,
        current_week=1,
        status="active",
    )
    db.add(plan)
    await db.flush()

    order = 0
    for week in roadmap.get("weeks") or []:
        week_number = int(week.get("week_number") or 1)
        for lesson in week.get("lessons") or []:
            db.add(
                Lesson(
                    plan_id=plan.id,
                    title=lesson.get("title") or f"Week {week_number} lesson",
                    content=lesson.get("description"),
                    lesson_type=lesson.get("type") or "grammar",
                    week_number=week_number,
                    order_index=order,
                    status="pending",
                )
            )
            order += 1
    await db.flush()
    await db.refresh(plan, attribute_names=["lessons"])
    return _plan_to_out(plan)


def _week_meta(plan: LearningPlan, week_number: int) -> tuple[str | None, list, int | None]:
    for week in (plan.roadmap_json or {}).get("weeks") or []:
        if int(week.get("week_number") or 0) == week_number:
            lessons = week.get("lessons") or []
            minutes = None
            if lessons:
                minutes = lessons[0].get("estimated_minutes")
            return week.get("focus"), week.get("goals") or [], minutes
    return None, [], None


@router.get("/lessons/{lesson_id}", response_model=LessonOut)
async def get_lesson(
    lesson_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    plan = await db.get(LearningPlan, lesson.plan_id)
    if not plan or plan.user_id != user_id:
        raise HTTPException(status_code=404, detail="Lesson not found")
    focus, goals, minutes = _week_meta(plan, lesson.week_number)
    # Match estimated minutes from roadmap JSON by title when possible
    for week in (plan.roadmap_json or {}).get("weeks") or []:
        if int(week.get("week_number") or 0) != lesson.week_number:
            continue
        for item in week.get("lessons") or []:
            if item.get("title") == lesson.title:
                minutes = item.get("estimated_minutes") or minutes
                if item.get("description") and not lesson.content:
                    lesson.content = item.get("description")
                break
    return LessonOut(
        id=lesson.id,
        title=lesson.title,
        content=lesson.content,
        lesson_type=lesson.lesson_type,
        week_number=lesson.week_number,
        order_index=lesson.order_index,
        status=lesson.status,
        plan_id=lesson.plan_id,
        goals=goals,
        week_focus=focus,
        estimated_minutes=minutes,
    )


@router.post("/lessons/{lesson_id}/status", response_model=LessonOut)
async def update_lesson_status(
    lesson_id: UUID,
    body: LessonStatusUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    plan = await db.get(LearningPlan, lesson.plan_id)
    if not plan or plan.user_id != user_id:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson.status = body.status
    if body.status == "completed":
        lesson.completed_at = datetime.now(timezone.utc)
        # Advance current week when all lessons in this week are done
        week_lessons = (
            await db.execute(
                select(Lesson).where(
                    Lesson.plan_id == plan.id,
                    Lesson.week_number == lesson.week_number,
                )
            )
        ).scalars().all()
        if week_lessons and all(
            (l.id == lesson.id and body.status == "completed") or l.status == "completed"
            for l in week_lessons
        ):
            plan.current_week = max(plan.current_week, lesson.week_number + 1)
    elif body.status == "in_progress":
        plan.current_week = max(plan.current_week, lesson.week_number)

    await db.flush()
    focus, goals, minutes = _week_meta(plan, lesson.week_number)
    return LessonOut(
        id=lesson.id,
        title=lesson.title,
        content=lesson.content,
        lesson_type=lesson.lesson_type,
        week_number=lesson.week_number,
        order_index=lesson.order_index,
        status=lesson.status,
        plan_id=lesson.plan_id,
        goals=goals,
        week_focus=focus,
        estimated_minutes=minutes,
    )
