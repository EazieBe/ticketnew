"""Add NRO phase scheduling fields to tickets

Revision ID: 20260217_nroph
Revises: 20260217_twfv
Create Date: 2026-02-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260217_nroph"
down_revision: Union[str, Sequence[str], None] = "20260217_twfv"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tickets", sa.Column("nro_phase1_scheduled_date", sa.Date(), nullable=True))
    op.add_column("tickets", sa.Column("nro_phase1_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tickets", sa.Column("nro_phase1_state", sa.String(), nullable=True))
    op.add_column("tickets", sa.Column("nro_phase2_scheduled_date", sa.Date(), nullable=True))
    op.add_column("tickets", sa.Column("nro_phase2_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tickets", sa.Column("nro_phase2_state", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("tickets", "nro_phase2_state")
    op.drop_column("tickets", "nro_phase2_completed_at")
    op.drop_column("tickets", "nro_phase2_scheduled_date")
    op.drop_column("tickets", "nro_phase1_state")
    op.drop_column("tickets", "nro_phase1_completed_at")
    op.drop_column("tickets", "nro_phase1_scheduled_date")
