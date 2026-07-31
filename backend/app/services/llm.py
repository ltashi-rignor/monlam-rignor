"""Shared LLM abstraction — all agents use Monlam Melong (Tibetan-first)."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import get_settings


class LLMService:
    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.monlam_model
        self.api_url = settings.monlam_chat_url
        self.api_key = settings.monlam_api_key
        if not self.api_key or self.api_key.startswith("YOUR_"):
            raise HTTPException(
                status_code=503,
                detail="MONLAM_API_KEY is missing. Add your Monlam Studio X-API-Key to .env and restart the backend.",
            )

    def complete(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> str:
        payload = {
            "model_name": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }
        try:
            with httpx.Client(timeout=120.0) as client:
                response = client.post(self.api_url, headers=headers, json=payload)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Monlam Melong request failed: {exc}",
            ) from exc

        if response.status_code == 401:
            raise HTTPException(
                status_code=502,
                detail="Monlam API key rejected. Check MONLAM_API_KEY in .env.",
            )
        if response.status_code >= 400:
            detail = response.text[:500]
            raise HTTPException(
                status_code=502,
                detail=f"Monlam Melong error ({response.status_code}): {detail}",
            )

        data = response.json()
        text = extract_assistant_text(data)
        if not text:
            raise HTTPException(
                status_code=502,
                detail=f"Monlam Melong returned an empty response: {str(data)[:400]}",
            )
        return text.strip()

    def complete_messages(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 1024,
        temperature: float = 0.5,
    ) -> str:
        payload = {
            "model_name": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }
        try:
            with httpx.Client(timeout=120.0) as client:
                response = client.post(self.api_url, headers=headers, json=payload)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Monlam Melong request failed: {exc}",
            ) from exc

        if response.status_code >= 400:
            detail = response.text[:500]
            raise HTTPException(
                status_code=502,
                detail=f"Monlam Melong error ({response.status_code}): {detail}",
            )

        data = response.json()
        text = extract_assistant_text(data)
        if not text:
            raise HTTPException(
                status_code=502,
                detail=f"Monlam Melong returned an empty response: {str(data)[:400]}",
            )
        return text.strip()

    def complete_json(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = 8192,
        temperature: float = 0.2,
        retries: int = 1,
    ) -> dict[str, Any]:
        last_error: Exception | None = None
        prompt_user = user
        for _ in range(retries + 1):
            text = self.complete(
                system + "\n\nRespond with valid JSON only. No markdown fences.",
                prompt_user,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            try:
                return parse_json_response(text)
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                prompt_user = (
                    f"{user}\n\nYour previous JSON was invalid or truncated. "
                    "Return a shorter valid JSON object only."
                )
        raise HTTPException(
            status_code=502,
            detail=f"Melong returned invalid JSON: {last_error}",
        ) from last_error


def extract_assistant_text(data: Any) -> str:
    """Support OpenAI-style and simple Monlam response shapes."""
    if isinstance(data, str):
        return data
    if not isinstance(data, dict):
        return str(data)

    # OpenAI-compatible
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    parts.append(block.get("text") or "")
                elif isinstance(block, str):
                    parts.append(block)
            return "\n".join(parts)

    for key in ("content", "output", "text", "response", "message"):
        value = data.get(key)
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            nested = value.get("content") or value.get("text")
            if isinstance(nested, str):
                return nested

    return ""


def parse_json_response(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
        return {"data": data}
    except json.JSONDecodeError:
        repaired = _repair_truncated_json(cleaned)
        if repaired is not None:
            return repaired
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            repaired = _repair_truncated_json(match.group(0))
            if repaired is not None:
                return repaired
            return json.loads(match.group(0))
        raise ValueError(f"Could not parse LLM JSON response: {text[:500]}")


def _repair_truncated_json(text: str) -> dict[str, Any] | None:
    candidate = text.strip()
    if not candidate.startswith("{"):
        return None

    in_string = False
    escape = False
    stack: list[str] = []
    for ch in candidate:
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]" and stack and stack[-1] == ch:
            stack.pop()

    if in_string:
        candidate += '"'
    while stack:
        candidate += stack.pop()

    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
    try:
        data = json.loads(candidate)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


_llm: LLMService | None = None
_llm_key: str | None = None


def get_llm() -> LLMService:
    global _llm, _llm_key
    key = get_settings().monlam_api_key
    if _llm is None or _llm_key != key:
        _llm = LLMService()
        _llm_key = key
    return _llm
