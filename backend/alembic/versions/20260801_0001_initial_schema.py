"""Initial schema + legacy email_verified backfill.

Revision ID: 20260801_0001
Revises:
Create Date: 2026-08-01
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.database.session import Base
from app.models import entities  # noqa: F401

revision: str = "20260801_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    # One-time legacy backfill (safe to re-run)
    op.execute(
        sa.text(
            """
            UPDATE users
            SET email_verified = TRUE
            WHERE password_hash IS NOT NULL
              AND email_verified IS DISTINCT FROM TRUE
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
