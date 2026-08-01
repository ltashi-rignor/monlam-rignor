"""Kids story API — generate Tibetan stories with fixed scene keys (emoji UI)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.agents.story_agent import define_story_word, run_kid_story
from app.core.learner_profile import profile_for_agents
from app.core.rate_limit import rate_limit_llm
from app.core.security import get_current_user_id
from app.database.session import get_db
from app.models.entities import Progress, User

router = APIRouter(prefix="/story", tags=["story"])

_MAX_HISTORY = 12


class StoryGenerateRequest(BaseModel):
    character_names: list[str] = Field(default_factory=list, max_length=5)
    character_count: int = Field(default=2, ge=1, le=5)
    actions: str = Field(..., min_length=1, max_length=500)
    setting: str | None = Field(default=None, max_length=200)


class StorySceneOut(BaseModel):
    scene_key: str
    caption: str
    text: str


class StoryGlossaryOut(BaseModel):
    word: str
    meaning: str


class StoryQuizOut(BaseModel):
    prompt: str
    options: list[str]
    answer: str


class StoryOut(BaseModel):
    id: str
    title: str
    moral: str
    characters_used: list[str]
    scenes: list[StorySceneOut]
    glossary: list[StoryGlossaryOut] = Field(default_factory=list)
    quiz: list[StoryQuizOut] = Field(default_factory=list)
    input: dict[str, Any]
    created_at: str


class StoryDefineRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=40)


class StoryDefineOut(BaseModel):
    word: str
    meaning: str
    example: str = ""


async def _ensure_progress(db: AsyncSession, user_id: UUID) -> Progress:
    progress = await db.scalar(select(Progress).where(Progress.user_id == user_id))
    if not progress:
        progress = Progress(user_id=user_id, learning_graph={})
        db.add(progress)
        await db.flush()
    return progress


def _stories_from_graph(progress: Progress) -> list[dict[str, Any]]:
    graph = dict(progress.learning_graph or {})
    rows = graph.get("kid_stories") or []
    return list(rows) if isinstance(rows, list) else []


def _save_story(progress: Progress, story: dict[str, Any]) -> None:
    graph = dict(progress.learning_graph or {})
    rows = list(graph.get("kid_stories") or [])
    if not isinstance(rows, list):
        rows = []
    rows.insert(0, story)
    graph["kid_stories"] = rows[:_MAX_HISTORY]
    progress.learning_graph = graph
    flag_modified(progress, "learning_graph")


def _story_out(row: dict[str, Any]) -> StoryOut:
    scenes = row.get("scenes") or []
    if not isinstance(scenes, list):
        scenes = []
    glossary = row.get("glossary") or []
    if not isinstance(glossary, list):
        glossary = []
    quiz = row.get("quiz") or []
    if not isinstance(quiz, list):
        quiz = []
    return StoryOut(
        id=str(row.get("id") or uuid.uuid4()),
        title=str(row.get("title") or ""),
        moral=str(row.get("moral") or ""),
        characters_used=[str(x) for x in (row.get("characters_used") or [])],
        scenes=[
            StorySceneOut(
                scene_key=str(s.get("scene_key") or "play"),
                caption=str(s.get("caption") or ""),
                text=str(s.get("text") or ""),
            )
            for s in scenes
            if isinstance(s, dict)
        ],
        glossary=[
            StoryGlossaryOut(
                word=str(g.get("word") or ""),
                meaning=str(g.get("meaning") or ""),
            )
            for g in glossary
            if isinstance(g, dict) and g.get("word")
        ],
        quiz=[
            StoryQuizOut(
                prompt=str(q.get("prompt") or ""),
                options=[str(o) for o in (q.get("options") or []) if str(o).strip()],
                answer=str(q.get("answer") or ""),
            )
            for q in quiz
            if isinstance(q, dict) and q.get("prompt")
        ],
        input=dict(row.get("input") or {}),
        created_at=str(row.get("created_at") or ""),
    )


@router.post("/generate", response_model=StoryOut)
async def generate_story(
    body: StoryGenerateRequest,
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rate_limit_llm(request, str(user_id))
    user = await db.get(User, user_id)
    profile = profile_for_agents(user) if user else {}

    names = [n.strip() for n in (body.character_names or []) if n and n.strip()]
    count = body.character_count
    if names:
        count = max(count, len(names))
        count = min(count, 5)

    generated = await run_kid_story(
        names=names,
        actions=body.actions,
        setting=body.setting,
        character_count=count,
        profile=profile,
    )

    story_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    payload = {
        "id": story_id,
        "title": generated["title"],
        "moral": generated["moral"],
        "characters_used": generated["characters_used"],
        "scenes": generated["scenes"],
        "glossary": generated.get("glossary") or [],
        "quiz": generated.get("quiz") or [],
        "input": {
            "character_names": names,
            "character_count": count,
            "actions": body.actions.strip(),
            "setting": (body.setting or "").strip() or None,
        },
        "created_at": created_at,
    }

    progress = await _ensure_progress(db, user_id)
    _save_story(progress, payload)
    await db.commit()
    return _story_out(payload)


@router.get("/history", response_model=list[StoryOut])
async def story_history(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    progress = await _ensure_progress(db, user_id)
    return [_story_out(row) for row in _stories_from_graph(progress) if isinstance(row, dict)]


@router.post("/define", response_model=StoryDefineOut)
async def story_define(
    body: StoryDefineRequest,
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
):
    rate_limit_llm(request, str(user_id))
    data = await define_story_word(body.word)
    return StoryDefineOut(**data)
