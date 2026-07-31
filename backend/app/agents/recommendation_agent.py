"""Recommendation Agent — next-best stories, videos, readings, grammar lessons."""

from __future__ import annotations

from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm


async def run_recommendations(
    history: dict[str, Any], catalog: list[dict[str, Any]]
) -> dict[str, Any]:
    llm = get_llm()
    result = llm.complete_json(
        prompts.recommendation_system(),
        prompts.recommendation_user(history, catalog),
        temperature=0.4,
    )
    result.setdefault("rationale", "")
    result.setdefault("recommendations", [])
    return result
