"""Grammar API — RAG-grounded Classical Tibetan correction + Grammar Quest."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.grammar_agent import run_grammar
from app.agents.grammar_game_agent import run_grammar_game
from app.core.learner_profile import profile_for_agents
from app.core.rate_limit import rate_limit_llm
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Essay, Mistake, User
from app.models.schemas import (
    GrammarCheckRequest,
    GrammarCheckResponse,
    GrammarExtractResponse,
    GrammarFileCheckResponse,
    GrammarGameRequest,
    GrammarGameResponse,
    GrammarGameRound,
    GrammarMistakeOut,
    RecentMistakeOut,
)
from app.services.document_text import clamp_extracted_text, extract_text_from_upload
from app.services.ocr import is_image_upload, ocr_images

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


async def _persist_mistakes(
    db: AsyncSession,
    user_id: UUID,
    result: dict,
    essay_id: UUID | None = None,
) -> None:
    if essay_id is not None:
        essay = await db.get(Essay, essay_id)
        if not essay or essay.user_id != user_id:
            essay_id = None

    for m in (result.get("mistakes") or []) + (result.get("honorific_mistakes") or []):
        db.add(
            Mistake(
                user_id=user_id,
                essay_id=essay_id,
                mistake_type=m.get("mistake_type") or "grammar",
                original=m.get("original") or "",
                correction=m.get("correction") or "",
                explanation=m.get("explanation"),
                related_rule=m.get("related_rule"),
                source_ref=m.get("source_ref"),
            )
        )
    await db.flush()


def _to_check_response(result: dict, text: str) -> GrammarCheckResponse:
    return GrammarCheckResponse(
        mistakes=_map_mistakes(result.get("mistakes")),
        honorific_mistakes=_map_mistakes(result.get("honorific_mistakes")),
        corrected_version=result.get("corrected_version") or text,
        related_rules=result.get("related_rules") or [],
        practice_questions=result.get("practice_questions") or [],
        retrieved_sources=result.get("retrieved_sources") or [],
        summary=result.get("summary"),
        praise=result.get("praise"),
    )


async def _collect_uploads(
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> list[UploadFile]:
    uploads: list[UploadFile] = []
    if files:
        uploads.extend([f for f in files if f is not None])
    if file is not None:
        uploads.append(file)
    # de-dupe by identity while keeping order
    seen: set[int] = set()
    unique: list[UploadFile] = []
    for u in uploads:
        oid = id(u)
        if oid in seen:
            continue
        seen.add(oid)
        unique.append(u)
    if not unique:
        raise HTTPException(status_code=400, detail="No file uploaded")
    return unique


async def _extract_from_uploads(
    uploads: list[UploadFile],
) -> tuple[str, bool, str, str | None]:
    """Return text, truncated, kind, display_filename."""
    blobs: list[tuple[bytes, str | None, str | None]] = []
    for u in uploads:
        raw = await u.read()
        blobs.append((raw, u.filename, u.content_type))

    names = [b[1] or "upload" for b in blobs]
    display = names[0] if len(names) == 1 else f"{len(names)} images"

    image_flags = [is_image_upload(name, ctype) for _, name, ctype in blobs]
    if any(image_flags) and not all(image_flags):
        raise HTTPException(
            status_code=400,
            detail="Do not mix images with documents in one upload",
        )

    if all(image_flags):
        text, kind = await ocr_images(blobs, lang_hint="bo")
        text, truncated = clamp_extracted_text(text)
        return text, truncated, kind, display

    if len(blobs) != 1:
        raise HTTPException(
            status_code=400,
            detail="Only one document at a time (or 1–5 images for OCR)",
        )
    raw, name, ctype = blobs[0]
    text, truncated, kind = extract_text_from_upload(raw, name, ctype)
    return text, truncated, kind, display



@router.post("/check", response_model=GrammarCheckResponse)
async def check_grammar(
    body: GrammarCheckRequest,
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_llm(request, str(user_id))
    user = await db.get(User, user_id)
    profile = profile_for_agents(user) if user else {}
    result = await run_grammar(db, body.text, profile)
    await _persist_mistakes(db, user_id, result, body.essay_id)
    return _to_check_response(result, body.text)


@router.post("/extract-file", response_model=GrammarExtractResponse)
async def extract_grammar_file(
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
    file: UploadFile | None = File(None),
    files: list[UploadFile] | None = File(None),
):
    """Pull text from homework files or Monlam-OCR images into the grammar editor."""
    rate_limit_llm(request, str(user_id))
    uploads = await _collect_uploads(file, files)
    text, truncated, kind, display = await _extract_from_uploads(uploads)
    return GrammarExtractResponse(
        text=text,
        filename=display,
        truncated=truncated,
        file_kind=kind,
        char_count=len(text),
    )


@router.post("/check-file", response_model=GrammarFileCheckResponse)
async def check_grammar_file(
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    file: UploadFile | None = File(None),
    files: list[UploadFile] | None = File(None),
):
    """Upload doc or image(s) → extract / Monlam OCR → grammar agent."""
    rate_limit_llm(request, str(user_id))
    uploads = await _collect_uploads(file, files)
    text, truncated, kind, display = await _extract_from_uploads(uploads)
    user = await db.get(User, user_id)
    profile = profile_for_agents(user) if user else {}
    result = await run_grammar(db, text, profile)
    await _persist_mistakes(db, user_id, result)
    base = _to_check_response(result, text)
    return GrammarFileCheckResponse(
        **base.model_dump(),
        extracted_text=text,
        filename=display,
        truncated=truncated,
        file_kind=kind,
    )



@router.post("/game", response_model=GrammarGameResponse)
async def grammar_game(
    body: GrammarGameRequest,
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_llm(request, str(user_id))
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
