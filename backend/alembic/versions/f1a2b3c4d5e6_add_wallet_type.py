"""add wallet_type to payment_methods

Revision ID: f1a2b3c4d5e6
Revises: e9f4a3b6c7d8
Create Date: 2026-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e9f4a3b6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add wallet_type column to payment_methods table
    op.add_column(
        'payment_methods',
        sa.Column(
            'wallet_type',
            sa.String(50),
            nullable=True,
            comment='Wallet provider: shopeepay, gopay, dana, ovo, linkaja'
        )
    )


def downgrade() -> None:
    # Remove wallet_type column
    op.drop_column('payment_methods', 'wallet_type')
