from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class RequestOTPBody(BaseModel):
    email: EmailStr


class VerifyOTPBody(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool = False
    profile_complete: bool = False


class UserProfileUpdate(BaseModel):
    name: str | None = None
    age: int | None = Field(default=None, ge=5, le=120)
    school_class: str | None = None
    likes: str | None = None
    favorites: str | None = None


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    name: str | None
    age: int | None
    school_class: str | None
    likes: str | None
    favorites: str | None
    profile_complete: bool

    model_config = {"from_attributes": True}


# ---------- Planner ----------
class PlannerRequest(BaseModel):
    regenerate: bool = False


class LearningPlanOut(BaseModel):
    id: UUID
    title: str
    roadmap_json: dict[str, Any]
    current_week: int
    status: str
    lessons: list[dict[str, Any]] = []

    model_config = {"from_attributes": True}


class LessonStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|in_progress|completed)$")


class LessonOut(BaseModel):
    id: UUID
    title: str
    content: str | None = None
    lesson_type: str
    week_number: int
    order_index: int
    status: str
    plan_id: UUID
    goals: list[Any] = []
    week_focus: str | None = None
    estimated_minutes: int | None = None

    model_config = {"from_attributes": True}


# ---------- Grammar ----------
class GrammarCheckRequest(BaseModel):
    text: str = Field(min_length=1)
    essay_id: UUID | None = None


class GrammarMistakeOut(BaseModel):
    mistake_type: str
    original: str
    correction: str
    explanation: str | None = None
    related_rule: str | None = None
    source_ref: str | None = None


class GrammarCheckResponse(BaseModel):
    mistakes: list[GrammarMistakeOut]
    honorific_mistakes: list[GrammarMistakeOut] = []
    corrected_version: str
    related_rules: list[str] = []
    practice_questions: list[str] = []
    retrieved_sources: list[dict[str, Any]] = []
    summary: str | None = None
    praise: str | None = None


class GrammarGameRequest(BaseModel):
    topic: str = Field(default="particles", min_length=1, max_length=80)


class GrammarGameRound(BaseModel):
    id: str
    type: str
    prompt: str
    sentence: str
    error_span: str = ""
    options: list[str] = []
    answer: str = ""
    explanation: str = ""
    related_rule: str = ""
    source_ref: str = ""
    handbook_excerpt: str = ""
    page_number: int | None = None


class GrammarGameResponse(BaseModel):
    topic: str
    topic_label: str = ""
    rounds: list[GrammarGameRound]
    retrieved_sources: list[dict[str, Any]] = []
    offline: bool = False
    source: str = "melong"


class RecentMistakeOut(BaseModel):
    id: UUID
    mistake_type: str
    original: str
    correction: str
    explanation: str | None = None
    related_rule: str | None = None
    source_ref: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------- Essay ----------
class EssaySubmitRequest(BaseModel):
    title: str | None = None
    content: str = Field(min_length=1)
    run_grammar: bool = True


class EssayOut(BaseModel):
    id: UUID
    title: str | None
    content: str
    grammar_score: float | None
    vocabulary_score: float | None
    fluency_score: float | None
    naturalness_score: float | None
    overall_score: float | None
    reading_level: str | None
    suggestions: list[Any]
    grammar_feedback: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Practice ----------
class PracticeGenerateRequest(BaseModel):
    focus: str | None = None


class PracticeSubmitRequest(BaseModel):
    practice_id: UUID
    answers: dict[str, Any]
    score: float | None = None


class PracticeOut(BaseModel):
    id: UUID
    exercises_json: dict[str, Any]
    based_on_mistakes: list[Any]
    completed: bool
    score: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Progress ----------
class ProgressOut(BaseModel):
    grammar_score: float
    writing_score: float
    reading_score: float
    speaking_score: float
    vocabulary_score: float
    learning_graph: dict[str, Any]
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------- Recommendations ----------
class RecommendationOut(BaseModel):
    content_type: str
    title: str
    description: str | None
    level: str
    topics: list[Any] = []
    url: str | None = None
    reason: str | None = None
    body: str | None = None


class RecommendationsResponse(BaseModel):
    items: list[RecommendationOut]
    rationale: str | None = None
