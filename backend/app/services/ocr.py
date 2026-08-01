"""Monlam OCR — Tibetan image → text via Studio API."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
IMAGE_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
}

MAX_OCR_BYTES = 8 * 1024 * 1024  # 8 MB per image
MAX_OCR_PAGES = 5


def is_image_upload(filename: str | None, content_type: str | None) -> bool:
    name = (filename or "").strip().lower()
    ext = f".{name.rsplit('.', 1)[-1]}" if "." in name else ""
    ctype = (content_type or "").lower().split(";")[0].strip()
    return ext in IMAGE_EXTENSIONS or ctype in IMAGE_CONTENT_TYPES or ctype.startswith("image/")


def _require_key() -> str:
    settings = get_settings()
    key = (settings.monlam_api_key or "").strip()
    if not key or key.startswith("YOUR_"):
        raise HTTPException(status_code=503, detail="Monlam OCR is not configured")
    return key


def _pick_text(payload: dict[str, Any]) -> str:
    for key in ("text", "output", "transcript", "result"):
        val = payload.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
        if isinstance(val, dict):
            nested = val.get("text") or val.get("output")
            if isinstance(nested, str) and nested.strip():
                return nested.strip()
    pages = payload.get("pages")
    if isinstance(pages, list):
        bits = []
        for page in pages:
            if isinstance(page, dict):
                bit = page.get("text") or page.get("output") or ""
                if bit:
                    bits.append(str(bit).strip())
            elif isinstance(page, str) and page.strip():
                bits.append(page.strip())
        if bits:
            return "\n\n".join(bits)
    return ""


async def ocr_single_page(
    raw: bytes,
    filename: str = "page.png",
    content_type: str = "image/png",
    *,
    lang_hint: str = "bo",
) -> str:
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image")
    if len(raw) > MAX_OCR_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 8 MB)")

    settings = get_settings()
    headers = {"X-API-Key": _require_key()}
    files = {"file": (filename or "page.png", raw, content_type or "application/octet-stream")}
    data = {
        "lang_hint": lang_hint or "bo",
        "model_name": "monlam-ocr",
        "is_async": "false",
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                settings.monlam_ocr_single_url,
                headers=headers,
                files=files,
                data=data,
            )
    except httpx.HTTPError as exc:
        logger.exception("Monlam OCR single-page request failed")
        raise HTTPException(
            status_code=502, detail=f"Could not reach Monlam OCR: {exc}"
        ) from exc

    if response.status_code >= 400:
        detail = "Monlam OCR failed"
        try:
            body = response.json()
            if isinstance(body.get("detail"), str):
                detail = body["detail"]
            elif isinstance(body.get("message"), str):
                detail = body["message"]
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)

    payload = response.json() if response.content else {}
    if not isinstance(payload, dict):
        payload = {}
    text = _pick_text(payload)
    if not text:
        raise HTTPException(
            status_code=400,
            detail="OCR found no readable Tibetan text in this image",
        )
    return text


async def ocr_multi_page(
    pages: list[tuple[bytes, str, str]],
    *,
    lang_hint: str = "bo",
) -> str:
    """OCR 2–5 images via Monlam multi-page endpoint."""
    if len(pages) < 2 or len(pages) > MAX_OCR_PAGES:
        raise HTTPException(
            status_code=400,
            detail="Multi-page OCR needs 2–5 images",
        )
    for raw, _name, _ctype in pages:
        if not raw:
            raise HTTPException(status_code=400, detail="Empty image in multi-page upload")
        if len(raw) > MAX_OCR_BYTES:
            raise HTTPException(status_code=400, detail="Image too large (max 8 MB each)")

    settings = get_settings()
    headers = {"X-API-Key": _require_key()}
    files = {}
    for i, (raw, name, ctype) in enumerate(pages, start=1):
        field = f"page_{i}"
        files[field] = (
            name or f"page_{i}.png",
            raw,
            ctype or "application/octet-stream",
        )
    data = {
        "lang_hint": lang_hint or "bo",
        "model_name": "monlam-ocr",
    }
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                settings.monlam_ocr_multi_url,
                headers=headers,
                files=files,
                data=data,
            )
    except httpx.HTTPError as exc:
        logger.exception("Monlam OCR multi-page request failed")
        raise HTTPException(
            status_code=502, detail=f"Could not reach Monlam OCR: {exc}"
        ) from exc

    if response.status_code >= 400:
        detail = "Monlam OCR failed"
        try:
            body = response.json()
            if isinstance(body.get("detail"), str):
                detail = body["detail"]
            elif isinstance(body.get("message"), str):
                detail = body["message"]
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)

    payload = response.json() if response.content else {}
    if not isinstance(payload, dict):
        payload = {}
    text = _pick_text(payload)
    if not text:
        raise HTTPException(
            status_code=400,
            detail="OCR found no readable Tibetan text in these images",
        )
    return text


async def ocr_images(
    uploads: list[tuple[bytes, str | None, str | None]],
    *,
    lang_hint: str = "bo",
) -> tuple[str, str]:
    """
    Run single- or multi-page OCR.
    Returns (text, kind) where kind is 'ocr' or 'ocr_multi'.
    """
    if not uploads:
        raise HTTPException(status_code=400, detail="No images provided")
    if len(uploads) == 1:
        raw, name, ctype = uploads[0]
        text = await ocr_single_page(
            raw,
            filename=name or "page.png",
            content_type=ctype or "image/png",
            lang_hint=lang_hint,
        )
        return text, "ocr"
    if len(uploads) > MAX_OCR_PAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Too many images (max {MAX_OCR_PAGES})",
        )
    pages = [
        (raw, name or f"page_{i}.png", ctype or "image/png")
        for i, (raw, name, ctype) in enumerate(uploads, start=1)
    ]
    text = await ocr_multi_page(pages, lang_hint=lang_hint)
    return text, "ocr_multi"
