"""Shared LLM abstraction — all agents use Monlam Melong (Tibetan-first)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.monlam_model
        self.api_url = settings.monlam_chat_url
        self.api_key = settings.monlam_api_key
        self.max_tokens_cap = settings.llm_max_tokens_cap
        if not self.api_key or self.api_key.startswith("YOUR_"):
            raise HTTPException(
                status_code=503,
                detail="AI service is not configured. Please try again later.",
            )

    def _clamp_tokens(self, max_tokens: int) -> int:
        return max(64, min(int(max_tokens), self.max_tokens_cap))

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }

    def _raise_http(self, response: httpx.Response) -> None:
        if response.status_code == 401:
            logger.error("Melong rejected API key")
            raise HTTPException(
                status_code=502,
                detail="AI service authentication failed.",
            )
        detail = response.text[:500]
        if response.status_code == 429 or "rate limit" in detail.lower():
            note_melong_rate_limit()
            raise HTTPException(
                status_code=502,
                detail="AI service is busy. Please try again shortly.",
            )
        logger.error("Melong error %s: %s", response.status_code, detail[:200])
        raise HTTPException(
            status_code=502,
            detail="AI service unavailable. Please try again.",
        )

    def _post_sync(self, payload: dict[str, Any], *, timeout: float = 90.0) -> str:
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(self.api_url, headers=self._headers(), json=payload)
        except httpx.RequestError as exc:
            logger.error("Melong request failed: %s", type(exc).__name__)
            raise HTTPException(
                status_code=502,
                detail="AI service unavailable. Please try again.",
            ) from exc

        if response.status_code >= 400:
            self._raise_http(response)

        data = response.json()
        text = extract_assistant_text(data)
        if not text:
            raise HTTPException(
                status_code=502,
                detail="AI service returned an empty response.",
            )
        return text.strip()

    async def _post_async(self, payload: dict[str, Any], *, timeout: float = 90.0) -> str:
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self.api_url, headers=self._headers(), json=payload
                )
        except httpx.RequestError as exc:
            logger.error("Melong request failed: %s", type(exc).__name__)
            raise HTTPException(
                status_code=502,
                detail="AI service unavailable. Please try again.",
            ) from exc

        if response.status_code >= 400:
            self._raise_http(response)

        data = response.json()
        text = extract_assistant_text(data)
        if not text:
            raise HTTPException(
                status_code=502,
                detail="AI service returned an empty response.",
            )
        return text.strip()

    def complete(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = 4096,
        temperature: float = 0.3,
        timeout: float = 90.0,
    ) -> str:
        settings = get_settings()
        user = (user or "")[: settings.llm_max_user_chars]
        payload = {
            "model_name": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": self._clamp_tokens(max_tokens),
        }
        return self._post_sync(payload, timeout=timeout)

    async def complete_async(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = 4096,
        temperature: float = 0.3,
        timeout: float = 90.0,
    ) -> str:
        settings = get_settings()
        user = (user or "")[: settings.llm_max_user_chars]
        payload = {
            "model_name": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": self._clamp_tokens(max_tokens),
        }
        return await self._post_async(payload, timeout=timeout)

    def complete_messages(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 1024,
        temperature: float = 0.5,
        timeout: float = 90.0,
    ) -> str:
        settings = get_settings()
        trimmed: list[dict[str, str]] = []
        for m in messages[-settings.llm_max_messages :]:
            role = m.get("role") or "user"
            content = str(m.get("content") or "")[: settings.llm_max_user_chars]
            trimmed.append({"role": role, "content": content})
        payload = {
            "model_name": self.model,
            "messages": trimmed,
            "temperature": temperature,
            "max_tokens": self._clamp_tokens(max_tokens),
        }
        return self._post_sync(payload, timeout=timeout)

    async def complete_messages_async(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 1024,
        temperature: float = 0.5,
        timeout: float = 90.0,
    ) -> str:
        settings = get_settings()
        trimmed: list[dict[str, str]] = []
        for m in messages[-settings.llm_max_messages :]:
            role = m.get("role") or "user"
            content = str(m.get("content") or "")[: settings.llm_max_user_chars]
            trimmed.append({"role": role, "content": content})
        payload = {
            "model_name": self.model,
            "messages": trimmed,
            "temperature": temperature,
            "max_tokens": self._clamp_tokens(max_tokens),
        }
        return await self._post_async(payload, timeout=timeout)

    def complete_json(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = 8192,
        temperature: float = 0.2,
        retries: int = 1,
        timeout: float = 90.0,
    ) -> dict[str, Any]:
        last_error: Exception | None = None
        prompt_user = user
        for _ in range(retries + 1):
            text = self.complete(
                system + "\n\nRespond with valid JSON only. No markdown fences.",
                prompt_user,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=timeout,
            )
            try:
                return parse_json_response(text)
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                prompt_user = (
                    f"{user}\n\nYour previous JSON was invalid or truncated. "
                    "Return a shorter valid JSON object only."
                )
        logger.error("Melong JSON parse failed: %s", last_error)
        raise HTTPException(
            status_code=502,
            detail="AI service returned invalid data. Please try again.",
        ) from last_error

    async def complete_json_async(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = 8192,
        temperature: float = 0.2,
        retries: int = 1,
        timeout: float = 90.0,
    ) -> dict[str, Any]:
        last_error: Exception | None = None
        prompt_user = user
        for _ in range(retries + 1):
            text = await self.complete_async(
                system + "\n\nRespond with valid JSON only. No markdown fences.",
                prompt_user,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=timeout,
            )
            try:
                return parse_json_response(text)
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                prompt_user = (
                    f"{user}\n\nYour previous JSON was invalid or truncated. "
                    "Return a shorter valid JSON object only."
                )
        logger.error("Melong JSON parse failed: %s", last_error)
        raise HTTPException(
            status_code=502,
            detail="AI service returned invalid data. Please try again.",
        ) from last_error


def extract_assistant_text(data: Any) -> str:
    """Support OpenAI-style and simple Monlam response shapes."""
    if isinstance(data, str):
        return data
    if not isinstance(data, dict):
        return str(data)

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
_rate_limited_until: float = 0.0


def note_melong_rate_limit(seconds: float = 6 * 3600.0) -> None:
    """Skip Melong calls for a while after a daily quota error."""
    import time

    global _rate_limited_until
    _rate_limited_until = max(_rate_limited_until, time.time() + seconds)


def melong_is_rate_limited() -> bool:
    import time

    return time.time() < _rate_limited_until


def get_llm() -> LLMService:
    global _llm, _llm_key
    key = get_settings().monlam_api_key
    if _llm is None or _llm_key != key:
        _llm = LLMService()
        _llm_key = key
    return _llm
