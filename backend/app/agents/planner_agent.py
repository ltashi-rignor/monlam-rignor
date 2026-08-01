"""Planner Agent — generates personalized week-by-week learning roadmaps."""

from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import HTTPException

from app.agents.fallback_roadmap import build_fallback_roadmap
from app.services import prompt_manager as prompts
from app.services.llm import get_llm, melong_is_rate_limited

logger = logging.getLogger(__name__)

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


def _valid_roadmap(roadmap: Any) -> bool:
    if not isinstance(roadmap, dict):
        return False
    weeks = roadmap.get("weeks")
    if not isinstance(weeks, list) or not weeks:
        return False
    for week in weeks:
        if not isinstance(week, dict):
            return False
        lessons = week.get("lessons")
        if not isinstance(lessons, list) or not lessons:
            return False
    return True


async def run_planner(profile: dict[str, Any]) -> dict[str, Any]:
    if melong_is_rate_limited():
        logger.warning("Melong rate-limited — using offline roadmap with games")
        return build_fallback_roadmap(profile)

    try:
        llm = get_llm()
        roadmap = llm.complete_json(
            prompts.planner_system(),
            prompts.planner_user(profile),
            max_tokens=8192,
            retries=0,
        )
        if isinstance(roadmap, dict) and _roadmap_has_english(roadmap):
            try:
                converted = llm.complete_json(
                    prompts.planner_tibetanize_system(),
                    prompts.planner_tibetanize_user(roadmap),
                    max_tokens=8192,
                    retries=0,
                )
                if isinstance(converted, dict):
                    roadmap = converted
            except Exception as exc:
                logger.warning("Tibetanize pass failed, keeping original: %s", exc)

        if _valid_roadmap(roadmap):
            return roadmap

        logger.warning("Melong roadmap invalid — using offline fallback")
        return build_fallback_roadmap(profile)
    except Exception as exc:
        detail = str(getattr(exc, "detail", exc))
        logger.warning("Planner Melong failed (%s) — using offline roadmap", detail[:200])
        if isinstance(exc, HTTPException) and exc.status_code not in {429, 502, 503}:
            # Missing API key etc. — still serve offline plan so app works
            if "MONLAM_API_KEY" not in detail and "API key" not in detail:
                pass
        return build_fallback_roadmap(profile)
