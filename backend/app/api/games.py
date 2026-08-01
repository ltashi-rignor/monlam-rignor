"""Games API — Melong-generated content for kid vocabulary games."""

from __future__ import annotations

import random
import re
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.rate_limit import rate_limit_llm
from app.core.security import get_current_user_id
from app.content.loader import load_yaml
from app.services.llm import get_llm, melong_is_rate_limited

router = APIRouter(prefix="/games", tags=["games"])


def _vocab_data() -> dict[str, Any]:
    return load_yaml("vocab_rain")


def get_theme_prompts() -> dict[str, str]:
    raw = _vocab_data().get("theme_prompts") or {}
    return {str(k): str(v) for k, v in raw.items()} if isinstance(raw, dict) else {}


def get_fallback_packs() -> dict[str, list[dict[str, str]]]:
    raw = _vocab_data().get("packs") or {}
    out: dict[str, list[dict[str, str]]] = {}
    if isinstance(raw, dict):
        for theme, words in raw.items():
            if not isinstance(words, list):
                continue
            out[str(theme)] = [
                {
                    "tibetan": str(w.get("tibetan") or ""),
                    "english": str(w.get("english") or ""),
                    "wylie": str(w.get("wylie") or ""),
                }
                for w in words
                if isinstance(w, dict) and w.get("tibetan")
            ]
    return out


# Back-compat names used inside this module
THEMES = get_theme_prompts()
_FALLBACK = get_fallback_packs()


class VocabRainIn(BaseModel):
    theme: str = "animals"
    count: int = Field(default=28, ge=12, le=40)
    difficulty: Literal["easy", "medium"] = "easy"
    # Optional seeds the model should avoid repeating
    exclude: list[str] = Field(default_factory=list, max_length=40)


class VocabWordOut(BaseModel):
    id: str
    tibetan: str
    english: str
    wylie: str = ""
    answers: list[str] = Field(default_factory=list)
    theme: str = "all"


class VocabRainOut(BaseModel):
    theme: str
    words: list[VocabWordOut]
    source: Literal["ai", "fallback"] = "ai"


def _has_tibetan(text: str) -> bool:
    return bool(re.search(r"[\u0F00-\u0FFF]", text or ""))


def _norm_answer(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _answers_for(english: str, wylie: str, extra: list[Any] | None = None) -> list[str]:
    out: list[str] = []
    for part in re.split(r"[/|,;]", english or ""):
        n = _norm_answer(part)
        if n:
            out.append(n)
    full = _norm_answer(english)
    if full:
        out.append(full)
    wy = _norm_answer(wylie)
    if wy:
        out.append(wy)
    for item in extra or []:
        n = _norm_answer(str(item))
        if n:
            out.append(n)
    seen: set[str] = set()
    uniq: list[str] = []
    for a in out:
        if a not in seen:
            seen.add(a)
            uniq.append(a)
    return uniq


def _normalize_words(raw: Any, theme: str, count: int, exclude: set[str] | None = None) -> list[VocabWordOut]:
    items = raw
    if isinstance(raw, dict):
        items = raw.get("words") or raw.get("items") or []
    if not isinstance(items, list):
        return []

    exclude = exclude or set()
    words: list[VocabWordOut] = []
    seen_bo: set[str] = set()
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        tibetan = str(item.get("tibetan") or item.get("bo") or "").strip()
        english = str(item.get("english") or item.get("en") or item.get("meaning") or "").strip()
        wylie = str(item.get("wylie") or item.get("latin") or "").strip()
        if not tibetan or not english or not _has_tibetan(tibetan):
            continue
        if tibetan in seen_bo or tibetan in exclude:
            continue
        extra = item.get("answers") if isinstance(item.get("answers"), list) else []
        answers = _answers_for(english, wylie, extra)
        if not answers:
            continue
        seen_bo.add(tibetan)
        primary = answers[0]
        words.append(
            VocabWordOut(
                id=f"ai-{theme}-{abs(hash(tibetan + primary)) % 1_000_000}-{i}",
                tibetan=tibetan,
                english=primary,
                wylie=wylie,
                answers=answers,
                theme=theme,
            )
        )
        if len(words) >= count:
            break
    return words


def _fallback_words(theme: str, count: int, exclude: set[str] | None = None) -> list[VocabWordOut]:
    exclude = exclude or set()
    if theme == "all":
        base = [w for group in _FALLBACK.values() for w in group]
    else:
        base = list(_FALLBACK.get(theme) or _FALLBACK["nature"])
    random.shuffle(base)
    out: list[VocabWordOut] = []
    for item in base:
        if item["tibetan"] in exclude:
            continue
        answers = _answers_for(item["english"], item.get("wylie", ""))
        out.append(
            VocabWordOut(
                id=f"fb-{theme}-{abs(hash(item['tibetan'])) % 1_000_000}-{len(out)}",
                tibetan=item["tibetan"],
                english=answers[0] if answers else item["english"],
                wylie=item.get("wylie", ""),
                answers=answers,
                theme=theme,
            )
        )
        if len(out) >= count:
            break
    # If still short, fill from all themes
    if len(out) < count:
        extra = [w for group in _FALLBACK.values() for w in group]
        random.shuffle(extra)
        have = {w.tibetan for w in out} | exclude
        for item in extra:
            if item["tibetan"] in have:
                continue
            answers = _answers_for(item["english"], item.get("wylie", ""))
            out.append(
                VocabWordOut(
                    id=f"fb-mix-{len(out)}",
                    tibetan=item["tibetan"],
                    english=answers[0] if answers else item["english"],
                    wylie=item.get("wylie", ""),
                    answers=answers,
                    theme=theme,
                )
            )
            have.add(item["tibetan"])
            if len(out) >= count:
                break
    return out


async def _ask_melong(theme: str, topic: str, level: str, count: int, exclude: list[str]) -> list[VocabWordOut]:
    if melong_is_rate_limited():
        raise HTTPException(
            status_code=502,
            detail="Monlam Melong error (429): Organization rate limit exceeded",
        )
    system = (
        "You generate Tibetan vocabulary for a children's typing game. "
        "Return JSON only with key 'words': an array of objects. "
        "Each object MUST have: tibetan (Tibetan script), english (short English kids can type), "
        "wylie (Extended Wylie), answers (array of 1-3 acceptable English type-ins, lowercase). "
        "Rules: real standard Tibetan only; english answers must be simple (one or two words); "
        "ALL items must be unique; cover many different words in the theme; "
        "no sentences; no invented words; no markdown."
    )
    avoid = ""
    if exclude:
        avoid = "Do NOT repeat these Tibetan words: " + " · ".join(exclude[:30]) + ".\n"
    user = (
        f"Theme: {theme} ({topic}).\n"
        f"Difficulty: {level}.\n"
        f"{avoid}"
        f"Generate exactly {count} DIFFERENT unique words. Maximize variety.\n"
        "Example item: "
        '{"tibetan":"ཆུ","english":"water","wylie":"chu","answers":["water"]}'
    )
    llm = get_llm()
    data = await llm.complete_json_async(system, user, max_tokens=4096, temperature=0.85, retries=0)
    return _normalize_words(data, theme, count, exclude=set(exclude))


@router.post("/vocab-rain", response_model=VocabRainOut)
async def generate_vocab_rain(
    body: VocabRainIn,
    request: Request,
    _user_id: UUID = Depends(get_current_user_id),
):
    rate_limit_llm(request, str(_user_id))
    theme = body.theme if body.theme in THEMES or body.theme == "all" else "animals"
    topic = THEMES.get(theme, THEMES["animals"])
    level = (
        "very easy single words kids can type"
        if body.difficulty == "easy"
        else "simple words and short phrases"
    )
    exclude = [e.strip() for e in body.exclude if e and e.strip()][:40]
    want = body.count

    words: list[VocabWordOut] = []
    source: Literal["ai", "fallback"] = "fallback"

    # When Melong is known-down, skip the wait and serve offline packs immediately.
    if not melong_is_rate_limited():
        try:
            batch = await _ask_melong(theme, topic, level, want, exclude)
            words.extend(batch)
            source = "ai"
            if len(words) < max(12, want // 2):
                more_exclude = exclude + [w.tibetan for w in words]
                extra = await _ask_melong(theme, topic, level, want, more_exclude)
                seen = {w.tibetan for w in words}
                for w in extra:
                    if w.tibetan in seen:
                        continue
                    words.append(w)
                    seen.add(w.tibetan)
                    if len(words) >= want:
                        break
        except Exception:
            words = []

    if len(words) < 8:
        words = _fallback_words(theme, want, exclude=set(exclude))
        source = "fallback"
    elif len(words) < want:
        have = {w.tibetan for w in words} | set(exclude)
        for w in _fallback_words(theme, want, exclude=have):
            if w.tibetan in have:
                continue
            words.append(w)
            have.add(w.tibetan)
            if len(words) >= want:
                break

    random.shuffle(words)
    return VocabRainOut(theme=theme, words=words[:want], source=source)
