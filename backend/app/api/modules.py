"""Curated module progress — alphabet, vocab, interactive path-based lessons."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.agents.interactive_lesson_agent import (
    normalize_interactive_lesson,
    run_interactive_lesson,
)
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import LearningPlan, Lesson, Progress, User

router = APIRouter(prefix="/modules", tags=["modules"])

MODULES_KEY = "modules"
INTERACTIVE_KEY = "interactive_lessons"


def _empty_modules() -> dict[str, Any]:
    return {
        "mastered_letters": [],
        "mastered_words": [],
        "completed_lessons": [],
        "xp": 0,
        INTERACTIVE_KEY: {},
    }


def _get_modules(progress: Progress | None) -> dict[str, Any]:
    graph = dict(progress.learning_graph or {}) if progress else {}
    modules = graph.get(MODULES_KEY) or {}
    base = _empty_modules()
    for key in base:
        if key == "xp":
            base[key] = int(modules.get(key) or 0)
        elif key == INTERACTIVE_KEY:
            cached = modules.get(key) or {}
            base[key] = dict(cached) if isinstance(cached, dict) else {}
        else:
            vals = modules.get(key) or []
            base[key] = list(vals) if isinstance(vals, list) else []
    return base


def _set_modules(progress: Progress, modules: dict[str, Any]) -> None:
    graph = dict(progress.learning_graph or {})
    graph[MODULES_KEY] = modules
    progress.learning_graph = graph
    flag_modified(progress, "learning_graph")


class ModuleProgressOut(BaseModel):
    mastered_letters: list[str] = []
    mastered_words: list[str] = []
    completed_lessons: list[str] = []
    xp: int = 0


class ModuleProgressIn(BaseModel):
    kind: Literal["letter", "word", "lesson"]
    item_id: str = Field(min_length=1, max_length=64)
    xp: int = Field(default=5, ge=0, le=100)


class QuizSubmitIn(BaseModel):
    lesson_id: str = Field(min_length=1, max_length=64)
    score: int = Field(ge=0)
    total: int = Field(ge=1)


class QuizSubmitOut(BaseModel):
    progress: ModuleProgressOut
    xp_earned: int


class InteractiveLessonSummary(BaseModel):
    id: str
    title: str
    tibetan_title: str | None = None
    focus: str | None = None
    level: str | None = None
    minutes: int = 10
    week_number: int = 1
    lesson_type: str = "lesson"
    status: str = "pending"
    ready: bool = False


class InteractiveLessonsListOut(BaseModel):
    plan_id: str | None = None
    plan_title: str | None = None
    current_week: int = 1
    lessons: list[InteractiveLessonSummary] = []
    message: str | None = None


async def _ensure_progress(db: AsyncSession, user_id: UUID) -> Progress:
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    if not progress:
        progress = Progress(user_id=user_id, learning_graph={})
        db.add(progress)
        await db.flush()
    return progress


async def _active_plan(db: AsyncSession, user_id: UUID) -> LearningPlan | None:
    result = await db.execute(
        select(LearningPlan)
        .where(LearningPlan.user_id == user_id, LearningPlan.status == "active")
        .options(selectinload(LearningPlan.lessons))
        .order_by(LearningPlan.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _week_meta(plan: LearningPlan, week_number: int) -> dict[str, Any]:
    for week in (plan.roadmap_json or {}).get("weeks") or []:
        if int(week.get("week_number") or 0) == week_number:
            return {
                "focus": week.get("focus") or "",
                "goals": week.get("goals") or [],
            }
    return {"focus": "", "goals": []}


@router.get("/progress", response_model=ModuleProgressOut)
async def get_module_progress(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    progress = await _ensure_progress(db, user_id)
    modules = _get_modules(progress)
    return ModuleProgressOut(
        mastered_letters=modules["mastered_letters"],
        mastered_words=modules["mastered_words"],
        completed_lessons=modules["completed_lessons"],
        xp=modules["xp"],
    )


@router.post("/progress", response_model=ModuleProgressOut)
async def add_module_progress(
    body: ModuleProgressIn,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    progress = await _ensure_progress(db, user_id)
    modules = _get_modules(progress)
    field_map = {
        "letter": "mastered_letters",
        "word": "mastered_words",
        "lesson": "completed_lessons",
    }
    field = field_map[body.kind]
    if body.item_id not in modules[field]:
        modules[field].append(body.item_id)
        modules["xp"] = int(modules["xp"]) + body.xp
    _set_modules(progress, modules)
    await db.flush()
    return ModuleProgressOut(
        mastered_letters=modules["mastered_letters"],
        mastered_words=modules["mastered_words"],
        completed_lessons=modules["completed_lessons"],
        xp=modules["xp"],
    )


@router.post("/quiz", response_model=QuizSubmitOut)
async def submit_module_quiz(
    body: QuizSubmitIn,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    progress = await _ensure_progress(db, user_id)
    modules = _get_modules(progress)
    xp_earned = max(0, body.score) * 10
    modules["xp"] = int(modules["xp"]) + xp_earned
    if body.score >= max(1, body.total // 2):
        if body.lesson_id not in modules["completed_lessons"]:
            modules["completed_lessons"].append(body.lesson_id)
    _set_modules(progress, modules)
    await db.flush()
    return QuizSubmitOut(
        progress=ModuleProgressOut(
            mastered_letters=modules["mastered_letters"],
            mastered_words=modules["mastered_words"],
            completed_lessons=modules["completed_lessons"],
            xp=modules["xp"],
        ),
        xp_earned=xp_earned,
    )


@router.get("/lessons", response_model=InteractiveLessonsListOut)
async def list_interactive_lessons(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    plan = await _active_plan(db, user_id)
    if not plan:
        return InteractiveLessonsListOut(message="no_plan", lessons=[])

    progress = await _ensure_progress(db, user_id)
    modules = _get_modules(progress)
    cached = modules.get(INTERACTIVE_KEY) or {}
    plan_cache = cached.get(str(plan.id)) if isinstance(cached, dict) else None
    if not isinstance(plan_cache, dict):
        plan_cache = {}

    lessons_sorted = sorted(plan.lessons, key=lambda x: (x.week_number, x.order_index))
    summaries: list[InteractiveLessonSummary] = []
    for lesson in lessons_sorted:
        lid = str(lesson.id)
        ready_body = plan_cache.get(lid) if isinstance(plan_cache.get(lid), dict) else None
        summaries.append(
            InteractiveLessonSummary(
                id=lid,
                title=lesson.title,
                tibetan_title=(ready_body or {}).get("tibetan_title") or lesson.title,
                focus=(ready_body or {}).get("focus") or lesson.content,
                level=(ready_body or {}).get("level") or "འགོ་འཛུགས།",
                minutes=int((ready_body or {}).get("minutes") or 10),
                week_number=lesson.week_number,
                lesson_type=lesson.lesson_type,
                status=lesson.status,
                ready=bool(ready_body),
            )
        )

    return InteractiveLessonsListOut(
        plan_id=str(plan.id),
        plan_title=plan.title,
        current_week=plan.current_week,
        lessons=summaries,
    )


@router.get("/lessons/{lesson_id}")
async def get_interactive_lesson(
    lesson_id: UUID,
    regenerate: bool = False,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    plan = await _active_plan(db, user_id)
    if not plan:
        raise HTTPException(
            status_code=404,
            detail="No learning plan yet — create སློབ་ལམ། first",
        )

    lesson = await db.get(Lesson, lesson_id)
    if not lesson or lesson.plan_id != plan.id:
        raise HTTPException(status_code=404, detail="Lesson not found on your learning path")

    progress = await _ensure_progress(db, user_id)
    modules = _get_modules(progress)
    cached = modules.get(INTERACTIVE_KEY) or {}
    plan_key = str(plan.id)
    plan_cache = cached.get(plan_key) if isinstance(cached, dict) else None
    if not isinstance(plan_cache, dict):
        plan_cache = {}

    lid = str(lesson.id)
    if not regenerate and isinstance(plan_cache.get(lid), dict):
        return plan_cache[lid]

    user = await db.get(User, user_id)
    profile = {
        "name": user.name if user else None,
        "age": user.age if user else None,
        "school_class": user.school_class if user else None,
        "likes": user.likes if user else None,
        "favorites": user.favorites if user else None,
    }
    week_meta = _week_meta(plan, lesson.week_number)
    roadmap_lesson = {
        "title": lesson.title,
        "content": lesson.content,
        "lesson_type": lesson.lesson_type,
        "week_number": lesson.week_number,
    }
    raw = await run_interactive_lesson(profile, roadmap_lesson, week_meta)
    normalized = normalize_interactive_lesson(
        raw,
        lesson_id=lid,
        week_number=lesson.week_number,
        lesson_type=lesson.lesson_type,
        fallback_title=lesson.title,
    )

    modules[INTERACTIVE_KEY] = {plan_key: {**plan_cache, lid: normalized}}
    _set_modules(progress, modules)
    await db.flush()
    return normalized


@router.post("/lessons/{lesson_id}/regenerate")
async def regenerate_interactive_lesson(
    lesson_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await get_interactive_lesson(
        lesson_id=lesson_id,
        regenerate=True,
        user_id=user_id,
        db=db,
    )
