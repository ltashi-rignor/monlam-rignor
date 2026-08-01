"""Public CMS API — blog, news, FAQ, announcements, contact, marketing stats.

No authentication required. Schema is ready for a future admin UI.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import rate_limit_public
from app.database.session import get_db
from app.models.entities import CmsContactMessage, CmsPost, User

router = APIRouter(prefix="/cms", tags=["cms"])

CmsKind = Literal["blog", "news", "faq", "announcement"]


class PostOut(BaseModel):
    id: UUID
    kind: str
    slug: str
    title_bo: str
    title_en: str | None = None
    excerpt: str | None = None
    body: str = ""
    published_at: datetime | None = None
    sort_order: int = 0


class PostListOut(BaseModel):
    items: list[PostOut]
    total: int


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    subject: str | None = Field(default=None, max_length=400)
    message: str = Field(min_length=1, max_length=5000)


class ContactOut(BaseModel):
    ok: bool = True


class StatsOut(BaseModel):
    """Public marketing counters. Prefer curriculum facts over vanity fiction."""

    learners: int | None = None
    letters: int
    grammar_topics: int
    ai_lessons: int
    source: str = "curriculum"


@router.get("/stats", response_model=StatsOut)
async def marketing_stats(db: AsyncSession = Depends(get_db)):
    # Curriculum sizes are fixed product facts (not invented engagement).
    letters = 30
    grammar_topics = 48
    ai_lessons = 12

    # Bucket verified-user count to avoid exact enumeration; hide when tiny.
    n = int(
        await db.scalar(
            select(func.count()).select_from(User).where(User.email_verified.is_(True))
        )
        or 0
    )
    learners = None
    if n >= 10:
        learners = (n // 10) * 10

    return StatsOut(
        learners=learners,
        letters=letters,
        grammar_topics=grammar_topics,
        ai_lessons=ai_lessons,
        source="curriculum",
    )


def _serialize(post: CmsPost, *, include_body: bool = True) -> PostOut:
    return PostOut(
        id=post.id,
        kind=post.kind,
        slug=post.slug,
        title_bo=post.title_bo,
        title_en=post.title_en,
        excerpt=post.excerpt,
        body=post.body if include_body else "",
        published_at=post.published_at,
        sort_order=post.sort_order,
    )


@router.get("/posts", response_model=PostListOut)
async def list_posts(
    kind: CmsKind = Query(...),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    filters = (CmsPost.kind == kind, CmsPost.published.is_(True))
    total = await db.scalar(select(func.count()).select_from(CmsPost).where(*filters))
    result = await db.execute(
        select(CmsPost)
        .where(*filters)
        .order_by(CmsPost.sort_order.asc(), CmsPost.published_at.desc().nullslast())
        .offset(offset)
        .limit(limit)
    )
    posts = result.scalars().all()
    # List endpoints omit full body for FAQ/blog cards — keep excerpt; include body for faq
    include_body = kind == "faq"
    return PostListOut(
        items=[_serialize(p, include_body=include_body) for p in posts],
        total=int(total or 0),
    )


@router.get("/posts/{slug}", response_model=PostOut)
async def get_post(
    slug: str,
    kind: CmsKind = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CmsPost).where(
            CmsPost.slug == slug,
            CmsPost.kind == kind,
            CmsPost.published.is_(True),
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _serialize(post, include_body=True)


@router.get("/announcements", response_model=list[PostOut])
async def list_announcements(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CmsPost)
        .where(CmsPost.kind == "announcement", CmsPost.published.is_(True))
        .order_by(CmsPost.sort_order.asc(), CmsPost.published_at.desc().nullslast())
        .limit(limit)
    )
    return [_serialize(p, include_body=True) for p in result.scalars().all()]


@router.post("/contact", response_model=ContactOut)
async def submit_contact(
    body: ContactIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    rate_limit_public(request, action="contact", limit=5)
    db.add(
        CmsContactMessage(
            name=body.name.strip(),
            email=str(body.email).strip().lower(),
            subject=(body.subject or "").strip() or None,
            message=body.message.strip(),
        )
    )
    await db.commit()
    return ContactOut(ok=True)
