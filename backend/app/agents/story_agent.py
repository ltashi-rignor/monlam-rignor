"""Kids Story Agent — short Tibetan stories with fixed scene keys (emoji UI)."""

from __future__ import annotations

from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm

_ALLOWED = set(prompts.STORY_SCENE_KEYS)
_FALLBACK_KEYS = ("home", "friend", "play", "help", "celebration")


def _clean_names(names: list[str], count: int) -> list[str]:
    cleaned = [n.strip()[:40] for n in names if n and str(n).strip()]
    if not cleaned:
        cleaned = [f"དཔའ་བོ་{i + 1}" for i in range(max(1, count))]
    while len(cleaned) < count:
        cleaned.append(f"གྲོགས་པོ་{len(cleaned) + 1}")
    return cleaned[: max(1, min(count, 5))]


def _normalize_scenes(raw: Any, names: list[str]) -> list[dict[str, str]]:
    scenes: list[dict[str, str]] = []
    if isinstance(raw, list):
        for i, item in enumerate(raw):
            if not isinstance(item, dict):
                continue
            key = str(item.get("scene_key") or "").strip().lower()
            if key not in _ALLOWED:
                key = _FALLBACK_KEYS[i % len(_FALLBACK_KEYS)]
            text = str(item.get("text") or "").strip()
            caption = str(item.get("caption") or "").strip()
            if not text:
                continue
            scenes.append(
                {
                    "scene_key": key,
                    "caption": caption or "གནས་ཚུལ།",
                    "text": text,
                }
            )
    if len(scenes) >= 3:
        return scenes[:6]

    lead = "་".join(names[:2]) if names else "དཔའ་བོ།"
    return [
        {
            "scene_key": "home",
            "caption": "ཁྱིམ།",
            "text": f"{lead}་ནི་ཁྱིམ་དུ་སྐྱིད་པོར་འདུག",
        },
        {
            "scene_key": "friend",
            "caption": "གྲོགས་པོ།",
            "text": f"{lead}་དང་གྲོགས་པོ་ཚོ་མཉམ་དུ་རྩེད་མོ་རྩེས།",
        },
        {
            "scene_key": "help",
            "caption": "རོགས་རམ།",
            "text": f"{lead}་ཡིས་གཞན་ལ་རོགས་པ་བྱས་པས་ཚང་མ་དགའ་པོ་བྱུང་།",
        },
        {
            "scene_key": "celebration",
            "caption": "དགའ་སྟོན།",
            "text": "ཚང་མས་མཉམ་དུ་དགའ་སྤྲོ་བྱས་སོ།",
        },
    ]


async def run_kid_story(
    *,
    names: list[str],
    actions: str,
    setting: str | None = None,
    character_count: int = 2,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    count = max(1, min(int(character_count or len(names) or 2), 5))
    clean_names = _clean_names(names, count)
    actions_text = (actions or "").strip()[:500] or "མཉམ་དུ་རྩེད་མོ་རྩེ་བ།"

    try:
        llm = get_llm()
        result = await llm.complete_json_async(
            prompts.story_system(),
            prompts.story_user(
                names=clean_names,
                actions=actions_text,
                setting=setting,
                character_count=count,
                profile=profile,
            ),
            max_tokens=1800,
        )
    except Exception:
        result = {}

    if not isinstance(result, dict):
        result = {}

    title = str(result.get("title") or "").strip() or f"{clean_names[0]}་ཡི་སྒྲུང་།"
    moral = str(result.get("moral") or "").strip() or "གྲོགས་པོ་དང་མཉམ་དུ་བྱས་ན་ཡག་པོ་རེད།"
    used = result.get("characters_used")
    if not isinstance(used, list) or not used:
        used = clean_names
    else:
        used = [str(x).strip() for x in used if str(x).strip()][:5] or clean_names

    scenes = _normalize_scenes(result.get("scenes"), clean_names)
    return {
        "title": title[:120],
        "moral": moral[:240],
        "characters_used": used,
        "scenes": scenes,
    }
