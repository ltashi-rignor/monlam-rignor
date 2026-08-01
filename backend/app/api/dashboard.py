"""Dashboard summary — fast DB aggregation (no Melong round-trip)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Essay, LearningPlan, Mistake, PracticeHistory, Progress, User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

ACTIVITY_DAYS = 14
PRACTICE_SCORE_LIMIT = 12


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
    story_count: int
    activity_series: list[dict[str, Any]]
    practice_scores: list[dict[str, Any]]
    week_completion: dict[str, int]


def _day_key(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).date().isoformat()


def _empty_day(d: date) -> dict[str, Any]:
    return {
        "date": d.isoformat(),
        "practices_completed": 0,
        "practice_avg_score": None,
        "stories": 0,
        "mistakes": 0,
    }


def _parse_story_day(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return _day_key(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        # Handle trailing Z
        normalized = text.replace("Z", "+00:00")
        return _day_key(datetime.fromisoformat(normalized))
    except ValueError:
        if len(text) >= 10 and text[4] == "-" and text[7] == "-":
            return text[:10]
        return None


def _build_activity_series(
    practices: list[PracticeHistory],
    stories: list[dict[str, Any]],
    mistakes: list[Mistake],
    *,
    days: int = ACTIVITY_DAYS,
    today: date | None = None,
) -> list[dict[str, Any]]:
    today = today or datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    buckets: dict[str, dict[str, Any]] = {
        (start + timedelta(days=i)).isoformat(): _empty_day(start + timedelta(days=i))
        for i in range(days)
    }

    practice_sums: dict[str, list[float]] = {}
    for row in practices:
        key = _day_key(row.created_at)
        if key not in buckets:
            continue
        if not row.completed:
            continue
        buckets[key]["practices_completed"] += 1
        if row.score is not None:
            practice_sums.setdefault(key, []).append(float(row.score))

    for row in stories:
        if not isinstance(row, dict):
            continue
        key = _parse_story_day(row.get("created_at"))
        if key not in buckets:
            continue
        buckets[key]["stories"] += 1

    for row in mistakes:
        key = _day_key(row.created_at)
        if key not in buckets:
            continue
        buckets[key]["mistakes"] += 1

    for key, scores in practice_sums.items():
        if scores:
            buckets[key]["practice_avg_score"] = round(sum(scores) / len(scores), 1)

    return [buckets[(start + timedelta(days=i)).isoformat()] for i in range(days)]


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

    since = datetime.now(timezone.utc) - timedelta(days=ACTIVITY_DAYS)
    series_practices = (
        await db.scalars(
            select(PracticeHistory).where(
                PracticeHistory.user_id == user_id,
                PracticeHistory.created_at >= since,
            )
        )
    ).all()
    series_mistakes = (
        await db.scalars(
            select(Mistake).where(Mistake.user_id == user_id, Mistake.created_at >= since)
        )
    ).all()
    kid_stories = list((progress.learning_graph or {}).get("kid_stories") or [])
    if not isinstance(kid_stories, list):
        kid_stories = []
    activity_series = _build_activity_series(
        list(series_practices),
        kid_stories,
        list(series_mistakes),
    )

    score_rows = (
        await db.scalars(
            select(PracticeHistory)
            .where(
                PracticeHistory.user_id == user_id,
                PracticeHistory.completed.is_(True),
                PracticeHistory.score.is_not(None),
            )
            .order_by(PracticeHistory.created_at.desc())
            .limit(PRACTICE_SCORE_LIMIT)
        )
    ).all()
    practice_scores = [
        {
            "date": row.created_at.isoformat() if row.created_at else None,
            "score": round(float(row.score), 1),
        }
        for row in reversed(list(score_rows))
    ]

    week_total = len(lessons)
    week_completed = sum(1 for lesson in lessons if lesson.get("status") == "completed")
    week_completion = {"total": week_total, "completed": week_completed}

    from app.core.learner_profile import profile_for_agents

    agent_profile = profile_for_agents(user) if user else {}
    return DashboardSummary(
        profile={
            "name": user.name if user else None,
            "email": user.email if user else None,
            "age": user.age if user else None,
            "school_class": user.school_class if user else None,
            "likes": user.likes if user else None,
            "favorites": user.favorites if user else None,
            "learner_profile": getattr(user, "learner_profile", None) or {},
            "goals": agent_profile.get("goals") or [],
            "tibetan_variety": agent_profile.get("tibetan_variety"),
            "native_language": agent_profile.get("native_language"),
            "derived_level": agent_profile.get("derived_level"),
            "interests": agent_profile.get("interests") or [],
            "daily_minutes": agent_profile.get("daily_minutes"),
            "challenges": agent_profile.get("challenges") or [],
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
        story_count=len(kid_stories),
        activity_series=activity_series,
        practice_scores=practice_scores,
        week_completion=week_completion,
    )
