"""Practice API — adaptive daily exercises from recent mistakes."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.agents.practice_agent import run_practice, sanitize_practice_exercises
from app.core.learner_profile import profile_for_agents
from app.core.rate_limit import rate_limit_llm
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Mistake, PracticeHistory, Progress, User
from app.models.schemas import PracticeGenerateRequest, PracticeOut, PracticeSubmitRequest

router = APIRouter(prefix="/practice", tags=["practice"])


def _practice_out(record: PracticeHistory) -> PracticeHistory:
    """Ensure blanks don't leak answers on any returned session (including older ones)."""
    payload = sanitize_practice_exercises(dict(record.exercises_json or {}))
    if payload != (record.exercises_json or {}):
        record.exercises_json = payload
        flag_modified(record, "exercises_json")
    return record


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(_as_text(v) for v in value if v is not None)
    if isinstance(value, dict):
        for key in ("text", "label", "value", "answer"):
            if key in value and value[key] is not None:
                return str(value[key])
        return str(next(iter(value.values()), ""))
    return str(value)


def _norm_answer(value: Any) -> str:
    """Compare Tibetan answers ignoring spaces / tsheg / shad."""
    text = _as_text(value).strip()
    text = re.sub(r"[\s་༌།༎༏༐༑]+", "", text)
    return text


def _exercise_key(ex: dict[str, Any], index: int) -> str:
    if ex.get("id") is not None and str(ex.get("id")).strip():
        return str(ex["id"])
    return f"ex-{index}"


def score_practice_answers(
    exercises: list[dict[str, Any]],
    answers: dict[str, Any],
) -> tuple[float, list[dict[str, Any]]]:
    """Server-side exact (normalized) scoring. Returns score 0–100 and per-item results."""
    results: list[dict[str, Any]] = []
    if not exercises:
        return 0.0, results

    correct = 0
    for index, raw in enumerate(exercises):
        ex = raw if isinstance(raw, dict) else {}
        key = _exercise_key(ex, index)
        given_raw = answers.get(key)
        if given_raw is None:
            given_raw = answers.get(str(index), "")
        given = _as_text(given_raw).strip()
        expected = _as_text(ex.get("answer")).strip()
        ok = bool(given) and bool(expected) and _norm_answer(given) == _norm_answer(expected)
        if ok:
            correct += 1
        results.append(
            {
                "id": key,
                "index": index,
                "correct": ok,
                "given": given,
                "expected": expected,
                "type": ex.get("type") or "exercise",
            }
        )
    score = round((correct / len(exercises)) * 100.0, 1)
    return score, results


def _nudge_progress_from_practice(progress: Progress, score: float) -> dict:
    """Blend today's practice into skill bars so Progress moves without a full Melong refresh."""
    from datetime import date

    blend = 0.18
    s = max(0.0, min(100.0, float(score)))
    progress.grammar_score = round((1 - blend) * float(progress.grammar_score or 0) + blend * s, 1)
    progress.vocabulary_score = round(
        (1 - blend) * float(progress.vocabulary_score or 0) + blend * s, 1
    )
    progress.writing_score = round(
        (1 - blend) * float(progress.writing_score or 0) + blend * (s * 0.85), 1
    )

    graph = dict(progress.learning_graph or {})
    stats = dict(graph.get("practice_stats") or {})
    prev_n = int(stats.get("completed_count") or 0)
    prev_avg = float(stats.get("avg_score") or 0)
    n = prev_n + 1
    avg = s if prev_n <= 0 else round(((prev_avg * prev_n) + s) / n, 1)
    stats.update(
        {
            "completed_count": n,
            "last_score": s,
            "avg_score": avg,
        }
    )
    today = date.today().isoformat()
    streak = dict(graph.get("practice_streak") or {})
    last_day = str(streak.get("last_day") or "")
    current = int(streak.get("current") or 0)
    best = int(streak.get("best") or 0)
    if last_day != today:
        try:
            prev = date.fromisoformat(last_day) if last_day else None
        except ValueError:
            prev = None
        if prev and (date.fromisoformat(today) - prev).days == 1:
            current = current + 1
        else:
            current = 1
        best = max(best, current)
        streak = {"current": current, "best": best, "last_day": today}
    elif current <= 0:
        streak = {"current": 1, "best": max(1, best), "last_day": today}
    graph["practice_streak"] = streak
    xp_gain = max(5, int(round(s / 10)) * 5)
    graph["practice_xp"] = int(graph.get("practice_xp") or 0) + xp_gain
    graph["practice_stats"] = stats
    reward = {
        "xp": xp_gain,
        "streak": int(streak.get("current") or 1),
        "best_streak": int(streak.get("best") or 1),
        "score": s,
    }
    graph["practice_last_reward"] = reward
    progress.learning_graph = graph
    flag_modified(progress, "learning_graph")
    return reward


@router.post("/generate", response_model=PracticeOut)
async def generate_practice(
    body: PracticeGenerateRequest,
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_llm(request, str(user_id))
    user = await db.get(User, user_id)
    profile = profile_for_agents(user) if user else {}
    mistakes_result = await db.execute(
        select(Mistake)
        .where(Mistake.user_id == user_id)
        .order_by(Mistake.created_at.desc())
        .limit(20)
    )
    mistakes = [
        {
            "mistake_type": m.mistake_type,
            "original": m.original,
            "correction": m.correction,
            "explanation": m.explanation,
            "related_rule": m.related_rule,
        }
        for m in mistakes_result.scalars().all()
    ]
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    progress_data = {
        "grammar_score": progress.grammar_score if progress else 0,
        "writing_score": progress.writing_score if progress else 0,
        "reading_score": progress.reading_score if progress else 0,
        "speaking_score": progress.speaking_score if progress else 0,
        "vocabulary_score": progress.vocabulary_score if progress else 0,
        "learning_graph": progress.learning_graph if progress else {},
    }
    exercises = await run_practice(mistakes, progress_data, body.focus, profile)
    record = PracticeHistory(
        user_id=user_id,
        exercises_json=exercises,
        based_on_mistakes=mistakes[:10],
        completed=False,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return _practice_out(record)


@router.post("/submit", response_model=PracticeOut)
async def submit_practice(
    body: PracticeSubmitRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    record = await db.get(PracticeHistory, body.practice_id)
    if not record or record.user_id != user_id:
        raise HTTPException(status_code=404, detail="Practice session not found")

    record = _practice_out(record)
    payload = dict(record.exercises_json or {})
    exercises = list(payload.get("exercises") or [])
    score, results = score_practice_answers(exercises, body.answers or {})

    record.completed = True
    record.score = score
    payload["submitted_answers"] = body.answers
    payload["item_results"] = results
    payload["correct_count"] = sum(1 for r in results if r.get("correct"))
    payload["total_count"] = len(results)
    record.exercises_json = payload
    flag_modified(record, "exercises_json")

    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    if progress is None:
        progress = Progress(user_id=user_id, learning_graph={})
        db.add(progress)
        await db.flush()
    reward = _nudge_progress_from_practice(progress, score)
    # Re-sync stats/activity so Progress page always has practice_stats.
    from app.services.progress_sync import sync_progress_from_activity

    await sync_progress_from_activity(db, user_id, progress)

    # Re-apply reward after sync (sync may rebuild graph fields).
    graph = dict(progress.learning_graph or {})
    graph["practice_last_reward"] = reward
    if "practice_streak" not in graph:
        graph["practice_streak"] = {
            "current": reward.get("streak") or 1,
            "best": reward.get("best_streak") or 1,
        }
    progress.learning_graph = graph
    flag_modified(progress, "learning_graph")

    payload["reward"] = reward
    record.exercises_json = payload
    flag_modified(record, "exercises_json")

    await db.flush()
    await db.refresh(record)
    return _practice_out(record)


@router.get("/history", response_model=list[PracticeOut])
async def practice_history(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeHistory)
        .where(PracticeHistory.user_id == user_id)
        .order_by(PracticeHistory.created_at.desc())
        .limit(30)
    )
    rows = list(result.scalars().all())
    return [_practice_out(r) for r in rows]


@router.get("/latest", response_model=PracticeOut)
async def latest_practice(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeHistory)
        .where(PracticeHistory.user_id == user_id)
        .order_by(PracticeHistory.created_at.desc())
        .limit(1)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="No practice yet")
    return _practice_out(record)