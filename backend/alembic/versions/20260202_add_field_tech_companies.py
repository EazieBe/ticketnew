"""add field tech companies

Revision ID: 20260202_add_field_tech_companies
Revises: 056b381ee2a8
Create Date: 2026-02-02 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260202_add_field_tech_companies'
down_revision: Union[str, Sequence[str], None] = '056b381ee2a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'field_tech_companies',
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('company_name', sa.String(), nullable=False),
        sa.Column('company_number', sa.String(), nullable=True),
        sa.Column('business_phone', sa.String(), nullable=True),
        sa.Column('other_phones', sa.Text(), nullable=True),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('state', sa.String(), nullable=True),
        sa.Column('zip', sa.String(), nullable=True),
        sa.Column('region', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('service_radius_miles', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('company_id'),
    )
    op.create_index(op.f('ix_field_tech_companies_company_id'), 'field_tech_companies', ['company_id'], unique=False)

    with op.batch_alter_table('field_techs') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('tech_number', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('service_radius_miles', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_field_techs_company_id', 'field_tech_companies', ['company_id'], ['company_id'])


def downgrade() -> None:
    with op.batch_alter_table('field_techs') as batch_op:
        batch_op.drop_constraint('fk_field_techs_company_id', type_='foreignkey')
        batch_op.drop_column('service_radius_miles')
        batch_op.drop_column('tech_number')
        batch_op.drop_column('company_id')

    op.drop_index(op.f('ix_field_tech_companies_company_id'), table_name='field_tech_companies')
    op.drop_table('field_tech_companies')
