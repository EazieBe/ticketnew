"""merge_heads

Revision ID: 14c0b0a89f81
Revises: 20260201_perf_idx, 20260202_add_field_tech_companies
Create Date: 2026-02-16 17:20:40.065621

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14c0b0a89f81'
down_revision: Union[str, Sequence[str], None] = ('20260201_perf_idx', '20260202_add_field_tech_companies')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema. Drop ix_tickets_notes - btree cannot index long text (emails)."""
    op.execute("DROP INDEX IF EXISTS ix_tickets_notes")


def downgrade() -> None:
    """Recreate index - may fail if tickets have long notes."""
    op.execute("CREATE INDEX IF NOT EXISTS ix_tickets_notes ON tickets (notes)")
