"""merge_created_by_and_workflow_check

Revision ID: 68d75a6160a0
Revises: 14c0b0a89f81, 20260219_cbwc
Create Date: 2026-02-19 21:34:28.213791

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68d75a6160a0'
down_revision: Union[str, Sequence[str], None] = ('14c0b0a89f81', '20260219_cbwc')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
