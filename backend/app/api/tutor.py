"""AI Tutor — Melong chat + Monlam TTS/STT for curated learning modules."""

from __future__ import annotations

import re
from typing import Any, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
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
    "You are རིག་ནུས་དགེ་རྒན།, a warm and accurate Tibetan language tutor on Rignor(རིག་ནོར།) "
    "(རིག་ནོར།). Teach standard school / literary Tibetan carefully. "
    "Always answer the learner's actual question first with correct Tibetan. "
    "When teaching, include: (1) Tibetan script, (2) Wylie or simple phonetics, "
    "(3) clear meaning, (4) a short grammar or usage note when useful. "
    "If the learner writes in Tibetan, reply mainly in Tibetan; otherwise bilingual is fine. "
    "Keep replies focused (about 80–120 words). Never invent Tibetan words or fake grammar. "
    "If you are unsure, say so briefly and give the safest standard form."
)

VOICE_TUTOR_SYSTEM = (
    "You are རིག་ནུས་དགེ་རྒན། on a live voice call in Rignor (རིག་ནོར།). "
    "You are a real Tibetan grammar and language tutor. Speak Tibetan only "
    "(unless they explicitly ask for one English gloss).\n\n"

    "MOST IMPORTANT — answer THIS turn:\n"
    "- Read the learner's LATEST message carefully and answer THAT question.\n"
    "- Never repeat, recycle, or lightly rephrase your previous reply. Each turn must be new.\n"
    "- Do not fall back to greetings, 'what shall we study?', or the same canned tip.\n"
    "- If they say they already heard that / ask again / ask a follow-up, go deeper or give a "
    "different example — do not say the same thing again.\n\n"

    "WHEN THEY ASK ABOUT GRAMMAR (བརྡ་སྤྲོད། / particles / verb endings / cases / etc.):\n"
    "- Teach the specific point they asked about.\n"
    "- Structure: (1) name the rule in plain Tibetan, (2) give ONE clear example sentence, "
    "(3) optionally ask one short check question.\n"
    "- If the topic is broad ('teach me grammar'), pick ONE beginner topic (e.g. འི་ / གི་ / ཀྱི་ "
    "genitive, or ལ་ particle) and teach that — then invite the next topic. Do not stay stuck "
    "on the same particle forever.\n\n"

    "OTHER QUESTIONS: answer directly first; one tiny tip only if useful.\n"
    "STT may garble words — silently repair likely errors; if still unclear, ask ONE clarifying question.\n"
    "Real vocabulary and grammar only. Never invent forms.\n"
    "Style: 2–4 short spoken sentences. No markdown, bullets, emoji, Wylie, or fillers like "
    "ཨེ། / འོང་། / ཨང་། (the app plays those separately).\n"
)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.5, ge=0, le=1)
    max_tokens: int = Field(default=800, ge=64, le=2048)
    mode: Literal["text", "voice"] = "text"


class ChatOut(BaseModel):
    reply: str


class TTSIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    voice_name: str = "lhasa_female"


class TTSOut(BaseModel):
    audio_url: str | None = None
    voice_name: str
    latency_ms: float | None = None


class STTOut(BaseModel):
    text: str


def _extract_transcript(data: Any) -> str:
    if isinstance(data, str):
        return data.strip()
    if not isinstance(data, dict):
        return ""
    for key in ("text", "transcript", "transcription", "result"):
        val = data.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
        if isinstance(val, dict):
            nested = _extract_transcript(val)
            if nested:
                return nested
    for key in ("data", "output", "response"):
        nested = _extract_transcript(data.get(key))
        if nested:
            return nested
    return ""


def _norm_bo(text: str) -> str:
    return re.sub(r"[\s།་\.…]+", "", text or "")


def _too_similar(a: str, b: str) -> bool:
    na, nb = _norm_bo(a), _norm_bo(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    shorter, longer = (na, nb) if len(na) <= len(nb) else (nb, na)
    if len(shorter) >= 10 and shorter in longer:
        return True
    if len(na) >= 16 and len(nb) >= 16 and na[:18] == nb[:18]:
        return True
    return False


@router.post("/chat", response_model=ChatOut)
async def tutor_chat(
    body: ChatIn,
    _user_id: UUID = Depends(get_current_user_id),
):
    system = VOICE_TUTOR_SYSTEM if body.mode == "voice" else TUTOR_SYSTEM
    # Voice: room for a real answer; cooler temperature for accuracy
    if body.mode == "voice":
        # Enough room for a real grammar mini-lesson; some variety vs. looping
        max_tokens = min(max(body.max_tokens, 220), 420)
        temperature = 0.55
    else:
        max_tokens = body.max_tokens
        temperature = body.temperature
    messages = [{"role": "system", "content": system}]
    for m in body.messages[-12:]:
        if m.role == "system":
            continue
        messages.append({"role": m.role, "content": m.content})

    prev_assistant = ""
    for m in reversed(body.messages):
        if m.role == "assistant":
            prev_assistant = m.content
            break

    llm = get_llm()
    reply = llm.complete_messages(
        messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    # Melong sometimes loops the same spoken line — nudge one retry for voice.
    if body.mode == "voice" and prev_assistant and _too_similar(reply, prev_assistant):
        retry_msgs = [
            *messages,
            {"role": "assistant", "content": reply},
            {
                "role": "user",
                "content": (
                    "དེ་སྔོན་མའི་ལན་དང་འདྲ་བས་མི་འགྲིག དྲི་བ་འདིར་ལན་གསར་པ་ཞིག་ཤོད། "
                    "དཔེ་གསར་པ་ཞིག་སྤྲོད། སྔོན་མའི་ཚིག་བསྐྱར་དུ་མ་ཤོད།"
                ),
            },
        ]
        reply = llm.complete_messages(
            retry_msgs,
            max_tokens=max_tokens,
            temperature=min(temperature + 0.15, 0.75),
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


@router.post("/stt", response_model=STTOut)
async def tutor_stt(
    file: UploadFile = File(...),
    language: str = Form("bo"),
    task: str = Form("transcribe"),
    _user_id: UUID = Depends(get_current_user_id),
):
    settings = get_settings()
    if not settings.monlam_api_key or settings.monlam_api_key.startswith("YOUR_"):
        raise HTTPException(status_code=503, detail="STT is not configured")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty audio")
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio too large")

    filename = file.filename or "speech.webm"
    content_type = file.content_type or "application/octet-stream"
    headers = {"X-API-Key": settings.monlam_api_key}
    files = {"file": (filename, raw, content_type)}
    data = {"language": language or "bo", "task": task or "transcribe"}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                settings.monlam_stt_url,
                headers=headers,
                files=files,
                data=data,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach the STT service: {exc}",
        ) from exc

    if response.status_code >= 400:
        detail = "STT is unavailable right now"
        try:
            err = response.json()
            if isinstance(err, dict) and err.get("detail"):
                detail = str(err["detail"])
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)

    try:
        payload = response.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Invalid STT response") from exc

    text = _extract_transcript(payload)
    if not text:
        raise HTTPException(status_code=502, detail="No transcript returned")
    return STTOut(text=text)
