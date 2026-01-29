"""add_user_invitation_fields

Revision ID: b7f2a1c3d4e5
Revises: a53b92ec41a0
Create Date: 2026-01-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b7f2a1c3d4e5'
down_revision: Union[str, Sequence[str], None] = 'a53b92ec41a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add invitation fields to users table."""
    op.add_column('users', sa.Column('invitation_token', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('invitation_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('invited_by_id', postgresql.UUID(as_uuid=True), nullable=True))

    op.create_foreign_key(
        'fk_users_invited_by_id',
        'users', 'users',
        ['invited_by_id'], ['id'],
    )


def downgrade() -> None:
    """Remove invitation fields from users table."""
    op.drop_constraint('fk_users_invited_by_id', 'users', type_='foreignkey')
    op.drop_column('users', 'invited_by_id')
    op.drop_column('users', 'invitation_expires_at')
    op.drop_column('users', 'invitation_token')
