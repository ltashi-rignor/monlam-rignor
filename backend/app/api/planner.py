"""Planner API — generate and fetch personalized learning roadmaps."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.planner_agent import run_planner
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import LearningPlan, Lesson, User
from app.models.schemas import LearningPlanOut, PlannerRequest

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
