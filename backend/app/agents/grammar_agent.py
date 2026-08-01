"""Grammar Agent — V1 simple case/copula checks (not complex sentence grammar)."""

from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import prompt_manager as prompts

logger = logging.getLogger(__name__)

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


def _norm_compare(text: str) -> str:
    """Compare Tibetan ignoring spaces, tsheg/shad, brackets, and other punctuation."""
    cleaned = _as_str(text)
    # Drop whitespace + Tibetan punctuation + common brackets/ornaments (not letters).
    cleaned = re.sub(
        r"[\s"
        r"་༌།༎༏༐༑༔༴༸"
        r"\u0f0d-\u0f14"
        r"\.\,\!\?\;\:\"\'\“\”\‘\’…"
        r"\(\)\[\]\{\}༼༽«»‹›<>|/\\_"
        r"\-\—\–]+",
        "",
        cleaned,
    )
    return cleaned


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


def _is_real_mistake(item: dict[str, Any]) -> bool:
    original = _as_str(item.get("original")).strip()
    correction = _as_str(item.get("correction")).strip()
    if not original or not correction:
        return False
    # Ignore ། vs ་, brackets, spacing-only "fixes"
    return _norm_compare(original) != _norm_compare(correction)


def _dedupe_mistakes(items: list[dict[str, Any]], *, max_items: int = 6) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for item in items:
        if not _is_real_mistake(item):
            continue
        key = (_norm_compare(item["original"]), _norm_compare(item["correction"]))
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= max_items:
            break
    return out


_DEFAULT_CLEAN_PRAISE = "ཡི་གེ་འདི་བརྡ་སྤྲོད་ཐད་ནས་ནོར་འཁྲུལ་མེད། ཡག་པོ་བྲིས་འདུག"


def _change_score(original: str, correction: str) -> int:
    """Rough count of how much the correction rewrites the original."""
    o = _norm_compare(original)
    c = _norm_compare(correction)
    if not o:
        return 0
    # Shared prefix/suffix heuristic + length delta
    shared = 0
    for a, b in zip(o, c):
        if a != b:
            break
        shared += 1
    return abs(len(o) - len(c)) + (len(o) - shared)


def _clean_mistake_dicts(items: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        original = _as_str(item.get("original")).strip()
        correction = _as_str(item.get("correction")).strip()
        if not original or not correction:
            continue
        if _norm_compare(original) == _norm_compare(correction):
            continue
        out.append(item)
    return out


def merge_grammar_mistakes(
    rule_mistakes: list[dict[str, Any]],
    llm_mistakes: list[dict[str, Any]],
    *,
    llm_primary: bool,
) -> list[dict[str, Any]]:
    """
    Merge rule + LLM findings.
    When llm_primary: Claude/Melong spans win on overlap if fuller;
    non-overlapping rule misses are still added.
    """
    rules = _clean_mistake_dicts(rule_mistakes)
    llm = _clean_mistake_dicts(llm_mistakes)

    if llm_primary and llm:
        primary, secondary = llm, rules
    else:
        primary, secondary = rules, llm

    merged: list[dict[str, Any]] = list(primary)
    spans: list[str] = [(m.get("original") or "").strip() for m in merged]

    for item in secondary:
        original = (item.get("original") or "").strip()
        correction = (item.get("correction") or "").strip()
        if not original or not correction:
            continue
        overlap_idxs = [
            i
            for i, s in enumerate(spans)
            if s and (original in s or s in original)
        ]
        if not overlap_idxs:
            merged.append(item)
            spans.append(original)
            continue

        for i in overlap_idxs:
            existing = merged[i]
            e_orig = (existing.get("original") or "").strip()
            e_corr = (existing.get("correction") or "").strip()
            # Secondary has a strictly longer span that contains the primary span.
            if len(original) > len(e_orig) and e_orig in original:
                merged[i] = item
                spans[i] = original
            elif original == e_orig and _norm_compare(correction) != _norm_compare(e_corr):
                # Same span: prefer the correction that rewrites more (e.g. བས+རེད).
                if _change_score(original, correction) > _change_score(e_orig, e_corr):
                    merged[i] = item
                    spans[i] = original
            # else keep primary (already present)

    return merged


def normalize_grammar_result(result: dict[str, Any], fallback_text: str) -> dict[str, Any]:
    mistakes = _dedupe_mistakes(
        [_normalize_mistake(m) for m in (result.get("mistakes") or [])],
        max_items=12,
    )
    # V1: honorific checks disabled
    honorifics: list[dict[str, Any]] = []

    corrected = _as_str(result.get("corrected_version")) or fallback_text
    # Full-text "correction" that only changes punctuation is not a real edit.
    if _norm_compare(corrected) == _norm_compare(fallback_text):
        corrected = fallback_text

    clean = not mistakes and not honorifics
    if clean:
        corrected = fallback_text
        related_rules: list[str] = []
        practice: list[str] = []
        summary = None
        praise = _clamp(result.get("praise"), 180) or _DEFAULT_CLEAN_PRAISE
    else:
        related_rules = _as_str_list(result.get("related_rules"), limit=MAX_LIST_ITEM)
        practice = _as_str_list(
            result.get("practice_questions"), limit=MAX_LIST_ITEM, max_items=4
        )
        summary = _clamp(result.get("summary"), 220)
        praise = _clamp(result.get("praise"), 180)

    return {
        **result,
        "mistakes": mistakes,
        "honorific_mistakes": honorifics,
        "corrected_version": corrected,
        "related_rules": related_rules,
        "practice_questions": practice,
        "retrieved_sources": result.get("retrieved_sources") or [],
        "summary": summary,
        "praise": praise,
    }


async def run_grammar(
    session: AsyncSession,
    text: str,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """V1: Claude primary (when available) + rule scan for gaps."""
    from app.agents.simple_grammar_check import (
        apply_simple_corrections,
        scan_simple_mistakes,
    )
    from app.rag.retriever import get_retriever
    from app.services.claude_llm import claude_configured, get_grammar_llm

    rule_mistakes = scan_simple_mistakes(text, max_items=14)

    retrieved: list[dict[str, Any]] = []
    try:
        retrieved = await get_retriever().retrieve_grammar(session, text, top_k=4)
    except Exception:
        retrieved = []

    llm_mistakes: list[dict[str, Any]] = []
    praise = None
    summary = None
    related_from_llm: list[str] = []
    llm_corrected = ""
    provider = "rules"
    llm_ok = False
    try:
        llm = get_grammar_llm()
        used_provider = (
            "claude"
            if claude_configured() and llm.__class__.__name__.startswith("Claude")
            else "melong"
        )
        llm_result = await llm.complete_json_async(
            prompts.grammar_system(),
            prompts.grammar_user(text, retrieved, profile),
            max_tokens=3500,
            temperature=0.1,
            retries=1,
            timeout=120.0,
        )
        llm_mistakes = list(llm_result.get("mistakes") or [])
        praise = llm_result.get("praise")
        summary = llm_result.get("summary")
        related_from_llm = [
            str(r).strip()
            for r in (llm_result.get("related_rules") or [])
            if str(r).strip()
        ]
        llm_corrected = (llm_result.get("corrected_version") or "").strip()
        llm_ok = bool(llm_mistakes) or (
            bool(llm_corrected) and _norm_compare(llm_corrected) != _norm_compare(text)
        )
        provider = used_provider
    except Exception as exc:
        logger.warning("Grammar LLM failed (%s); using rule scan only", exc)
        provider = "rules"

    merged = merge_grammar_mistakes(
        rule_mistakes,
        llm_mistakes,
        llm_primary=llm_ok,
    )

    if llm_corrected and _norm_compare(llm_corrected) != _norm_compare(text):
        # Apply only rule fixes Claude left behind (original still present).
        remaining_rules = [
            m
            for m in rule_mistakes
            if (m.get("original") or "") and (m.get("original") or "") in llm_corrected
        ]
        corrected = apply_simple_corrections(llm_corrected, remaining_rules)
    else:
        corrected = apply_simple_corrections(text, merged)

    related: list[str] = []
    for m in merged:
        rule = (m.get("related_rule") or "").strip()
        if rule and rule not in related:
            related.append(rule)
        if len(related) >= 5:
            break
    for rule in related_from_llm:
        if rule not in related:
            related.append(rule)
        if len(related) >= 5:
            break

    result = {
        "mistakes": merged,
        "honorific_mistakes": [],
        "corrected_version": corrected,
        "related_rules": related,
        "practice_questions": [],
        "summary": summary,
        "praise": praise,
        "retrieved_sources": [
            {
                "page_number": None,
                "title": f"V1 grammar ({provider}) — རྣམ་དབྱེ + ཡིན/རེད/ཡོད/འདུག",
                "source_name": "simple-grammar-rules",
                "score": 1.0,
                "excerpt": (
                    "Claude primary when configured; rules fill gaps "
                    "(case + evidentiality + role)"
                ),
            }
        ],
    }
    if merged and not praise:
        result["praise"] = (
            "འགའ་ཤས་བཅོས་དགོས་པ་འདུག གཤམ་གྱི་ཕྲད་དང་ཡིན་རེད་ཡོད་འདུག་ལ་གཟིགས།"
        )
    return normalize_grammar_result(result, text)
