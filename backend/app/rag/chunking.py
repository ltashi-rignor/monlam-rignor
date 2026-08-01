"""Simple Tibetan-aware text chunking for RAG ingest."""

from __future__ import annotations

import re


def chunk_tibetan(
    text: str,
    *,
    max_chars: int = 1200,
    min_chars: int = 180,
) -> list[str]:
    """
    Split long OCR/page text into overlapping-friendly chunks on shad (།) when possible.
    Short pages stay as a single chunk.
    """
    cleaned = re.sub(r"[ \t]+", " ", (text or "").strip())
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    if not cleaned:
        return []
    if len(cleaned) <= max_chars:
        return [cleaned]

    # Prefer sentence-ish breaks on Tibetan shad, else newlines, else hard wrap.
    parts = re.split(r"(?<=།)\s*", cleaned)
    if len(parts) == 1:
        parts = re.split(r"\n+", cleaned)
    if len(parts) == 1:
        parts = [
            cleaned[i : i + max_chars]
            for i in range(0, len(cleaned), max_chars)
        ]

    chunks: list[str] = []
    buf = ""
    for part in parts:
        piece = part.strip()
        if not piece:
            continue
        candidate = f"{buf} {piece}".strip() if buf else piece
        if len(candidate) <= max_chars:
            buf = candidate
            continue
        if buf:
            chunks.append(buf)
        if len(piece) <= max_chars:
            buf = piece
        else:
            for i in range(0, len(piece), max_chars):
                chunks.append(piece[i : i + max_chars].strip())
            buf = ""
    if buf:
        chunks.append(buf)

    # Merge tiny trailing fragments into the previous chunk when possible.
    merged: list[str] = []
    for chunk in chunks:
        if merged and len(chunk) < min_chars and len(merged[-1]) + len(chunk) + 1 <= max_chars + 80:
            merged[-1] = f"{merged[-1]} {chunk}".strip()
        else:
            merged.append(chunk)
    return [c for c in merged if c]
