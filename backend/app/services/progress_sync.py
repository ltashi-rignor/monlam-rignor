"""Deterministic progress sync from practice / essays / modules."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.entities import Essay, Mistake, PracticeHistory, Progress

MODULES_KEY = "modules"


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(value)))


def practice_stats_from_rows(rows: list[PracticeHistory]) -> dict[str, Any]:
    completed = [r for r in rows if r.completed and r.score is not None]
    if not completed:
        return {
            "completed_count": 0,
            "last_score": 0.0,
            "avg_score": 0.0,
        }
    scores = [float(r.score or 0) for r in completed]
    return {
        "completed_count": len(completed),
        "last_score": round(scores[0], 1),  # rows assumed newest-first
        "avg_score": round(sum(scores) / len(scores), 1),
    }


def _module_snapshot(graph: dict[str, Any]) -> dict[str, Any]:
    modules = graph.get(MODULES_KEY) or {}
    letters = modules.get("mastered_letters") or []
    words = modules.get("mastered_words") or []
    lessons = modules.get("completed_lessons") or []
    xp = int(modules.get("xp") or 0)
    return {
        "mastered_letters": len(letters) if isinstance(letters, list) else 0,
        "mastered_words": len(words) if isinstance(words, list) else 0,
        "completed_lessons": len(lessons) if isinstance(lessons, list) else 0,
        "xp": xp,
    }


def _baseline_scores(
    *,
    practice_stats: dict[str, Any],
    essay_avg: float | None,
    mistake_count: int,
    modules: dict[str, Any],
) -> dict[str, float]:
    """Build readable skill bars from real activity when Melong has never run."""
    practice_n = int(practice_stats.get("completed_count") or 0)
    practice_avg = float(practice_stats.get("avg_score") or 0)
    letter_n = int(modules.get("mastered_letters") or 0)
    word_n = int(modules.get("mastered_words") or 0)
    lesson_n = int(modules.get("completed_lessons") or 0)
    xp = int(modules.get("xp") or 0)

    # Practice drives grammar/writing/vocab
    grammar = practice_avg * 0.7 + min(30.0, practice_n * 4.0)
    writing = practice_avg * 0.55 + min(25.0, practice_n * 3.0)
    vocabulary = min(100.0, word_n * 3.5 + practice_avg * 0.35 + min(20.0, practice_n * 2.0))
    reading = min(100.0, letter_n * 2.5 + lesson_n * 8.0 + xp * 0.05)
    speaking = min(100.0, lesson_n * 10.0 + letter_n * 1.5 + xp * 0.04)

    if essay_avg is not None:
        writing = writing * 0.5 + float(essay_avg) * 0.5
        grammar = grammar * 0.65 + float(essay_avg) * 0.35

    # Mistakes show engagement but slightly pull grammar until corrected via practice
    if mistake_count > 0 and practice_n == 0:
        grammar = max(grammar, min(25.0, mistake_count * 2.0))

    return {
        "grammar_score": round(_clamp(grammar), 1),
        "writing_score": round(_clamp(writing), 1),
        "reading_score": round(_clamp(reading), 1),
        "speaking_score": round(_clamp(speaking), 1),
        "vocabulary_score": round(_clamp(vocabulary), 1),
    }


async def sync_progress_from_activity(
    db: AsyncSession,
    user_id,
    progress: Progress | None,
) -> Progress:
    """
    Ensure Progress reflects practice + modules even without Melong refresh.
    Safe to call on every GET /progress.
    """
    if progress is None:
        progress = Progress(user_id=user_id, learning_graph={})
        db.add(progress)
        await db.flush()

    practices = list(
        (
            await db.execute(
                select(PracticeHistory)
                .where(PracticeHistory.user_id == user_id)
                .order_by(PracticeHistory.created_at.desc())
                .limit(30)
            )
        )
        .scalars()
        .all()
    )
    stats = practice_stats_from_rows(practices)

    essay_avg = await db.scalar(
        select(func.avg(Essay.overall_score)).where(
            Essay.user_id == user_id, Essay.overall_score.is_not(None)
        )
    )
    mistake_count = int(
        await db.scalar(
            select(func.count()).select_from(Mistake).where(Mistake.user_id == user_id)
        )
        or 0
    )

    graph = dict(progress.learning_graph or {})
    modules = _module_snapshot(graph)
    graph["practice_stats"] = stats
    graph["activity"] = {
        "mistake_count": mistake_count,
        "practice_count": stats["completed_count"],
        "essay_avg": round(float(essay_avg), 1) if essay_avg is not None else None,
        **modules,
    }

    # If Melong never set scores (all ~0) but user has activity, seed from activity.
    current = [
        float(progress.grammar_score or 0),
        float(progress.writing_score or 0),
        float(progress.reading_score or 0),
        float(progress.speaking_score or 0),
        float(progress.vocabulary_score or 0),
    ]
    has_activity = (
        stats["completed_count"] > 0
        or mistake_count > 0
        or modules["xp"] > 0
        or modules["mastered_letters"] > 0
        or modules["completed_lessons"] > 0
        or essay_avg is not None
    )
    if has_activity and max(current) < 1.0:
        seeded = _baseline_scores(
            practice_stats=stats,
            essay_avg=float(essay_avg) if essay_avg is not None else None,
            mistake_count=mistake_count,
            modules=modules,
        )
        progress.grammar_score = seeded["grammar_score"]
        progress.writing_score = seeded["writing_score"]
        progress.reading_score = seeded["reading_score"]
        progress.speaking_score = seeded["speaking_score"]
        progress.vocabulary_score = seeded["vocabulary_score"]
    elif stats["completed_count"] > 0:
        # Keep bars moving with latest practice average (light blend).
        blend = 0.12
        avg = float(stats.get("avg_score") or 0)
        progress.grammar_score = round(
            (1 - blend) * float(progress.grammar_score or 0) + blend * avg, 1
        )
        progress.vocabulary_score = round(
            (1 - blend) * float(progress.vocabulary_score or 0) + blend * avg, 1
        )
        progress.writing_score = round(
            (1 - blend) * float(progress.writing_score or 0) + blend * (avg * 0.85), 1
        )

    # Next-focus hints when empty
    if not graph.get("next_focus"):
        hints: list[str] = []
        if stats["completed_count"] == 0:
            hints.append("ཉིན་རེའི་སྦྱོང་བརྡར་བྱེད།")
        if modules["mastered_letters"] < 10:
            hints.append("གསལ་བྱེད་སློབས།")
        if mistake_count > 0:
            hints.append("བརྡ་སྤྲོད་ནོར་འཁྲུལ་བསྐྱར་སྦྱོང་།")
        if hints:
            graph["next_focus"] = hints[:3]

    progress.learning_graph = graph
    flag_modified(progress, "learning_graph")
    await db.flush()
    await db.refresh(progress)
    return progress


def merge_practice_stats_into_graph(
    graph: dict[str, Any] | None,
    practice_stats: dict[str, Any],
    activity: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Preserve tracking fields after Melong overwrites learning_graph."""
    out = dict(graph or {})
    out["practice_stats"] = practice_stats
    if activity:
        out["activity"] = activity
    return out
