"""Add HNSW index for knowledge_chunks.embedding (pgvector).

Revision ID: 20260801_0003
Revises: 20260801_0002
Create Date: 2026-08-01
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "20260801_0003"
down_revision: Union[str, None] = "20260801_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cosine distance operator class for <=> queries in vector_store.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_embedding_hnsw
        ON knowledge_chunks
        USING hnsw (embedding vector_cosine_ops)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_practice_history_user_created
        ON practice_history (user_id, created_at DESC)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_mistakes_user_created
        ON mistakes (user_id, created_at DESC)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_mistakes_user_created")
    op.execute("DROP INDEX IF EXISTS ix_practice_history_user_created")
    op.execute("DROP INDEX IF EXISTS ix_knowledge_chunks_embedding_hnsw")
