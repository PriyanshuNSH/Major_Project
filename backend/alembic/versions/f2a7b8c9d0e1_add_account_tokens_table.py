"""add_account_tokens_table

Revision ID: f2a7b8c9d0e1
Revises: e9da16f9d09f
Create Date: 2026-11-14 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app.models.base


# revision identifiers, used by Alembic.
revision: str = 'f2a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e9da16f9d09f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create account_tokens table and indexes."""
    op.create_table(
        'account_tokens',
        sa.Column('id', app.models.base.GUID(), nullable=False),
        sa.Column('user_id', app.models.base.GUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('token_type', sa.String(length=32), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_account_tokens_user_id'), 'account_tokens', ['user_id'], unique=False)
    op.create_index(op.f('ix_account_tokens_token_hash'), 'account_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_account_tokens_token_type'), 'account_tokens', ['token_type'], unique=False)
    op.create_index('idx_account_tokens_hash_type_used', 'account_tokens', ['token_hash', 'token_type', 'is_used'], unique=False)


def downgrade() -> None:
    """Drop account_tokens table and indexes."""
    op.drop_index('idx_account_tokens_hash_type_used', table_name='account_tokens')
    op.drop_index(op.f('ix_account_tokens_token_type'), table_name='account_tokens')
    op.drop_index(op.f('ix_account_tokens_token_hash'), table_name='account_tokens')
    op.drop_index(op.f('ix_account_tokens_user_id'), table_name='account_tokens')
    op.drop_table('account_tokens')
