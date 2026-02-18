"""Drop ix_tickets_notes - btree cannot index long text (imported emails)

Revision ID: 20260216_dn
Revises: 20260201_perf_idx
Create Date: 2026-02-16

"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260216_dn"
down_revision: Union[str, Sequence[str], None] = "20260201_perf_idx"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop ix_tickets_notes - btree index cannot hold values > 2704 bytes."""
    op.execute("DROP INDEX IF EXISTS ix_tickets_notes")


def downgrade() -> None:
    """Recreate index - may fail if tickets have long notes."""
    op.execute("CREATE INDEX IF NOT EXISTS ix_tickets_notes ON tickets (notes)")
