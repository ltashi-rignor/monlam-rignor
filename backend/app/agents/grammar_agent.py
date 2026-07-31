"""Grammar Agent — retrieval-augmented correction grounded in the grammar handbook."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.retriever import get_retriever
from app.services import prompt_manager as prompts
from app.services.llm import get_llm

MAX_EXPLANATION = 400
MAX_RELATED_RULE = 220
MAX_LIST_ITEM = 180


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("question", "text", "prompt", "rule", "content", "explanation"):
            if key in value and value[key] is not None:
                return str(value[key])
        return str(next(iter(value.values()), ""))
    return str(value)


def _collapse_repetition(text: str) -> str:
    """Stop Melong from looping the same particle list dozens of times."""
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) < 80:
        return cleaned

    # Collapse obvious duplicated comma/semicolon segments
    parts = re.split(r"(?<=[।.!?])\s+|(?<=;)\s+", cleaned)
    seen: list[str] = []
    for part in parts:
        p = part.strip()
        if not p:
            continue
        if seen and p == seen[-1]:
            continue
        # Drop near-duplicate particle laundry lists
        if len(seen) >= 1 and len(p) > 60:
            prev = seen[-1]
            overlap = len(set(re.findall(r"[\u0f00-\u0fff]+|'[^']+'", p)) & set(
                re.findall(r"[\u0f00-\u0fff]+|'[^']+'", prev)
            ))
            if overlap >= 4 and p.count(",") > 4:
                continue
        seen.append(p)
        if len(seen) >= 3:
            break
    collapsed = " ".join(seen) if seen else cleaned

    # If still a long repeating comma list, keep unique tokens only
    if collapsed.count(",") >= 8:
        tokens = [t.strip() for t in collapsed.split(",") if t.strip()]
        unique: list[str] = []
        for token in tokens:
            if token not in unique:
                unique.append(token)
            if len(unique) >= 8:
                break
        collapsed = ", ".join(unique)
        if not collapsed.endswith("."):
            collapsed += "."
    return collapsed


def _clamp(text: str | None, limit: int) -> str | None:
    if text is None:
        return None
    value = _collapse_repetition(_as_str(text))
    if not value:
        return None
    if len(value) <= limit:
        return value
    cut = value[: limit - 1].rsplit(" ", 1)[0]
    return (cut or value[: limit - 1]).rstrip(",;:") + "…"


def _as_str_list(value: Any, *, limit: int = 180, max_items: int = 5) -> list[str]:
    if not value:
        return []
    items = [value] if isinstance(value, str) else list(value) if isinstance(value, list) else [value]
    out: list[str] = []
    for item in items:
        text = _clamp(_as_str(item), limit)
        if text and text not in out:
            out.append(text)
        if len(out) >= max_items:
            break
    return out


def _normalize_mistake(item: Any) -> dict[str, Any]:
    if not isinstance(item, dict):
        text = _as_str(item)
        return {
            "mistake_type": "grammar",
            "original": text,
            "correction": text,
            "explanation": "",
            "related_rule": None,
            "source_ref": None,
        }
    return {
        "mistake_type": _as_str(item.get("mistake_type")) or "grammar",
        "original": _as_str(item.get("original")),
        "correction": _as_str(item.get("correction")),
        "explanation": _clamp(item.get("explanation"), MAX_EXPLANATION),
        "related_rule": _clamp(item.get("related_rule"), MAX_RELATED_RULE),
        "source_ref": _clamp(item.get("source_ref"), 120),
    }


def normalize_grammar_result(result: dict[str, Any], fallback_text: str) -> dict[str, Any]:
    return {
        **result,
        "mistakes": [_normalize_mistake(m) for m in (result.get("mistakes") or [])],
        "honorific_mistakes": [
            _normalize_mistake(m) for m in (result.get("honorific_mistakes") or [])
        ],
        "corrected_version": _as_str(result.get("corrected_version")) or fallback_text,
        "related_rules": _as_str_list(result.get("related_rules"), limit=MAX_LIST_ITEM),
        "practice_questions": _as_str_list(
            result.get("practice_questions"), limit=MAX_LIST_ITEM, max_items=4
        ),
        "retrieved_sources": result.get("retrieved_sources") or [],
    }


async def run_grammar(session: AsyncSession, text: str) -> dict[str, Any]:
    retriever = get_retriever()
    # Prefer handbook pages about particles / questions when query is short
    query = text
    if len(text.strip()) < 40:
        query = f"{text}\nTibetan question particle སམ grammar"
    retrieved = await retriever.retrieve_grammar(session, query, top_k=4)
    llm = get_llm()
    result = llm.complete_json(
        prompts.grammar_system(),
        prompts.grammar_user(text, retrieved),
        max_tokens=2500,
        retries=1,
    )
    result["retrieved_sources"] = [
        {
            "page_number": r.get("page_number"),
            "title": r.get("title"),
            "source_name": r.get("source_name"),
            "score": float(r["score"]) if r.get("score") is not None else None,
            "excerpt": (r.get("content") or "")[:400],
        }
        for r in retrieved
    ]
    result.setdefault("mistakes", [])
    result.setdefault("honorific_mistakes", [])
    result.setdefault("corrected_version", text)
    result.setdefault("related_rules", [])
    result.setdefault("practice_questions", [])
    return normalize_grammar_result(result, text)
