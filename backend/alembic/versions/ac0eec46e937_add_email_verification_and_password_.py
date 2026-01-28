"""add_email_verification_and_password_reset_tokens

Revision ID: ac0eec46e937
Revises: 5c5b21b248cf
Create Date: 2026-01-24 23:21:59.420866

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ac0eec46e937'
down_revision: Union[str, Sequence[str], None] = '5c5b21b248cf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add email verification and password reset token fields to users table."""
    # Add verification_token column
    op.add_column('users', sa.Column('verification_token', sa.String(length=255), nullable=True))

    # Add reset_token column
    op.add_column('users', sa.Column('reset_token', sa.String(length=255), nullable=True))

    # Add reset_token_expires column
    op.add_column('users', sa.Column('reset_token_expires', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Remove email verification and password reset token fields from users table."""
    # Drop columns in reverse order
    op.drop_column('users', 'reset_token_expires')
    op.drop_column('users', 'reset_token')
    op.drop_column('users', 'verification_token')
