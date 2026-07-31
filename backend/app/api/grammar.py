"""Grammar API — RAG-grounded Classical Tibetan correction."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.grammar_agent import run_grammar
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Mistake
from app.models.schemas import GrammarCheckRequest, GrammarCheckResponse, GrammarMistakeOut

router = APIRouter(prefix="/grammar", tags=["grammar"])


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

    def map_mistakes(items: list) -> list[GrammarMistakeOut]:
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

    return GrammarCheckResponse(
        mistakes=map_mistakes(result.get("mistakes")),
        honorific_mistakes=map_mistakes(result.get("honorific_mistakes")),
        corrected_version=result.get("corrected_version") or body.text,
        related_rules=result.get("related_rules") or [],
        practice_questions=result.get("practice_questions") or [],
        retrieved_sources=result.get("retrieved_sources") or [],
    )
