"""Optional botok tokenizer — fail-open helper for grammar cleanup / case spans / RAG.

Does not download dialect packs on the request path. Place a `general` pack under
`BOTOK_BASE_PATH` (default `data/botok`) or use botok's default
`~/Documents/pybo/dialect_packs/general`.
"""

from __future__ import annotations

import logging
import threading
from functools import lru_cache
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_tokenizer: Any | None = None
_init_attempted = False
_available: bool | None = None


def botok_enabled() -> bool:
    from app.core.config import get_settings

    return bool(get_settings().grammar_use_botok)


def _candidate_pack_paths() -> list[Path]:
    from app.core.config import get_settings

    settings = get_settings()
    base = settings.botok_base_dir
    home_default = Path.home() / "Documents" / "pybo" / "dialect_packs"
    dialect = (settings.botok_dialect_name or "general").strip() or "general"
    return [
        base / dialect,
        home_default / dialect,
    ]


def dialect_pack_ready() -> Path | None:
    """Return path to an on-disk dialect pack, or None."""
    for path in _candidate_pack_paths():
        if (path / "dictionary").is_dir():
            return path
    return None


def botok_available() -> bool:
    """True when enabled and a dialect pack can be loaded (cached)."""
    global _available, _init_attempted, _tokenizer
    if not botok_enabled():
        return False
    if _available is not None:
        return _available
    with _lock:
        if _available is not None:
            return _available
        pack = dialect_pack_ready()
        if pack is None:
            if not _init_attempted:
                logger.info(
                    "botok dialect pack not found under %s — grammar falls back to regex",
                    [str(p) for p in _candidate_pack_paths()],
                )
                _init_attempted = True
            _available = False
            return False
        try:
            from botok import WordTokenizer
            from botok.config import Config

            config = Config.from_path(pack)
            _tokenizer = WordTokenizer(config=config)
            _available = True
            _init_attempted = True
            logger.info("botok WordTokenizer ready (%s)", pack)
        except Exception as exc:
            logger.warning("botok init failed (%s) — regex fallback", exc)
            _tokenizer = None
            _available = False
            _init_attempted = True
        return bool(_available)


def get_word_tokenizer() -> Any | None:
    if not botok_available():
        return None
    return _tokenizer


def tokenize(
    text: str,
    *,
    split_affixes: bool = True,
) -> list[Any]:
    """Tokenize or return [] on any failure (fail-open)."""
    wt = get_word_tokenizer()
    if wt is None or not (text or "").strip():
        return []
    try:
        return list(wt.tokenize(text, split_affixes=split_affixes) or [])
    except Exception as exc:
        logger.warning("botok tokenize failed (%s)", exc)
        return []


def token_text(tok: Any) -> str:
    return str(getattr(tok, "text", "") or "")


def is_wordish(tok: Any) -> bool:
    """Skip punct/space-only tokens."""
    chunk = getattr(tok, "chunk_type", None) or getattr(tok, "pos", None) or ""
    chunk_l = str(chunk).lower()
    if chunk_l in {"punct", "punc", "space", "non-bo", "non_bo"}:
        return False
    t = token_text(tok).strip()
    if not t or t.isspace():
        return False
    # Must contain at least one Tibetan letter
    return any("\u0f40" <= c <= "\u0fbc" for c in t)


@lru_cache(maxsize=1)
def _particle_forms() -> frozenset[str]:
    return frozenset(
        {
            "གིས",
            "གྱིས",
            "ཀྱིས",
            "ཡིས",
            "གི",
            "གྱི",
            "ཀྱི",
            "ཡི",
            "དུ",
            "ཏུ",
            "སུ",
            "རུ",
            "ནས",
            "ལས",
            "ལ",
            "དང",
            "ཀྱང",
            "ཡང",
            "ནི",
        }
    )


def normalize_particle(form: str) -> str:
    return (form or "").strip().rstrip("་").strip()


def extract_particles(text: str, *, max_items: int = 8) -> list[str]:
    """Unique case/particle forms from botok tokens (for RAG queries)."""
    if not botok_available():
        return []
    out: list[str] = []
    seen: set[str] = set()
    for tok in tokenize(text, split_affixes=True):
        if not is_wordish(tok):
            continue
        form = normalize_particle(token_text(tok))
        if form not in _particle_forms() or form in seen:
            continue
        seen.add(form)
        out.append(form)
        if len(out) >= max_items:
            break
    return out


def stem_particle_pairs(text: str) -> list[tuple[str, str, str]]:
    """
    Consecutive (stem, particle, original_span) pairs from affix-split tokens.
    original_span is stem+particle as they appear (best-effort join with tsheg).
    """
    toks = [t for t in tokenize(text, split_affixes=True) if is_wordish(t)]
    pairs: list[tuple[str, str, str]] = []
    particles = _particle_forms()
    for i in range(1, len(toks)):
        prev, cur = toks[i - 1], toks[i]
        particle = normalize_particle(token_text(cur))
        if particle not in particles:
            continue
        # Prefer unaffixed host when botok marks affix_host
        stem_raw = token_text(prev)
        if getattr(prev, "affix_host", False) and getattr(prev, "text_unaffixed", ""):
            stem_raw = prev.text_unaffixed or stem_raw
        stem = stem_raw.strip().rstrip("་").strip()
        if not stem:
            continue
        # Rebuild a highlightable span
        prev_txt = token_text(prev)
        cur_txt = token_text(cur)
        span = f"{prev_txt}{cur_txt}"
        if "་" not in span and not prev_txt.endswith("་"):
            span = f"{stem}་{particle}"
        pairs.append((stem, particle, span.strip()))
    return pairs
