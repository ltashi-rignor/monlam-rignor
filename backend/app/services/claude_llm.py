"""Anthropic Claude client — used for grammar check (JSON mode)."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import get_settings
from app.services.llm import parse_json_response

logger = logging.getLogger(__name__)


class ClaudeLLMService:
    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = (settings.anthropic_api_key or "").strip()
        self.model = settings.anthropic_model or "claude-sonnet-4-5"
        self.api_url = settings.anthropic_api_url
        self.max_tokens_cap = settings.llm_max_tokens_cap
        if not self.api_key or self.api_key.startswith("YOUR_"):
            raise HTTPException(
                status_code=503,
                detail="Claude is not configured. Set ANTHROPIC_API_KEY in .env",
            )

    def _clamp_tokens(self, max_tokens: int) -> int:
        return max(64, min(int(max_tokens), self.max_tokens_cap))

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

    def _extract_text(self, data: dict[str, Any]) -> str:
        blocks = data.get("content")
        if not isinstance(blocks, list):
            return ""
        parts: list[str] = []
        for block in blocks:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text") or ""))
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts).strip()

    async def complete_async(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = 4096,
        temperature: float = 0.2,
        timeout: float = 120.0,
    ) -> str:
        settings = get_settings()
        user = (user or "")[: settings.llm_max_user_chars]
        payload = {
            "model": self.model,
            "max_tokens": self._clamp_tokens(max_tokens),
            "temperature": temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self.api_url, headers=self._headers(), json=payload
                )
        except httpx.RequestError as exc:
            logger.error("Claude request failed: %s", type(exc).__name__)
            raise HTTPException(
                status_code=502,
                detail="Claude unavailable. Please try again.",
            ) from exc

        if response.status_code >= 400:
            detail = response.text[:400]
            logger.error("Claude error %s: %s", response.status_code, detail[:200])
            if response.status_code == 401:
                raise HTTPException(
                    status_code=502,
                    detail="Claude authentication failed. Check ANTHROPIC_API_KEY.",
                )
            raise HTTPException(
                status_code=502,
                detail="Claude unavailable. Please try again.",
            )

        data = response.json() if response.content else {}
        text = self._extract_text(data if isinstance(data, dict) else {})
        if not text:
            raise HTTPException(
                status_code=502,
                detail="Claude returned an empty response.",
            )
        return text

    async def complete_json_async(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = 4096,
        temperature: float = 0.1,
        retries: int = 1,
        timeout: float = 120.0,
    ) -> dict[str, Any]:
        last_error: Exception | None = None
        prompt_user = user
        system_json = (
            system
            + "\n\nRespond with a single valid JSON object only. No markdown fences."
        )
        for _ in range(retries + 1):
            text = await self.complete_async(
                system_json,
                prompt_user,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=timeout,
            )
            try:
                return parse_json_response(text)
            except (ValueError, Exception) as exc:
                last_error = exc
                prompt_user = (
                    f"{user}\n\nYour previous JSON was invalid. "
                    "Return a shorter valid JSON object only."
                )
        logger.error("Claude JSON parse failed: %s", last_error)
        raise HTTPException(
            status_code=502,
            detail="Claude returned invalid data. Please try again.",
        ) from last_error


_claude: ClaudeLLMService | None = None
_claude_key: str | None = None


def claude_configured() -> bool:
    key = (get_settings().anthropic_api_key or "").strip()
    return bool(key) and not key.startswith("YOUR_")


def get_claude() -> ClaudeLLMService:
    global _claude, _claude_key
    key = get_settings().anthropic_api_key
    if _claude is None or _claude_key != key:
        _claude = ClaudeLLMService()
        _claude_key = key
    return _claude


def get_grammar_llm():
    """
    LLM for grammar *check* only (run_grammar).
    All other agents must keep using get_llm() → Melong.
    Prefer Claude when GRAMMAR_LLM_PROVIDER=claude|auto and key is set.
    """
    settings = get_settings()
    provider = (settings.grammar_llm_provider or "auto").strip().lower()
    if provider == "claude" or (provider == "auto" and claude_configured()):
        return get_claude()
    from app.services.llm import get_llm

    return get_llm()
