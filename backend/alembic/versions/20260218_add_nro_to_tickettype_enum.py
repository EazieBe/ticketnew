"""Ensure tickettype enum includes nro

Revision ID: 20260218_nroenum
Revises: 20260217_nroph
Create Date: 2026-02-18
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260218_nroenum"
down_revision: Union[str, Sequence[str], None] = "20260217_nroph"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL enum alteration is additive; IF NOT EXISTS keeps migration idempotent.
    op.execute("ALTER TYPE tickettype ADD VALUE IF NOT EXISTS 'nro'")


def downgrade() -> None:
    # Removing enum values is not safe in PostgreSQL without recreating the type.
    pass
