"""Add coupon system tables

Revision ID: j5k7l8m9n0o1
Revises: i4j6k7l8m9n0
Create Date: 2026-02-13 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'j5k7l8m9n0o1'
down_revision: Union[str, None] = 'i4j6k7l8m9n0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create coupons table
    op.create_table(
        'coupons',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('discount_type', sa.String(20), nullable=False),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='IDR'),
        sa.Column('max_redemptions', sa.Integer(), nullable=True),
        sa.Column('current_redemptions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_redemptions_per_tenant', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('valid_for_tiers', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('valid_for_billing_periods', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('first_time_only', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('new_customers_only', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('duration_months', sa.Integer(), nullable=True),
        sa.Column('minimum_amount', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uix_coupon_code'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['deleted_by_id'], ['users.id'], ondelete='SET NULL'),
    )

    op.create_index('ix_coupons_code', 'coupons', ['code'])
    op.create_index('ix_coupons_discount_type', 'coupons', ['discount_type'])
    op.create_index('ix_coupons_valid_until', 'coupons', ['valid_until'])

    # Create coupon_redemptions table
    op.create_table(
        'coupon_redemptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('coupon_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('upgrade_request_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('discount_type', sa.String(20), nullable=False),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False),
        sa.Column('discount_applied', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('applied_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_expired', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['coupon_id'], ['coupons.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['upgrade_request_id'], ['upgrade_requests.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['deleted_by_id'], ['users.id'], ondelete='SET NULL'),
    )

    op.create_index('ix_coupon_redemptions_coupon_id', 'coupon_redemptions', ['coupon_id'])
    op.create_index('ix_coupon_redemptions_tenant_id', 'coupon_redemptions', ['tenant_id'])
    op.create_index('ix_coupon_redemptions_tenant_coupon', 'coupon_redemptions', ['tenant_id', 'coupon_id'])

    # Add coupon fields to upgrade_requests table
    op.add_column('upgrade_requests', sa.Column('coupon_code', sa.String(50), nullable=True))
    op.add_column('upgrade_requests', sa.Column('discount_amount', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('upgrade_requests', sa.Column('final_amount', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove coupon fields from upgrade_requests
    op.drop_column('upgrade_requests', 'final_amount')
    op.drop_column('upgrade_requests', 'discount_amount')
    op.drop_column('upgrade_requests', 'coupon_code')

    op.drop_table('coupon_redemptions')
    op.drop_table('coupons')
