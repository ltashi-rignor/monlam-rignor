"""AI Tutor — Melong chat + Monlam TTS for curated learning modules."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.security import get_current_user_id
from app.services.llm import get_llm

router = APIRouter(prefix="/tutor", tags=["tutor"])

_TTS_VOICES = {
    "lhasa_female",
    "lhasa_male",
    "amdo_female",
    "amdo_male",
    "kham_female",
    "kham_male",
}

TUTOR_SYSTEM = (
    "You are Lobsang, a warm and patient Tibetan language tutor on Monlam Rignor "
    "(སྨོན་ལམ་རིག་ནོར།). Help beginners and heritage learners with standard Tibetan. "
    "When teaching, show: (1) Tibetan script, (2) Wylie/phonetic, (3) meaning, "
    "(4) a short grammar or cultural note when useful. "
    "Prefer clear Tibetan explanations when the learner writes in Tibetan; "
    "otherwise bilingual is fine. Keep replies concise (max ~120 words). "
    "Never invent Tibetan words."
)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.5, ge=0, le=1)
    max_tokens: int = Field(default=800, ge=64, le=2048)


class ChatOut(BaseModel):
    reply: str


class TTSIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    voice_name: str = "lhasa_female"


class TTSOut(BaseModel):
    audio_url: str | None = None
    voice_name: str
    latency_ms: float | None = None


@router.post("/chat", response_model=ChatOut)
async def tutor_chat(
    body: ChatIn,
    _user_id: UUID = Depends(get_current_user_id),
):
    messages = [{"role": "system", "content": TUTOR_SYSTEM}]
    for m in body.messages[-12:]:
        if m.role == "system":
            continue
        messages.append({"role": m.role, "content": m.content})
    llm = get_llm()
    reply = llm.complete_messages(
        messages,
        max_tokens=body.max_tokens,
        temperature=body.temperature,
    )
    return ChatOut(reply=reply)


@router.post("/tts", response_model=TTSOut)
async def tutor_tts(
    body: TTSIn,
    _user_id: UUID = Depends(get_current_user_id),
):
    settings = get_settings()
    if not settings.monlam_api_key or settings.monlam_api_key.startswith("YOUR_"):
        raise HTTPException(status_code=503, detail="TTS is not configured")

    voice = body.voice_name if body.voice_name in _TTS_VOICES else "lhasa_female"
    payload = {"text": body.text, "voice_name": voice, "model_name": "monlamai-tts"}
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": settings.monlam_api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.monlam_tts_url,
                headers=headers,
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach the TTS service: {exc}",
        ) from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="TTS is unavailable right now")

    data = response.json()
    return TTSOut(
        audio_url=data.get("audio_url"),
        voice_name=voice,
        latency_ms=data.get("latency_ms"),
    )
