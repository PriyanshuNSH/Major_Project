"""add_clinician_patient_assignments

Revision ID: a1b2c3d4e5f6
Revises: f2a7b8c9d0e1
Create Date: 2026-11-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app.models.base


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f2a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'clinician_patient_assignments',
        sa.Column('id', app.models.base.GUID(), nullable=False),
        sa.Column('clinician_id', app.models.base.GUID(), nullable=False),
        sa.Column('patient_id', app.models.base.GUID(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['clinician_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('clinician_id', 'patient_id', name='uq_clinician_patient')
    )
    with op.batch_alter_table('clinician_patient_assignments', schema=None) as batch_op:
        batch_op.create_index('idx_cpa_clinician_active', ['clinician_id', 'is_active'], unique=False)
        batch_op.create_index('idx_cpa_patient_active', ['patient_id', 'is_active'], unique=False)
        batch_op.create_index(batch_op.f('ix_clinician_patient_assignments_clinician_id'), ['clinician_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_clinician_patient_assignments_patient_id'), ['patient_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('clinician_patient_assignments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_clinician_patient_assignments_patient_id'))
        batch_op.drop_index(batch_op.f('ix_clinician_patient_assignments_clinician_id'))
        batch_op.drop_index('idx_cpa_patient_active')
        batch_op.drop_index('idx_cpa_clinician_active')

    op.drop_table('clinician_patient_assignments')
