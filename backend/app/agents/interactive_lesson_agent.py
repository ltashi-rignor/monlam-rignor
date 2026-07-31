"""Generate interactive lessons from the personalized learning roadmap."""

from __future__ import annotations

from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm


def _normalize_words(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    items = raw if isinstance(raw, list) else []
    for i, item in enumerate(items[:6]):
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "id": str(item.get("id") or f"w{i + 1}"),
                "tibetan": str(item.get("tibetan") or ""),
                "wylie": str(item.get("wylie") or ""),
                "english": str(item.get("english") or ""),
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
        out.append(
            {
                "speaker": speaker,
                "tibetan": str(item.get("tibetan") or ""),
                "wylie": str(item.get("wylie") or ""),
                "english": str(item.get("english") or ""),
            }
        )
    return out[:6]


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
        out.append({"q": str(item.get("q") or ""), "options": opts, "answer": answer})
    return out[:3]


def normalize_interactive_lesson(
    raw: dict[str, Any],
    *,
    lesson_id: str,
    week_number: int,
    lesson_type: str,
    fallback_title: str,
) -> dict[str, Any]:
    minutes = raw.get("minutes")
    try:
        minutes = int(minutes)
    except (TypeError, ValueError):
        minutes = 10
    minutes = max(6, min(20, minutes))

    words = _normalize_words(raw.get("words"))
    dialogue = _normalize_dialogue(raw.get("dialogue"))
    quiz = _normalize_quiz(raw.get("quiz"))

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
        "notes": str(raw.get("notes") or ""),
        "quiz": quiz,
        "generated": True,
    }


async def run_interactive_lesson(
    profile: dict[str, Any],
    roadmap_lesson: dict[str, Any],
    week_meta: dict[str, Any],
) -> dict[str, Any]:
    llm = get_llm()
    result = llm.complete_json(
        prompts.interactive_lesson_system(),
        prompts.interactive_lesson_user(profile, roadmap_lesson, week_meta),
        max_tokens=3500,
        retries=1,
    )
    if not isinstance(result, dict):
        result = {}
    return result
