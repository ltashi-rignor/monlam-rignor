"""Build grammar-quest rounds from retrieved handbook chunks.

Concept templates live in ``content/grammar_concepts.yaml``.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from app.content.loader import load_yaml


def _data() -> dict[str, Any]:
    return load_yaml("grammar_concepts")


def _concepts() -> list[dict[str, Any]]:
    raw = _data().get("concepts") or []
    return [c for c in raw if isinstance(c, dict)]


def _topic_priority() -> dict[str, tuple[str, ...]]:
    raw = _data().get("topic_priority") or {}
    out: dict[str, tuple[str, ...]] = {}
    if isinstance(raw, dict):
        for k, v in raw.items():
            if isinstance(v, list):
                out[str(k)] = tuple(str(x) for x in v)
    return out


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower())


def _excerpt_sentence(content: str, limit: int = 220) -> str:
    raw = re.sub(r"\s+", " ", (content or "").strip())
    if not raw:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", raw)
    skip_prefixes = (
        "tlan",
        "lesson",
        "classical tibetan",
        "→→",
    )
    for part in parts:
        p = part.strip().lstrip("→ ").strip()
        if len(p) < 40:
            continue
        low = p.lower()
        if any(low.startswith(s) for s in skip_prefixes):
            continue
        if re.fullmatch(r"\d+", p):
            continue
        return p[:limit]
    cleaned = re.sub(
        r"^(TLAN[^.]+\.|Classical Tibetan Grammar Handbook|LESSON \d+)\s*",
        "",
        raw,
        flags=re.I,
    ).strip()
    return (cleaned or raw)[:limit]


def _match_score(concept: dict[str, Any], blob: str) -> int:
    keywords = concept.get("keywords") or []
    return sum(1 for kw in keywords if str(kw).lower() in blob)


def build_rounds_from_rag(
    retrieved: list[dict[str, Any]],
    topic: str,
    *,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Create pick rounds grounded in retrieved handbook passages."""
    if not retrieved:
        return []

    blob = _norm("\n".join(str(r.get("content") or "") for r in retrieved))
    priority = _topic_priority().get(topic) or ()
    scored: list[tuple[int, int, dict[str, Any], dict[str, Any]]] = []

    for concept in _concepts():
        score = _match_score(concept, blob)
        cid = str(concept.get("id") or "")
        if cid in priority:
            score += 1
        if score <= 0:
            continue
        best_chunk = retrieved[0]
        best_chunk_score = -1
        for chunk in retrieved:
            cscore = _match_score(concept, _norm(str(chunk.get("content") or "")))
            if cscore > best_chunk_score:
                best_chunk_score = cscore
                best_chunk = chunk
        pri = priority.index(cid) if cid in priority else 99
        scored.append((score, -pri, concept, best_chunk))

    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)

    rounds: list[dict[str, Any]] = []
    used: set[str] = set()
    for score, _pri, concept, chunk in scored:
        cid = str(concept.get("id") or "")
        if cid in used:
            continue
        used.add(cid)
        page = chunk.get("page_number")
        excerpt = _excerpt_sentence(str(chunk.get("content") or ""))
        opts = [str(o) for o in (concept.get("options") or [])]
        seed = int(
            hashlib.md5(f"{topic}-{page}-{cid}".encode()).hexdigest()[:8],
            16,
        )
        if len(opts) >= 2:
            rot = seed % len(opts)
            opts = opts[rot:] + opts[:rot]

        rounds.append(
            {
                "id": f"rag-{cid}",
                "type": "pick",
                "prompt": str(concept.get("prompt") or ""),
                "sentence": str(concept.get("sentence") or ""),
                "error_span": "",
                "options": opts,
                "answer": str(concept.get("answer") or ""),
                "explanation": str(concept.get("explanation") or "")
                + (f" ({excerpt})" if excerpt else ""),
                "related_rule": str(concept.get("related_rule") or ""),
                "source_ref": f"ཤོག་ངོས། {page}" if page is not None else "དཔེ་དེབ།",
                "handbook_excerpt": excerpt,
                "page_number": page,
            }
        )
        if len(rounds) >= limit:
            break

    if len(rounds) < 3:
        for i, chunk in enumerate(retrieved):
            if len(rounds) >= limit:
                break
            page = chunk.get("page_number")
            excerpt = _excerpt_sentence(str(chunk.get("content") or ""))
            if not excerpt:
                continue
            rid = f"rag-chunk-{page or i}"
            if any(r["id"] == rid for r in rounds):
                continue
            rounds.append(
                {
                    "id": rid,
                    "type": "pick",
                    "prompt": "དཔེ་དེབ་ཀྱི་ནང་དོན་ལྟར་ལན་འདེམས།",
                    "sentence": "འདིའི་སྐོར་གྱི་གནས་ལུགས་གང་ཡིན།",
                    "error_span": "",
                    "options": [
                        "ཕྲད་ཀྱིས་ཚིག་གི་བྱེད་ལས་སྟོན།",
                        "ཕྲད་མེད་ན་ཚིག་མི་འགྲིག",
                        "ཕྲད་ནི་སྔོན་དུ་འཇོག",
                        "ཕྲད་ནི་སྒྲ་ཙམ་ཡིན།",
                    ],
                    "answer": "ཕྲད་ཀྱིས་ཚིག་གི་བྱེད་ལས་སྟོན།",
                    "explanation": excerpt[:200],
                    "related_rule": "ཕྲད།",
                    "source_ref": f"ཤོག་ངོས། {page}" if page is not None else "དཔེ་དེབ།",
                    "handbook_excerpt": excerpt,
                    "page_number": page,
                }
            )

    return rounds[:limit]
