"""Essay Evaluation Agent — holistic scoring across five dimensions."""

from __future__ import annotations

from typing import Any

from app.services import prompt_manager as prompts
from app.services.llm import get_llm


async def run_essay_evaluation(
    text: str,
    grammar_summary: str | None = None,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    llm = get_llm()
    result = await llm.complete_json_async(
        prompts.essay_system(),
        prompts.essay_user(text, grammar_summary, profile),
    )
    for key in (
        "grammar_score",
        "vocabulary_score",
        "fluency_score",
        "naturalness_score",
        "overall_score",
    ):
        result.setdefault(key, 0)
    result.setdefault("reading_level", "unknown")
    result.setdefault("suggestions", [])
    return result
