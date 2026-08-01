"""Daily Practice Agent — adaptive, mistake-driven exercise generation."""

from __future__ import annotations

import re
from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm

_BLANK_RE = re.compile(r"_{3,}")


def _as_plain(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(_as_plain(v) for v in value if v is not None)
    if isinstance(value, dict):
        for key in ("text", "label", "value", "answer"):
            if key in value and value[key] is not None:
                return str(value[key])
        return str(next(iter(value.values()), ""))
    return str(value).strip()


def _strip_punct(text: str) -> str:
    return re.sub(r"[།་༌\s\.\,\!\?]+$", "", (text or "").strip())


def sanitize_fill_blank_prompt(prompt: str, options: list[Any], answer: Any) -> str:
    """
    Remove leaked answer/option text after (or before) the blank marker.

    BAD:  ང་ལ་དཔེ་ཆ་མང་པོ་_______འདུག
    GOOD: ང་ལ་དཔེ་ཆ་མང་པོ་_______།
    """
    text = (prompt or "").strip()
    if not text or not _BLANK_RE.search(text):
        return text

    leak_candidates: list[str] = []
    ans = _strip_punct(_as_plain(answer))
    if ans:
        leak_candidates.append(ans)
    for opt in options or []:
        o = _strip_punct(_as_plain(opt))
        if o and o not in leak_candidates:
            leak_candidates.append(o)
    # Common copula/existential leftovers Melong glues after blanks
    for common in ("ཡོད", "འདུག", "ཡིན", "རེད", "ཡོད་རེད", "གི་ཡོད", "གི་ཡིན"):
        if common not in leak_candidates:
            leak_candidates.append(common)

    # Prefer longer leaks first so ཡོད་རེད beats ཡོད
    leak_candidates.sort(key=len, reverse=True)

    def _clean_side(side: str, *, after: bool) -> str:
        s = side
        changed = True
        while changed and s:
            changed = False
            trimmed = s.strip()
            for leak in leak_candidates:
                if after and trimmed.startswith(leak):
                    s = trimmed[len(leak) :]
                    changed = True
                    break
                if not after and trimmed.endswith(leak):
                    s = trimmed[: -len(leak)]
                    changed = True
                    break
        return s

    parts = _BLANK_RE.split(text, maxsplit=1)
    if len(parts) != 2:
        return text
    before, after = parts
    before = _clean_side(before, after=False)
    after = _clean_side(after, after=True)
    # Keep a single closing shad if the sentence had trailing punctuation intent
    after_stripped = after.lstrip("་༌ ").strip()
    if after_stripped and after_stripped[0] in "།༎༏༐༑":
        after = after_stripped
    else:
        # Drop leftover junk after blank; keep at most a shad
        after = "།" if (after_stripped == "" and text.rstrip().endswith(("།", "༎"))) else (
            after_stripped if after_stripped.startswith("།") else ""
        )
        if not after and not before.rstrip().endswith("།"):
            after = "།"

    blank = "______"
    rebuilt = f"{before.rstrip()}{blank}{after}"
    return rebuilt


def sanitize_practice_exercises(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize Melong practice JSON so blanks don't leak answers."""
    out = dict(payload or {})
    exercises = list(out.get("exercises") or [])
    cleaned: list[dict[str, Any]] = []
    for raw in exercises:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        etype = str(item.get("type") or "").strip().lower()
        options = item.get("options") if isinstance(item.get("options"), list) else []
        # Normalize options to plain strings
        if options:
            item["options"] = [_as_plain(o) for o in options if _as_plain(o)]
        if etype in {"fill_blank", "particle_pick", "honorific_choice"} or (
            "______" in _as_plain(item.get("prompt")) or "___" in _as_plain(item.get("prompt"))
        ):
            item["prompt"] = sanitize_fill_blank_prompt(
                _as_plain(item.get("prompt")),
                item.get("options") or [],
                item.get("answer"),
            )
        cleaned.append(item)
    out["exercises"] = cleaned
    return out


async def run_practice(
    mistakes: list[dict[str, Any]],
    progress: dict[str, Any],
    focus: str | None = None,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    llm = get_llm()
    result = await llm.complete_json_async(
        prompts.practice_system(),
        prompts.practice_user(mistakes, progress, focus, profile),
        temperature=0.5,
    )
    result.setdefault("title", "Today's Practice")
    result.setdefault("focus_areas", [])
    result.setdefault("exercises", [])
    return sanitize_practice_exercises(result)
