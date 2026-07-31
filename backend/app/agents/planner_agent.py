"""Planner Agent — generates personalized week-by-week learning roadmaps."""

from __future__ import annotations

from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm


async def run_planner(profile: dict[str, Any]) -> dict[str, Any]:
    llm = get_llm()
    return llm.complete_json(
        prompts.planner_system(),
        prompts.planner_user(profile),
        max_tokens=8192,
        retries=1,
    )
