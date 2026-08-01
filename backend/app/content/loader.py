"""Load shared fallback content from repo-root ``content/*.yaml``."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

# backend/app/content/loader.py → parents[3] = repo root
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CONTENT_DIR = _REPO_ROOT / "content"


def content_dir() -> Path:
    return _CONTENT_DIR


@lru_cache(maxsize=32)
def load_yaml(name: str) -> dict[str, Any]:
    """Load ``content/<name>.yaml`` (name without extension). Cached in-process."""
    path = _CONTENT_DIR / f"{name}.yaml"
    if not path.is_file():
        raise FileNotFoundError(f"Content YAML not found: {path}")
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Expected mapping in {path}")
    return data


def reload_all() -> None:
    """Clear cache (useful in tests / hot reload)."""
    load_yaml.cache_clear()
