"""Retrieval interface used by agents for RAG-grounded responses."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.vector_store import get_vector_store

# Prefer OCR-clean grammar corpora. Classical handbook pypdf extract is garbled
# (0% Tibetan unicode) until re-OCR'd — filtered out by _is_usable_grammar_chunk.
GRAMMAR_SOURCE_NAMES = (
    "hopkins-napper-grammar-summaries",
    "classical-tibetan-grammar-handbook",
)

_PARTICLE_PROBES = (
    "གིས",
    "གྱིས",
    "ཀྱིས",
    "ཡིས",
    "གི",
    "ཀྱི",
    "གྱི",
    "ཡི",
    "ལ་",
    "ནས་",
    "དུ་",
    "སུ་",
    "རུ་",
    "ཏུ་",
    "ལས་",
    "དང་",
    "ཀྱང་",
    "ཡང་",
    "ནི་",
)


def _tibetan_char_count(text: str) -> int:
    return len(re.findall(r"[\u0f00-\u0fff]", text or ""))


def _is_usable_grammar_chunk(row: dict[str, Any]) -> bool:
    """Drop empty/title-only pages that cannot ground Tibetan rules."""
    content = row.get("content") or ""
    tib = _tibetan_char_count(content)
    source = row.get("source_name") or ""
    if tib >= 20:
        return True
    # Bilingual OCR pages (Hopkins or Classical) with thinner Tibetan.
    if source in GRAMMAR_SOURCE_NAMES and tib >= 8 and len(content) >= 120:
        return True
    return False


def _grammar_queries(student_text: str) -> list[str]:
    text = (student_text or "").strip()
    queries: list[str] = []
    if text:
        queries.append(text[:1600])
    queries.append("བོད་ཡིག་བརྡ་སྤྲོད། རྣམ་དབྱེ། ཕྲད། ཞེ་ས། འབྲེལ་སྒྲ།")
    for particle in _PARTICLE_PROBES:
        if particle in text:
            queries.append(f"{particle} རྣམ་དབྱེ། ཕྲད། བཀོལ་སྤྱོད།")
            break
    # de-dupe preserving order
    seen: set[str] = set()
    out: list[str] = []
    for q in queries:
        key = q.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


class Retriever:
    async def retrieve_grammar(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 8,
        *,
        multi_query: bool = True,
    ) -> list[dict[str, Any]]:
        """
        Retrieve grammar ground-truth chunks for Melong.
        Uses multi-query fusion and drops unusable (non-Tibetan) extracts.
        """
        store = get_vector_store()
        queries = _grammar_queries(query) if multi_query else [query]
        merged: dict[Any, dict[str, Any]] = {}
        fetch_k = max(top_k * 2, 10)

        for q in queries:
            hits = await store.similarity_search(
                session,
                q,
                top_k=fetch_k,
                source_type="grammar",
                source_names=list(GRAMMAR_SOURCE_NAMES),
            )
            for hit in hits:
                if not _is_usable_grammar_chunk(hit):
                    continue
                key = hit.get("id") or (hit.get("source_name"), hit.get("page_number"), hit.get("content", "")[:80])
                prev = merged.get(key)
                score = float(hit.get("score") or 0.0)
                if prev is None or score > float(prev.get("score") or 0.0):
                    merged[key] = hit

        ranked = sorted(
            merged.values(),
            key=lambda r: float(r.get("score") or 0.0),
            reverse=True,
        )
        return ranked[:top_k]

    async def retrieve(
        self,
        session: AsyncSession,
        query: str,
        *,
        top_k: int = 5,
        source_type: str | None = None,
    ) -> list[dict[str, Any]]:
        store = get_vector_store()
        return await store.similarity_search(
            session, query, top_k=top_k, source_type=source_type
        )


_retriever: Retriever | None = None


def get_retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever
