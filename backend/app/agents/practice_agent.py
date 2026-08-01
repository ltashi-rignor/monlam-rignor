"""Daily Practice Agent — adaptive, mistake-driven exercise generation."""

from __future__ import annotations

import re
from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm

_BLANK_RE = re.compile(r"_{3,}")
_NUMBER_ORDER_RE = re.compile(
    r"^\s*\d+\s*([,，、/\|]|\s)+\s*\d+",
)
_NUMBERED_LIST_RE = re.compile(r"(?:^|\s)[1-9][\.\)]\s*\S")

_CHOICE_TYPES = {
    "fill_blank",
    "particle_pick",
    "honorific_choice",
    "correct_sentence",
    "match_word",
    "reorder_phrase",
}

# Curated drills used when Melong returns junk / too few valid items.
_BANK: list[dict[str, Any]] = [
    {
        "id": "bank1",
        "type": "particle_pick",
        "prompt": "ང་སློབ་གྲྭ་______འགྲོ།",
        "options": ["ལ", "གིས", "ནས", "དང་"],
        "answer": "ལ",
        "explanation": "ཡུལ་ལ་འགྲོ་ན་རྣམ་དབྱེ་གཉིས་པ་ལ་སྤྱོད།",
    },
    {
        "id": "bank2",
        "type": "fill_blank",
        "prompt": "ང་ལ་དེབ་མང་པོ་______།",
        "options": ["ཡོད", "འདུག", "ཡིན", "རེད"],
        "answer": "ཡོད",
        "explanation": "རང་ཉིད་ཀྱི་ཡོད་ཚད་ལ་ཡོད་སྤྱོད།",
    },
    {
        "id": "bank3",
        "type": "fill_blank",
        "prompt": "ཁོང་ནི་དགེ་རྒན་ཞིག་______།",
        "options": ["རེད", "ཡིན", "ཡོད", "འདུག"],
        "answer": "རེད",
        "explanation": "གཞན་སྐོར་གྱི་ངོ་བོ་ལ་རེད་སྤྱོད།",
    },
    {
        "id": "bank4",
        "type": "particle_pick",
        "prompt": "ཁོང་གིས་དེབ་______ཀློག་གི་འདུག",
        "options": ["འདི", "འདི་ལ", "འདི་ནས", "འདི་དང་"],
        "answer": "འདི",
        "explanation": "ལས་སྦྱོར་གྱི་ཡུལ་དུ་དངོས་པོ་དྲང་པོར་འཇོག",
    },
    {
        "id": "bank5",
        "type": "honorific_choice",
        "prompt": "དགེ་རྒན་ལགས་ལ་འདི་ལས་གང་འཚམ།",
        "options": ["ཁྱེད་རང་ག་པར་ཕེབས་ཀྱི་ཡིན།", "ཁྱོད་ག་པར་འགྲོ་གི་ཡོད།", "ཁྱོད་ག་པར་ཡོད།", "ཁྱེད་ག་རེ་ཡིན།"],
        "answer": "ཁྱེད་རང་ག་པར་ཕེབས་ཀྱི་ཡིན།",
        "explanation": "དགེ་རྒན་ལ་ཞེ་སའི་ཕེབས་སྤྱོད།",
    },
    {
        "id": "bank6",
        "type": "correct_sentence",
        "prompt": "ཚིག་འདི་བཅོས། ང་སློབ་གྲྭ་གིས་འགྲོ།",
        "options": [
            "ང་སློབ་གྲྭ་ལ་འགྲོ།",
            "ང་སློབ་གྲྭ་ནས་འགྲོ།",
            "ང་སློབ་གྲྭ་དང་འགྲོ།",
            "ང་སློབ་གྲྭ་གིས་འགྲོ།",
        ],
        "answer": "ང་སློབ་གྲྭ་ལ་འགྲོ།",
        "explanation": "ཡུལ་ལ་འགྲོ་ན་ལ་དགོས། གིས་བྱེད་པ་པོ་ཡིན།",
    },
    {
        "id": "bank7",
        "type": "match_word",
        "prompt": "「school」ཞེས་པ་བོད་སྐད་དུ་གང་ཡིན།",
        "options": ["སློབ་གྲྭ", "དགེ་རྒན།", "དེབ།", "ཁྱིམ།"],
        "answer": "སློབ་གྲྭ",
        "explanation": "school = སློབ་གྲྭ།",
    },
    {
        "id": "bank8",
        "type": "reorder_phrase",
        "prompt": "ཚིག་གཅིག་གི་དུམ་བུ་འདི་དག་གི་གོ་རིམ་བསྒྲིགས།",
        "tokens": ["སློབ་གྲྭ་ལ", "ང", "འགྲོ།"],
        "options": [
            "ང་སློབ་གྲྭ་ལ་འགྲོ།",
            "སློབ་གྲྭ་ལ་ང་འགྲོ།",
            "འགྲོ་ང་སློབ་གྲྭ་ལ།",
            "ང་འགྲོ་སློབ་གྲྭ་ལ།",
        ],
        "answer": "ང་སློབ་གྲྭ་ལ་འགྲོ།",
        "explanation": "བྱེད་པ་པོ་ → ཡུལ་ → བྱ་ཚིག",
    },
]


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


def _norm_key(text: str) -> str:
    return re.sub(r"[\s་༌།༎༏༐༑]+", "", (text or "").strip())


def sanitize_fill_blank_prompt(prompt: str, options: list[Any], answer: Any) -> str:
    """Remove leaked answer/option text after (or before) the blank marker."""
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
    for common in ("ཡོད", "འདུག", "ཡིན", "རེད", "ཡོད་རེད", "གི་ཡོད", "གི་ཡིན"):
        if common not in leak_candidates:
            leak_candidates.append(common)

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
    after_stripped = after.lstrip("་༌ ").strip()
    if after_stripped and after_stripped[0] in "།༎༏༐༑":
        after = after_stripped
    else:
        after = "།" if (after_stripped == "" and text.rstrip().endswith(("།", "༎"))) else (
            after_stripped if after_stripped.startswith("།") else ""
        )
        if not after and not before.rstrip().endswith("།"):
            after = "།"

    return f"{before.rstrip()}______{after}"


def _looks_like_bad_reorder(item: dict[str, Any], options: list[str]) -> bool:
    """Drop Melong's multi-sentence numbered ordering quizzes."""
    prompt = _as_plain(item.get("prompt"))
    if sum(1 for o in options if _NUMBER_ORDER_RE.match(o)) >= 2:
        return True
    if _NUMBERED_LIST_RE.search(prompt) and sum(ch.isdigit() for ch in "".join(options)) >= 4:
        return True
    # Options that are only digit permutations
    digitish = 0
    for o in options:
        compact = re.sub(r"[\s,，、]+", "", o)
        if compact.isdigit() and len(compact) >= 3:
            digitish += 1
    return digitish >= 2


def _dedupe_options(options: list[str], answer: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for opt in options:
        key = _norm_key(opt)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(opt)
    # Ensure answer present
    ans_key = _norm_key(answer)
    if ans_key and ans_key not in seen and answer:
        out.insert(0, answer)
    return out[:4]


def _normalize_tokens(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    tokens = [_as_plain(t) for t in raw]
    return [t for t in tokens if t]


def _validate_choice(item: dict[str, Any]) -> dict[str, Any] | None:
    etype = str(item.get("type") or "").strip().lower() or "fill_blank"
    prompt = _as_plain(item.get("prompt"))
    answer = _as_plain(item.get("answer"))
    options = [_as_plain(o) for o in (item.get("options") or []) if _as_plain(o)]
    tokens = _normalize_tokens(item.get("tokens") or item.get("items"))

    if not prompt or not answer:
        return None

    if etype == "free_write":
        return {
            "id": _as_plain(item.get("id")) or "fw",
            "type": "free_write",
            "prompt": prompt,
            "answer": answer,
            "explanation": _as_plain(item.get("explanation")),
        }

    if etype not in _CHOICE_TYPES:
        # Unknown → treat as MC if options exist, else drop
        if len(options) >= 2:
            etype = "fill_blank"
        else:
            return None

    if etype == "reorder_phrase" and _looks_like_bad_reorder(item, options):
        return None

    options = _dedupe_options(options, answer)
    if len(options) < 2:
        return None

    # Answer must match an option (normalized)
    ans_key = _norm_key(answer)
    matched = next((o for o in options if _norm_key(o) == ans_key), None)
    if not matched:
        # Try loose contains for short particles
        matched = next((o for o in options if ans_key and ans_key in _norm_key(o)), None)
    if not matched:
        return None
    answer = matched

    # Pad to 4 with bank distractors of same type when short
    if len(options) < 4:
        for bank in _BANK:
            if str(bank.get("type")) != etype:
                continue
            for bo in bank.get("options") or []:
                if _norm_key(bo) not in {_norm_key(o) for o in options}:
                    options.append(bo)
                if len(options) >= 4:
                    break
            if len(options) >= 4:
                break
    options = options[:4]

    out: dict[str, Any] = {
        "id": _as_plain(item.get("id")) or "ex",
        "type": etype,
        "prompt": prompt,
        "options": options,
        "answer": answer,
        "explanation": _as_plain(item.get("explanation")),
    }
    if etype == "reorder_phrase" and tokens:
        out["tokens"] = tokens[:6]
    if etype in {"fill_blank", "particle_pick", "honorific_choice"} or "___" in prompt:
        out["prompt"] = sanitize_fill_blank_prompt(prompt, options, answer)
    return out


def _light_clean_item(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize one exercise for API responses without dropping/replacing the set."""
    item = dict(raw)
    etype = str(item.get("type") or "").strip().lower()
    options = item.get("options") if isinstance(item.get("options"), list) else []
    if options:
        item["options"] = [_as_plain(o) for o in options if _as_plain(o)]
    tokens = _normalize_tokens(item.get("tokens") or item.get("items"))
    if tokens:
        item["tokens"] = tokens
    prompt = _as_plain(item.get("prompt"))
    answer = _as_plain(item.get("answer"))
    item["prompt"] = prompt
    item["answer"] = answer
    if etype in {"fill_blank", "particle_pick", "honorific_choice"} or "___" in prompt:
        item["prompt"] = sanitize_fill_blank_prompt(
            prompt, item.get("options") or [], answer
        )
    # Hide unscorable numbered-order junk on old sessions
    if etype == "reorder_phrase" and _looks_like_bad_reorder(item, item.get("options") or []):
        return None
    if not prompt:
        return None
    return item


def sanitize_practice_exercises(payload: dict[str, Any], *, fill_bank: bool = True) -> dict[str, Any]:
    """Normalize Melong practice JSON into valid, scorable drills."""
    out = dict(payload or {})
    exercises = list(out.get("exercises") or [])

    if not fill_bank:
        # Read path: light clean only (preserve learner progress keys).
        cleaned_light: list[dict[str, Any]] = []
        for raw in exercises:
            if not isinstance(raw, dict):
                continue
            item = _light_clean_item(raw)
            if item:
                cleaned_light.append(item)
        out["exercises"] = cleaned_light
        return out

    cleaned: list[dict[str, Any]] = []
    reorder_used = 0
    free_used = 0
    seen_prompts: set[str] = set()

    for raw in exercises:
        if not isinstance(raw, dict):
            continue
        item = _validate_choice(dict(raw))
        if not item:
            continue
        etype = item["type"]
        if etype == "reorder_phrase":
            if reorder_used >= 1:
                continue
            reorder_used += 1
        if etype == "free_write":
            if free_used >= 1:
                continue
            free_used += 1
        pkey = _norm_key(item.get("prompt") or "")
        if pkey in seen_prompts:
            continue
        seen_prompts.add(pkey)
        cleaned.append(item)

    for bank in _BANK:
        if len(cleaned) >= 8:
            break
        item = _validate_choice(dict(bank))
        if not item:
            continue
        pkey = _norm_key(item.get("prompt") or "")
        if pkey in seen_prompts:
            continue
        if item["type"] == "reorder_phrase" and reorder_used >= 1:
            continue
        if item["type"] == "free_write" and free_used >= 1:
            continue
        if item["type"] == "reorder_phrase":
            reorder_used += 1
        if item["type"] == "free_write":
            free_used += 1
        seen_prompts.add(pkey)
        cleaned.append(item)

    for i, ex in enumerate(cleaned, start=1):
        if not _as_plain(ex.get("id")) or str(ex.get("id")).startswith("bank"):
            ex["id"] = f"e{i}"
        else:
            ex["id"] = _as_plain(ex.get("id")) or f"e{i}"

    # Final sequential ids for new sets
    for i, ex in enumerate(cleaned, start=1):
        ex["id"] = f"e{i}"

    out["exercises"] = cleaned[:10]
    if not _as_plain(out.get("title")):
        out["title"] = "དེ་རིང་གི་སྦྱོང་བརྡར།"
    if not isinstance(out.get("focus_areas"), list) or not out["focus_areas"]:
        out["focus_areas"] = ["རྣམ་དབྱེ།", "ཡིན་རེད།", "ཕྲད།"]
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
        temperature=0.4,
    )
    result.setdefault("title", "དེ་རིང་གི་སྦྱོང་བརྡར།")
    result.setdefault("focus_areas", [])
    result.setdefault("exercises", [])
    return sanitize_practice_exercises(result, fill_bank=True)
