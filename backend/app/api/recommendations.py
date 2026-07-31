"""Recommendation API — next-best content from catalog + learner history."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.recommendation_agent import run_recommendations
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import ContentItem, Essay, Mistake, Progress, User
from app.models.schemas import RecommendationOut, RecommendationsResponse

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationsResponse)
async def get_recommendations(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
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
            .limit(15)
        )
    ).scalars().all()
    catalog_rows = (await db.execute(select(ContentItem))).scalars().all()
    catalog = [
        {
            "content_id": str(c.id),
            "content_type": c.content_type,
            "title": c.title,
            "description": c.description,
            "level": c.level,
            "topics": c.topics,
            "url": c.url,
            "body": (c.body or "")[:500],
        }
        for c in catalog_rows
    ]
    history = {
        "profile": {
            "name": user.name if user else None,
            "age": user.age if user else None,
            "school_class": user.school_class if user else None,
            "likes": user.likes if user else None,
            "favorites": user.favorites if user else None,
        },
        "progress": {
            "grammar_score": progress.grammar_score if progress else 0,
            "writing_score": progress.writing_score if progress else 0,
            "reading_score": progress.reading_score if progress else 0,
            "vocabulary_score": progress.vocabulary_score if progress else 0,
            "learning_graph": progress.learning_graph if progress else {},
        },
        "recent_essay_scores": [e.overall_score for e in essays],
        "recent_mistake_types": [m.mistake_type for m in mistakes],
    }
    result = await run_recommendations(history, catalog)
    items = [
        RecommendationOut(
            content_type=r.get("content_type") or "reading",
            title=r.get("title") or "Recommended item",
            description=r.get("description"),
            level=r.get("level") or (user.school_class if user else "beginner") or "beginner",
            topics=r.get("topics") or [],
            url=r.get("url"),
            reason=r.get("reason"),
            body=r.get("body"),
        )
        for r in result.get("recommendations") or []
    ]
    return RecommendationsResponse(items=items, rationale=result.get("rationale"))
