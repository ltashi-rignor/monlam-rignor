"""Progress Agent — maintains the longitudinal skill / learning graph."""

from __future__ import annotations

from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm


async def run_progress_update(
    activity: dict[str, Any],
    previous: dict[str, Any],
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    llm = get_llm()
    result = await llm.complete_json_async(
        prompts.progress_system(),
        prompts.progress_user(activity, previous, profile),
    )
    for key in (
        "grammar_score",
        "writing_score",
        "reading_score",
        "speaking_score",
        "vocabulary_score",
    ):
        result.setdefault(key, previous.get(key, 0))
    result.setdefault("learning_graph", {})
    return result
