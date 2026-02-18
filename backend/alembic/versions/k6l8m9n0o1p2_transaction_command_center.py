"""Transaction as Command Center - Add management fields

Revision ID: k6l8m9n0o1p2
Revises: j5k7l8m9n0o1
Create Date: 2026-02-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'k6l8m9n0o1p2'
down_revision = 'j5k7l8m9n0o1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make upgrade_request_id nullable and change ondelete to SET NULL
    op.alter_column(
        'billing_transactions',
        'upgrade_request_id',
        existing_type=postgresql.UUID(),
        nullable=True
    )

    # Drop and recreate the foreign key with SET NULL
    op.drop_constraint(
        'billing_transactions_upgrade_request_id_fkey',
        'billing_transactions',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'billing_transactions_upgrade_request_id_fkey',
        'billing_transactions',
        'upgrade_requests',
        ['upgrade_request_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Add coupon/discount fields
    op.add_column(
        'billing_transactions',
        sa.Column('coupon_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        'billing_transactions',
        sa.Column('coupon_code', sa.String(50), nullable=True)
    )
    op.add_column(
        'billing_transactions',
        sa.Column('discount_amount', sa.Integer(), nullable=False, server_default='0')
    )
    op.add_column(
        'billing_transactions',
        sa.Column('discount_description', sa.String(255), nullable=True)
    )

    # Add bonus/extension fields
    op.add_column(
        'billing_transactions',
        sa.Column('bonus_days', sa.Integer(), nullable=False, server_default='0')
    )

    # Add admin management fields
    op.add_column(
        'billing_transactions',
        sa.Column('admin_notes', sa.Text(), nullable=True)
    )
    op.add_column(
        'billing_transactions',
        sa.Column('adjusted_by_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        'billing_transactions',
        sa.Column('adjusted_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'billing_transactions',
        sa.Column('requires_review', sa.Boolean(), nullable=False, server_default='false')
    )

    # Add rejection tracking
    op.add_column(
        'billing_transactions',
        sa.Column('rejection_reason', sa.Text(), nullable=True)
    )
    op.add_column(
        'billing_transactions',
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'billing_transactions',
        sa.Column('rejected_by_id', postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Create foreign keys
    op.create_foreign_key(
        'billing_transactions_coupon_id_fkey',
        'billing_transactions',
        'coupons',
        ['coupon_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'billing_transactions_adjusted_by_id_fkey',
        'billing_transactions',
        'users',
        ['adjusted_by_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'billing_transactions_rejected_by_id_fkey',
        'billing_transactions',
        'users',
        ['rejected_by_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Create indexes
    op.create_index(
        'ix_billing_transactions_requires_review',
        'billing_transactions',
        ['requires_review'],
        unique=False
    )
    op.create_index(
        'ix_billing_transactions_coupon_id',
        'billing_transactions',
        ['coupon_id'],
        unique=False
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_billing_transactions_coupon_id', table_name='billing_transactions')
    op.drop_index('ix_billing_transactions_requires_review', table_name='billing_transactions')

    # Drop foreign keys
    op.drop_constraint('billing_transactions_rejected_by_id_fkey', 'billing_transactions', type_='foreignkey')
    op.drop_constraint('billing_transactions_adjusted_by_id_fkey', 'billing_transactions', type_='foreignkey')
    op.drop_constraint('billing_transactions_coupon_id_fkey', 'billing_transactions', type_='foreignkey')

    # Drop columns
    op.drop_column('billing_transactions', 'rejected_by_id')
    op.drop_column('billing_transactions', 'rejected_at')
    op.drop_column('billing_transactions', 'rejection_reason')
    op.drop_column('billing_transactions', 'requires_review')
    op.drop_column('billing_transactions', 'adjusted_at')
    op.drop_column('billing_transactions', 'adjusted_by_id')
    op.drop_column('billing_transactions', 'admin_notes')
    op.drop_column('billing_transactions', 'bonus_days')
    op.drop_column('billing_transactions', 'discount_description')
    op.drop_column('billing_transactions', 'discount_amount')
    op.drop_column('billing_transactions', 'coupon_code')
    op.drop_column('billing_transactions', 'coupon_id')

    # Restore upgrade_request_id to NOT NULL with CASCADE
    op.drop_constraint(
        'billing_transactions_upgrade_request_id_fkey',
        'billing_transactions',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'billing_transactions_upgrade_request_id_fkey',
        'billing_transactions',
        'upgrade_requests',
        ['upgrade_request_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.alter_column(
        'billing_transactions',
        'upgrade_request_id',
        existing_type=postgresql.UUID(),
        nullable=False
    )
