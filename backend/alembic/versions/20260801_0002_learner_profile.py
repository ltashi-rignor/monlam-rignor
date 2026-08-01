"""Add users.learner_profile JSONB.

Revision ID: 20260801_0002
Revises: 20260801_0001
Create Date: 2026-08-01
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "20260801_0002"
down_revision: Union[str, None] = "20260801_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS learner_profile JSONB DEFAULT '{}'::jsonb"
        )
    )


def downgrade() -> None:
    op.drop_column("users", "learner_profile")
