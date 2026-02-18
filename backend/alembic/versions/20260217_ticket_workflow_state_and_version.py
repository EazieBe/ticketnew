"""Add ticket workflow_state and ticket_version columns

Revision ID: 20260217_twfv
Revises: 20260216_dn
Create Date: 2026-02-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260217_twfv"
down_revision: Union[str, Sequence[str], None] = "20260216_dn"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column("workflow_state", sa.String(), nullable=False, server_default="new"),
    )
    op.add_column(
        "tickets",
        sa.Column("ticket_version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("tickets", "ticket_version")
    op.drop_column("tickets", "workflow_state")
