"""add_clinical_notes_table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-14 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app.models.base


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'clinical_notes',
        sa.Column('id', app.models.base.GUID(), nullable=False),
        sa.Column('patient_id', app.models.base.GUID(), nullable=False),
        sa.Column('clinician_id', app.models.base.GUID(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['clinician_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('clinical_notes', schema=None) as batch_op:
        batch_op.create_index('idx_cn_patient_clinician', ['patient_id', 'clinician_id'], unique=False)
        batch_op.create_index('idx_cn_patient_created', ['patient_id', 'created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_clinical_notes_clinician_id'), ['clinician_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_clinical_notes_patient_id'), ['patient_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('clinical_notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_clinical_notes_patient_id'))
        batch_op.drop_index(batch_op.f('ix_clinical_notes_clinician_id'))
        batch_op.drop_index('idx_cn_patient_created')
        batch_op.drop_index('idx_cn_patient_clinician')

    op.drop_table('clinical_notes')
