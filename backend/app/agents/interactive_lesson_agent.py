"""Generate interactive lessons from the personalized learning roadmap."""

from __future__ import annotations

import hashlib
import re
from typing import Any

from fastapi import HTTPException

from app.agents.lesson_content_bank import get_content_version, get_lesson_bank, pick_theme
from app.services import prompt_manager as prompts
from app.services.llm import get_llm, melong_is_rate_limited


def lesson_needs_refresh(body: dict[str, Any] | None) -> bool:
    """True when cached interactive lesson is thin / outdated curated content."""
    if not isinstance(body, dict):
        return True
    try:
        ver = int(body.get("content_version") or 0)
    except (TypeError, ValueError):
        ver = 0
    if ver < get_content_version():
        return True
    words = body.get("words") if isinstance(body.get("words"), list) else []
    dialogue = body.get("dialogue") if isinstance(body.get("dialogue"), list) else []
    quiz = body.get("quiz") if isinstance(body.get("quiz"), list) else []
    notes = str(body.get("notes") or "")
    return len(words) < 5 or len(dialogue) < 4 or len(quiz) < 2 or len(notes) < 40


def _seed_offset(lesson_id: str) -> int:
    digest = hashlib.md5(lesson_id.encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def build_fallback_interactive_lesson(
    *,
    lesson_id: str,
    week_number: int,
    lesson_type: str,
    fallback_title: str,
    roadmap_lesson: dict[str, Any] | None = None,
    week_meta: dict[str, Any] | None = None,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Rich curated offline lesson matched to path topic + learner interests."""
    roadmap_lesson = roadmap_lesson or {}
    week_meta = week_meta or {}
    profile = profile or {}

    title = str(roadmap_lesson.get("title") or fallback_title or "སློབ་ཚན།")
    content = str(roadmap_lesson.get("content") or "")
    focus_hint = str(week_meta.get("focus") or content or title)
    interests = profile.get("interests") or []
    motivations = profile.get("motivations") or []
    goals = profile.get("goals") or []
    likes = str(profile.get("likes") or "") or ", ".join(interests)
    favorites = str(profile.get("favorites") or "") or ", ".join(motivations)
    name = str(profile.get("name") or "").strip()
    level_hint = str(profile.get("derived_level") or "")

    theme = pick_theme(
        " ".join(
            [
                title,
                content,
                focus_hint,
                likes,
                favorites,
                " ".join(goals),
                " ".join(interests),
                " ".join(motivations),
                lesson_type or "",
                level_hint,
            ]
        )
    )
    bank_all = get_lesson_bank()
    bank = dict(bank_all.get(theme) or bank_all.get("default") or {})
    # Slight rotation of quiz option order by lesson id for variety
    offset = _seed_offset(lesson_id)

    words_raw = list(bank.get("words") or [])
    if words_raw:
        rot = offset % len(words_raw)
        words_raw = words_raw[rot:] + words_raw[:rot]

    words = []
    for i, w in enumerate(words_raw[:6]):
        words.append(
            {
                "id": f"w{i + 1}",
                "tibetan": w.get("tibetan") or "",
                "wylie": w.get("wylie") or "",
                "english": w.get("english") or "",
                "example": w.get("example") or "",
                "example_en": w.get("example_en") or "",
            }
        )

    dialogue = []
    for line in bank.get("dialogue") or []:
        dialogue.append(
            {
                "speaker": str(line.get("speaker") or "A").upper(),
                "tibetan": line.get("tibetan") or "",
                "wylie": line.get("wylie") or "",
                "english": line.get("english") or "",
            }
        )

    quiz = []
    for i, item in enumerate((bank.get("quiz") or [])[:3]):
        opts = list(item.get("options") or [])
        answer = int(item.get("answer") or 0)
        if len(opts) >= 2:
            r = (offset + i) % len(opts)
            opts = opts[r:] + opts[:r]
            answer = (answer - r) % len(opts)
        quiz.append(
            {
                "q": item.get("q") or "",
                "options": opts,
                "answer": answer,
                "highlight": item.get("highlight") or "",
            }
        )

    personal = f"{name}་ལགས། " if name else ""
    interest = likes or favorites
    interest_note = (
        f" ཁྱེད་ཀྱི་དགའ་པོ་{interest}་དང་མཉམ་དུ་སྦྱངས་ན་དྲན་པ་སླ་།"
        if interest
        else ""
    )
    notes = str(bank.get("notes") or "")
    if personal or interest_note:
        notes = f"{personal}{notes}{interest_note}"

    tibetan_title = str(bank.get("tibetan_title") or title)
    if not re.search(r"[\u0F00-\u0FFF]", title):
        display_title = tibetan_title
    else:
        display_title = title

    return {
        "title": display_title,
        "tibetan_title": tibetan_title if re.search(r"[\u0F00-\u0FFF]", tibetan_title) else display_title,
        "focus": str(bank.get("focus") or focus_hint),
        "level": str(bank.get("level") or "འགོ་འཛུགས།"),
        "minutes": int(bank.get("minutes") or 12),
        "words": words,
        "dialogue": dialogue,
        "notes": notes,
        "quiz": quiz,
        "generated": False,
        "offline": True,
        "theme": theme,
        "content_version": get_content_version(),
    }


def _normalize_words(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    items = raw if isinstance(raw, list) else []
    for i, item in enumerate(items[:8]):
        if not isinstance(item, dict):
            continue
        tibetan = str(item.get("tibetan") or "").strip()
        if not tibetan:
            continue
        out.append(
            {
                "id": str(item.get("id") or f"w{i + 1}"),
                "tibetan": tibetan,
                "wylie": str(item.get("wylie") or ""),
                "english": str(item.get("english") or ""),
                "example": str(item.get("example") or ""),
                "example_en": str(item.get("example_en") or ""),
            }
        )
    return out


def _normalize_dialogue(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        speaker = str(item.get("speaker") or "A").upper()
        if speaker not in {"A", "B"}:
            speaker = "A"
        tibetan = str(item.get("tibetan") or "").strip()
        if not tibetan:
            continue
        out.append(
            {
                "speaker": speaker,
                "tibetan": tibetan,
                "wylie": str(item.get("wylie") or ""),
                "english": str(item.get("english") or ""),
            }
        )
    return out[:8]


def _normalize_quiz(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        options = item.get("options") or []
        if not isinstance(options, list):
            options = []
        opts = [str(o) for o in options[:4]]
        while len(opts) < 4:
            opts.append("—")
        try:
            answer = int(item.get("answer", 0))
        except (TypeError, ValueError):
            answer = 0
        answer = max(0, min(3, answer))
        q = str(item.get("q") or "")
        highlight = str(item.get("highlight") or "").strip()
        if not highlight:
            m = re.search(r"[「『\"'“‘]([^」』\"'”’]+)[」』\"'”’]", q)
            if m:
                highlight = m.group(1).strip()
        if highlight:
            q = re.sub(
                r"[「『\"'“‘]" + re.escape(highlight) + r"[」』\"'”’]",
                highlight,
                q,
            )
        q = re.sub(r"[「『\"'“‘]\s*[」』\"'”’]", "", q)
        entry = {"q": q, "options": opts, "answer": answer}
        if highlight:
            entry["highlight"] = highlight
        out.append(entry)
    return out[:4]


def normalize_interactive_lesson(
    raw: dict[str, Any],
    *,
    lesson_id: str,
    week_number: int,
    lesson_type: str,
    fallback_title: str,
    roadmap_lesson: dict[str, Any] | None = None,
    week_meta: dict[str, Any] | None = None,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    minutes = raw.get("minutes")
    try:
        minutes = int(minutes)
    except (TypeError, ValueError):
        minutes = 12
    minutes = max(8, min(20, minutes))

    words = _normalize_words(raw.get("words"))
    dialogue = _normalize_dialogue(raw.get("dialogue"))
    quiz = _normalize_quiz(raw.get("quiz"))
    notes = str(raw.get("notes") or "").strip()

    thin = (
        len(words) < 4
        or len(dialogue) < 4
        or len(quiz) < 2
        or len(notes) < 40
        or "མེ་ལོང་མི་འདུག" in notes
    )
    if thin:
        offline = build_fallback_interactive_lesson(
            lesson_id=lesson_id,
            week_number=week_number,
            lesson_type=lesson_type,
            fallback_title=fallback_title,
            roadmap_lesson=roadmap_lesson,
            week_meta=week_meta,
            profile=profile,
        )
        if len(words) < 4:
            words = _normalize_words(offline["words"])
        if len(dialogue) < 4:
            dialogue = _normalize_dialogue(offline["dialogue"])
        if len(quiz) < 2:
            quiz = _normalize_quiz(offline["quiz"])
        if len(notes) < 40 or "མེ་ལོང་མི་འདུག" in notes:
            notes = str(offline.get("notes") or notes)
            raw = {
                **raw,
                "notes": notes,
                "focus": raw.get("focus") or offline.get("focus"),
                "tibetan_title": raw.get("tibetan_title") or offline.get("tibetan_title"),
                "title": raw.get("title") or offline.get("title"),
                "offline": True,
                "generated": False,
            }

    try:
        content_version = int(raw.get("content_version") or get_content_version())
    except (TypeError, ValueError):
        content_version = get_content_version()

    return {
        "id": lesson_id,
        "title": str(raw.get("title") or fallback_title),
        "tibetan_title": str(raw.get("tibetan_title") or raw.get("title") or fallback_title),
        "focus": str(raw.get("focus") or ""),
        "level": str(raw.get("level") or "འགོ་འཛུགས།"),
        "minutes": minutes,
        "week_number": week_number,
        "lesson_type": lesson_type or "lesson",
        "words": words,
        "dialogue": dialogue,
        "notes": notes,
        "quiz": quiz,
        "generated": bool(raw.get("generated", True)),
        "offline": bool(raw.get("offline", False)),
        "content_version": content_version,
        "theme": str(raw.get("theme") or ""),
    }


async def run_interactive_lesson(
    profile: dict[str, Any],
    roadmap_lesson: dict[str, Any],
    week_meta: dict[str, Any],
    *,
    timeout: float = 35.0,
    max_tokens: int = 2200,
) -> dict[str, Any]:
    if melong_is_rate_limited():
        raise HTTPException(
            status_code=502,
            detail="Monlam Melong error (429): Organization rate limit exceeded",
        )
    llm = get_llm()
    result = await llm.complete_json_async(
        prompts.interactive_lesson_system(),
        prompts.interactive_lesson_user(profile, roadmap_lesson, week_meta),
        max_tokens=max_tokens,
        retries=0,
        timeout=timeout,
    )
    if not isinstance(result, dict):
        result = {}
    return result


def is_melong_unavailable(exc: BaseException) -> bool:
    if isinstance(exc, HTTPException):
        detail = str(exc.detail or "").lower()
        return (
            exc.status_code in {429, 502, 503}
            or "429" in detail
            or "rate limit" in detail
            or "melong" in detail
        )
    return False
