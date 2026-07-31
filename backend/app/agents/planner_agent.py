"""Planner Agent — generates personalized week-by-week learning roadmaps."""

from __future__ import annotations

import re
from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm

_LATIN = re.compile(r"[A-Za-z]")
_TIBETAN = re.compile(r"[\u0F00-\u0FFF]")


def _looks_english(text: str) -> bool:
    if not text or not isinstance(text, str):
        return False
    latin = len(_LATIN.findall(text))
    tibetan = len(_TIBETAN.findall(text))
    return latin > 3 and latin >= tibetan


def _roadmap_has_english(data: Any) -> bool:
    if isinstance(data, str):
        return _looks_english(data)
    if isinstance(data, dict):
        for key, value in data.items():
            if key in {"type", "lesson_type"}:
                continue
            if _roadmap_has_english(value):
                return True
        return False
    if isinstance(data, list):
        return any(_roadmap_has_english(item) for item in data)
    return False


async def run_planner(profile: dict[str, Any]) -> dict[str, Any]:
    llm = get_llm()
    roadmap = llm.complete_json(
        prompts.planner_system(),
        prompts.planner_user(profile),
        max_tokens=8192,
        retries=1,
    )
    if isinstance(roadmap, dict) and _roadmap_has_english(roadmap):
        converted = llm.complete_json(
            prompts.planner_tibetanize_system(),
            prompts.planner_tibetanize_user(roadmap),
            max_tokens=8192,
            retries=1,
        )
        if isinstance(converted, dict):
            roadmap = converted
    return roadmap
