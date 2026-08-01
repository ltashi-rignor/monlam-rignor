"""Curated offline interactive lessons — loaded from ``content/lessons.yaml``."""

from __future__ import annotations

from typing import Any

from app.content.loader import load_yaml


def _data() -> dict[str, Any]:
    return load_yaml("lessons")


def get_lesson_bank() -> dict[str, dict[str, Any]]:
    lessons = _data().get("lessons") or {}
    return dict(lessons) if isinstance(lessons, dict) else {}


def get_theme_hints() -> list[tuple[str, tuple[str, ...]]]:
    raw = _data().get("theme_hints") or []
    out: list[tuple[str, tuple[str, ...]]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        theme = str(item.get("theme") or "")
        hints = item.get("hints") or []
        if theme and isinstance(hints, list):
            out.append((theme, tuple(str(h) for h in hints)))
    return out


def get_content_version() -> int:
    try:
        return int(_data().get("content_version") or 2)
    except (TypeError, ValueError):
        return 2


def pick_theme(text: str) -> str:
    """Score themes by hint hits so specific topics beat generic words."""
    blob = (text or "").lower()
    best_theme = "default"
    best_score = 0
    for theme, hints in get_theme_hints():
        score = sum(1 for h in hints if h.lower() in blob)
        if score > best_score:
            best_score = score
            best_theme = theme
    return best_theme


CONTENT_VERSION = get_content_version()
LESSON_BANK = get_lesson_bank()
THEME_HINTS = get_theme_hints()
