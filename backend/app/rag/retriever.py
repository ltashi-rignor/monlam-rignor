"""Retrieval interface used by agents for RAG-grounded responses."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.vector_store import get_vector_store


class Retriever:
    async def retrieve_grammar(
        self,
        session: AsyncSession,
        query: str,
        top_k: int = 6,
    ) -> list[dict[str, Any]]:
        store = get_vector_store()
        return await store.similarity_search(
            session, query, top_k=top_k, source_type="grammar"
        )

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
