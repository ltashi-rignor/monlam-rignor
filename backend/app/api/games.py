"""Games API — Melong-generated content for kid vocabulary games."""

from __future__ import annotations

import re
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.security import get_current_user_id
from app.services.llm import get_llm

router = APIRouter(prefix="/games", tags=["games"])

THEMES = {
    "all": "everyday beginner Tibetan for kids (mixed topics)",
    "animals": "animals kids know",
    "family": "family members",
    "nature": "nature: sun, moon, water, mountain, flower, star",
    "food": "food and drink",
    "greetings": "simple greetings and polite words",
    "numbers": "numbers one through ten",
}

# Used only if Melong is unavailable — keep short.
_FALLBACK: dict[str, list[dict[str, str]]] = {
    "animals": [
        {"tibetan": "ཁྱི", "english": "dog", "wylie": "khyi"},
        {"tibetan": "ཞི་མི", "english": "cat", "wylie": "zhi mi"},
        {"tibetan": "རྟ", "english": "horse", "wylie": "rta"},
        {"tibetan": "གཡག", "english": "yak", "wylie": "g.yag"},
        {"tibetan": "བྱ", "english": "bird", "wylie": "bya"},
    ],
    "family": [
        {"tibetan": "ཨ་མ", "english": "mother", "wylie": "a ma"},
        {"tibetan": "ཨ་པ", "english": "father", "wylie": "a pa"},
        {"tibetan": "བུ", "english": "son", "wylie": "bu"},
        {"tibetan": "བུ་མོ", "english": "girl", "wylie": "bu mo"},
    ],
    "nature": [
        {"tibetan": "ཆུ", "english": "water", "wylie": "chu"},
        {"tibetan": "རི", "english": "mountain", "wylie": "ri"},
        {"tibetan": "ཉི་མ", "english": "sun", "wylie": "nyi ma"},
        {"tibetan": "ཟླ་བ", "english": "moon", "wylie": "zla ba"},
        {"tibetan": "མེ་ཏོག", "english": "flower", "wylie": "me tog"},
    ],
    "food": [
        {"tibetan": "ཇ", "english": "tea", "wylie": "ja"},
        {"tibetan": "འོ་མ", "english": "milk", "wylie": "'o ma"},
        {"tibetan": "འབྲས", "english": "rice", "wylie": "'bras"},
    ],
    "greetings": [
        {"tibetan": "བཀྲ་ཤིས་བདེ་ལེགས།", "english": "hello", "wylie": "bkra shis bde legs"},
        {"tibetan": "ཐུགས་རྗེ་ཆེ།", "english": "thank you", "wylie": "thugs rje che"},
    ],
    "numbers": [
        {"tibetan": "གཅིག", "english": "one", "wylie": "gcig"},
        {"tibetan": "གཉིས", "english": "two", "wylie": "gnyis"},
        {"tibetan": "གསུམ", "english": "three", "wylie": "gsum"},
        {"tibetan": "བཞི", "english": "four", "wylie": "bzhi"},
        {"tibetan": "ལྔ", "english": "five", "wylie": "lnga"},
    ],
}


class VocabRainIn(BaseModel):
    theme: str = "animals"
    count: int = Field(default=14, ge=8, le=20)
    difficulty: Literal["easy", "medium"] = "easy"


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
    # unique preserve order
    seen: set[str] = set()
    uniq: list[str] = []
    for a in out:
        if a not in seen:
            seen.add(a)
            uniq.append(a)
    return uniq


def _normalize_words(raw: Any, theme: str, count: int) -> list[VocabWordOut]:
    items = raw
    if isinstance(raw, dict):
        items = raw.get("words") or raw.get("items") or []
    if not isinstance(items, list):
        return []

    words: list[VocabWordOut] = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        tibetan = str(item.get("tibetan") or item.get("bo") or "").strip()
        english = str(item.get("english") or item.get("en") or item.get("meaning") or "").strip()
        wylie = str(item.get("wylie") or item.get("latin") or "").strip()
        if not tibetan or not english or not _has_tibetan(tibetan):
            continue
        extra = item.get("answers") if isinstance(item.get("answers"), list) else []
        answers = _answers_for(english, wylie, extra)
        if not answers:
            continue
        # Prefer short typeable English as primary label
        primary = answers[0]
        words.append(
            VocabWordOut(
                id=f"ai-{theme}-{i}-{abs(hash(tibetan)) % 100000}",
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


def _fallback_words(theme: str, count: int) -> list[VocabWordOut]:
    key = theme if theme in _FALLBACK else "nature"
    base = list(_FALLBACK.get(key) or [])
    if theme == "all":
        base = [w for group in _FALLBACK.values() for w in group]
    # cycle if needed
    out: list[VocabWordOut] = []
    i = 0
    while len(out) < count and base:
        item = base[i % len(base)]
        answers = _answers_for(item["english"], item.get("wylie", ""))
        out.append(
            VocabWordOut(
                id=f"fb-{theme}-{len(out)}",
                tibetan=item["tibetan"],
                english=answers[0] if answers else item["english"],
                wylie=item.get("wylie", ""),
                answers=answers,
                theme=theme,
            )
        )
        i += 1
        if i > count * 3:
            break
    return out


@router.post("/vocab-rain", response_model=VocabRainOut)
def generate_vocab_rain(
    body: VocabRainIn,
    _user_id: UUID = Depends(get_current_user_id),
):
    theme = body.theme if body.theme in THEMES or body.theme == "all" else "animals"
    topic = THEMES.get(theme, THEMES["animals"])
    level = "very easy single words kids can type" if body.difficulty == "easy" else "simple words and short phrases"

    system = (
        "You generate Tibetan vocabulary for a children's typing game. "
        "Return JSON only with key 'words': an array of objects. "
        "Each object MUST have: tibetan (Tibetan script), english (short English kids can type), "
        "wylie (Extended Wylie), answers (array of 1-3 acceptable English type-ins, lowercase). "
        "Rules: real standard Tibetan only; english answers must be simple (one or two words); "
        "no sentences; no honorific-only rare terms; no invented words; no markdown."
    )
    user = (
        f"Theme: {theme} ({topic}).\n"
        f"Difficulty: {level}.\n"
        f"Generate exactly {body.count} unique words for a falling-word typing game.\n"
        "Example item: "
        '{"tibetan":"ཆུ","english":"water","wylie":"chu","answers":["water"]}'
    )

    try:
        llm = get_llm()
        data = llm.complete_json(system, user, max_tokens=2048, temperature=0.55, retries=1)
        words = _normalize_words(data, theme, body.count)
        if len(words) >= max(6, body.count // 2):
            return VocabRainOut(theme=theme, words=words[: body.count], source="ai")
    except Exception:
        # Fall through to static pack so the game still works offline / on LLM errors.
        pass

    return VocabRainOut(
        theme=theme,
        words=_fallback_words(theme, body.count),
        source="fallback",
    )
