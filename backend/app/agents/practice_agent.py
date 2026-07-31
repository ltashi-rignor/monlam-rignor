"""Daily Practice Agent — adaptive, mistake-driven exercise generation."""

from __future__ import annotations

from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm


async def run_practice(
    mistakes: list[dict[str, Any]],
    progress: dict[str, Any],
    focus: str | None = None,
) -> dict[str, Any]:
    llm = get_llm()
    result = llm.complete_json(
        prompts.practice_system(),
        prompts.practice_user(mistakes, progress, focus),
        temperature=0.5,
    )
    result.setdefault("title", "Today's Practice")
    result.setdefault("focus_areas", [])
    result.setdefault("exercises", [])
    return result
