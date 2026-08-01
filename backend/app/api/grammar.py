"""Grammar API — RAG-grounded Classical Tibetan correction + Grammar Quest."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.grammar_agent import run_grammar
from app.agents.grammar_game_agent import run_grammar_game
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Mistake
from app.models.schemas import (
    GrammarCheckRequest,
    GrammarCheckResponse,
    GrammarGameRequest,
    GrammarGameResponse,
    GrammarGameRound,
    GrammarMistakeOut,
    RecentMistakeOut,
)

router = APIRouter(prefix="/grammar", tags=["grammar"])


def _map_mistakes(items: list) -> list[GrammarMistakeOut]:
    return [
        GrammarMistakeOut(
            mistake_type=i.get("mistake_type") or "grammar",
            original=i.get("original") or "",
            correction=i.get("correction") or "",
            explanation=i.get("explanation"),
            related_rule=i.get("related_rule"),
            source_ref=i.get("source_ref"),
        )
        for i in items or []
    ]


@router.post("/check", response_model=GrammarCheckResponse)
async def check_grammar(
    body: GrammarCheckRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await run_grammar(db, body.text)

    for m in (result.get("mistakes") or []) + (result.get("honorific_mistakes") or []):
        db.add(
            Mistake(
                user_id=user_id,
                essay_id=body.essay_id,
                mistake_type=m.get("mistake_type") or "grammar",
                original=m.get("original") or "",
                correction=m.get("correction") or "",
                explanation=m.get("explanation"),
                related_rule=m.get("related_rule"),
                source_ref=m.get("source_ref"),
            )
        )
    await db.flush()

    return GrammarCheckResponse(
        mistakes=_map_mistakes(result.get("mistakes")),
        honorific_mistakes=_map_mistakes(result.get("honorific_mistakes")),
        corrected_version=result.get("corrected_version") or body.text,
        related_rules=result.get("related_rules") or [],
        practice_questions=result.get("practice_questions") or [],
        retrieved_sources=result.get("retrieved_sources") or [],
        summary=result.get("summary"),
        praise=result.get("praise"),
    )


@router.post("/game", response_model=GrammarGameResponse)
async def grammar_game(
    body: GrammarGameRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    recent: list[dict] = []
    if (body.topic or "").strip().lower() in {"mistakes", "my_mistakes", "ངའི་ནོར་འཁྲུལ།"}:
        rows = (
            await db.execute(
                select(Mistake)
                .where(Mistake.user_id == user_id)
                .order_by(Mistake.created_at.desc())
                .limit(8)
            )
        ).scalars().all()
        recent = [
            {
                "original": r.original,
                "correction": r.correction,
                "explanation": r.explanation,
                "related_rule": r.related_rule,
                "mistake_type": r.mistake_type,
            }
            for r in rows
        ]

    payload = await run_grammar_game(db, body.topic, recent)
    rounds_out: list[GrammarGameRound] = []
    for r in payload.get("rounds") or []:
        page = r.get("page_number")
        try:
            page_i = int(page) if page is not None and str(page).strip() != "" else None
        except (TypeError, ValueError):
            page_i = None
        rounds_out.append(
            GrammarGameRound(
                id=str(r.get("id") or ""),
                type=str(r.get("type") or "pick"),
                prompt=str(r.get("prompt") or ""),
                sentence=str(r.get("sentence") or ""),
                error_span=str(r.get("error_span") or ""),
                options=list(r.get("options") or []),
                answer=str(r.get("answer") or ""),
                explanation=str(r.get("explanation") or ""),
                related_rule=str(r.get("related_rule") or ""),
                source_ref=str(r.get("source_ref") or ""),
                handbook_excerpt=str(r.get("handbook_excerpt") or ""),
                page_number=page_i,
            )
        )
    return GrammarGameResponse(
        topic=payload.get("topic") or body.topic,
        topic_label=payload.get("topic_label") or "",
        rounds=rounds_out,
        retrieved_sources=payload.get("retrieved_sources") or [],
        offline=bool(payload.get("offline")),
        source=str(payload.get("source") or "melong"),
    )


@router.get("/recent-mistakes", response_model=list[RecentMistakeOut])
async def recent_mistakes(
    limit: int = Query(default=8, ge=1, le=30),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Mistake)
            .where(Mistake.user_id == user_id)
            .order_by(Mistake.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return rows
