"""PostgreSQL + pgvector store for Tibetan knowledge chunks."""

from __future__ import annotations

import uuid
from typing import Any, Sequence

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import KnowledgeChunk
from app.rag.embeddings import get_embeddings


class VectorStore:
    async def upsert_chunks(
        self,
        session: AsyncSession,
        chunks: list[dict[str, Any]],
    ) -> int:
        embedder = get_embeddings()
        contents = [c["content"] for c in chunks]
        vectors = embedder.embed(contents)
        rows: list[KnowledgeChunk] = []
        for chunk, vector in zip(chunks, vectors):
            rows.append(
                KnowledgeChunk(
                    id=chunk.get("id") or uuid.uuid4(),
                    source_type=chunk["source_type"],
                    source_name=chunk["source_name"],
                    page_number=chunk.get("page_number"),
                    title=chunk.get("title"),
                    content=chunk["content"],
                    metadata_json=chunk.get("metadata_json") or {},
                    embedding=vector,
                )
            )
        session.add_all(rows)
        await session.flush()
        return len(rows)

    async def clear_source(self, session: AsyncSession, source_name: str) -> None:
        await session.execute(
            delete(KnowledgeChunk).where(KnowledgeChunk.source_name == source_name)
        )

    async def similarity_search(
        self,
        session: AsyncSession,
        query: str,
        *,
        top_k: int = 5,
        source_type: str | None = None,
        source_names: Sequence[str] | None = None,
    ) -> list[dict[str, Any]]:
        from app.core.config import get_settings

        embedder = get_embeddings()
        settings = get_settings()
        wait_s = float(settings.embedding_request_wait_s or 0.0)
        vector = embedder.try_embed_one(query, wait_s=wait_s)
        if vector is None:
            # Model still warming — don’t block the whole request on BGE-M3.
            return []
        # pgvector cosine distance
        vector_literal = "[" + ",".join(str(float(x)) for x in vector) + "]"
        sql = """
            SELECT id, source_type, source_name, page_number, title, content,
                   metadata_json, 1 - (embedding <=> CAST(:embedding AS vector)) AS score
            FROM knowledge_chunks
            WHERE embedding IS NOT NULL
        """
        params: dict[str, Any] = {"embedding": vector_literal, "limit": top_k}
        if source_type:
            sql += " AND source_type = :source_type"
            params["source_type"] = source_type
        if source_names:
            sql += " AND source_name = ANY(:source_names)"
            params["source_names"] = list(source_names)
        sql += " ORDER BY embedding <=> CAST(:embedding AS vector) LIMIT :limit"
        result = await session.execute(text(sql), params)
        rows = result.mappings().all()
        return [dict(r) for r in rows]

    async def count(self, session: AsyncSession) -> int:
        from sqlalchemy import func

        result = await session.scalar(select(func.count()).select_from(KnowledgeChunk))
        return int(result or 0)


_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store
