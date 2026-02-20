"""Add ticket created_by and workflow_state CHECK constraint

Revision ID: 20260219_cbwc
Revises: 20260218_nroenum
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Valid workflow_state values (must match models.TicketWorkflowState)
VALID_WORKFLOW_STATES = (
    "new", "scheduled", "claimed", "onsite", "offsite",
    "followup_required", "needstech", "goback_required",
    "pending_dispatch_review", "pending_approval", "ready_to_archive",
    "nro_phase1_scheduled", "nro_phase1_complete_pending_phase2", "nro_phase1_goback_required",
    "nro_phase2_scheduled", "nro_phase2_goback_required", "nro_ready_for_completion",
)

revision: str = "20260219_cbwc"
down_revision: Union[str, Sequence[str], None] = "20260218_nroenum"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.user_id"), nullable=True),
    )
    # DB-level validation: only allow known workflow states
    states = ", ".join(repr(s) for s in VALID_WORKFLOW_STATES)
    op.create_check_constraint(
        "ck_tickets_workflow_state",
        "tickets",
        f"workflow_state IN ({states})",
    )


def downgrade() -> None:
    op.drop_constraint("ck_tickets_workflow_state", "tickets", type_="check")
    op.drop_column("tickets", "created_by")
