"""Add subscription tiers, payment methods, and upgrade requests

Revision ID: e9f4a3b6c7d8
Revises: d8f3a2b5c6e7
Create Date: 2026-02-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e9f4a3b6c7d8'
down_revision: Union[str, Sequence[str], None] = 'd8f3a2b5c6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create subscription_tiers, payment_methods, and upgrade_requests tables."""

    # =========================================================================
    # SUBSCRIPTION TIERS TABLE
    # =========================================================================
    op.create_table(
        'subscription_tiers',
        # BaseModel fields
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('updated_by_id', sa.UUID(), nullable=True),
        sa.Column('deleted_by_id', sa.UUID(), nullable=True),

        # Tier-specific fields
        sa.Column('code', sa.String(50), nullable=False, comment='Unique tier code'),
        sa.Column('display_name', sa.String(100), nullable=False, comment='Display name'),
        sa.Column('description', sa.Text(), nullable=True, comment='Tier description'),

        # Pricing
        sa.Column('price_monthly', sa.Integer(), nullable=False, server_default='0', comment='Monthly price'),
        sa.Column('price_yearly', sa.Integer(), nullable=False, server_default='0', comment='Yearly price'),
        sa.Column('currency', sa.String(3), nullable=False, server_default="'IDR'", comment='Currency code'),

        # Limits
        sa.Column('max_users', sa.Integer(), nullable=False, server_default='5', comment='Max users (-1 unlimited)'),
        sa.Column('max_branches', sa.Integer(), nullable=False, server_default='1', comment='Max branches (-1 unlimited)'),
        sa.Column('max_storage_gb', sa.Integer(), nullable=False, server_default='1', comment='Max storage GB (-1 unlimited)'),

        # Features & Display
        sa.Column('features', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]', comment='Feature flags'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0', comment='Display order'),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='true', comment='Visible on pricing page'),
        sa.Column('is_recommended', sa.Boolean(), nullable=False, server_default='false', comment='Highlighted tier'),
        sa.Column('trial_days', sa.Integer(), nullable=False, server_default='0', comment='Trial days'),

        sa.PrimaryKeyConstraint('id'),
    )

    # Indexes for subscription_tiers
    op.create_index('ix_subscription_tiers_code', 'subscription_tiers', ['code'], unique=True)

    # =========================================================================
    # PAYMENT METHODS TABLE
    # =========================================================================
    op.create_table(
        'payment_methods',
        # BaseModel fields
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('updated_by_id', sa.UUID(), nullable=True),
        sa.Column('deleted_by_id', sa.UUID(), nullable=True),

        # Payment method fields
        sa.Column('code', sa.String(50), nullable=False, comment='Unique method code'),
        sa.Column('name', sa.String(100), nullable=False, comment='Display name'),
        sa.Column('type', sa.String(50), nullable=False, comment='Type: bank_transfer, qris'),

        # Bank transfer details
        sa.Column('bank_name', sa.String(100), nullable=True, comment='Bank name'),
        sa.Column('account_number', sa.String(50), nullable=True, comment='Account number'),
        sa.Column('account_name', sa.String(100), nullable=True, comment='Account holder name'),

        # QRIS
        sa.Column('qris_image_file_id', sa.UUID(), nullable=True, comment='QRIS image file ID'),

        # Instructions & Display
        sa.Column('instructions', sa.Text(), nullable=True, comment='Payment instructions'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0', comment='Display order'),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='true', comment='Available for selection'),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['qris_image_file_id'], ['files.id'], ondelete='SET NULL'),
    )

    # Indexes for payment_methods
    op.create_index('ix_payment_methods_code', 'payment_methods', ['code'], unique=True)
    op.create_index('ix_payment_methods_type', 'payment_methods', ['type'])

    # =========================================================================
    # UPGRADE REQUESTS TABLE
    # =========================================================================
    op.create_table(
        'upgrade_requests',
        # BaseModel fields
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('updated_by_id', sa.UUID(), nullable=True),
        sa.Column('deleted_by_id', sa.UUID(), nullable=True),

        # TenantScopedModel fields
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=True),

        # Request identification
        sa.Column('request_number', sa.String(50), nullable=False, comment='Human-readable request number'),

        # Tier change
        sa.Column('current_tier_code', sa.String(50), nullable=False, comment='Current tier at request time'),
        sa.Column('target_tier_code', sa.String(50), nullable=False, comment='Requested target tier'),

        # Pricing snapshot
        sa.Column('billing_period', sa.String(20), nullable=False, comment='monthly or yearly'),
        sa.Column('amount', sa.Integer(), nullable=False, comment='Amount to pay'),
        sa.Column('currency', sa.String(3), nullable=False, server_default="'IDR'", comment='Currency code'),
        sa.Column('tier_snapshot', sa.Text(), nullable=True, comment='JSON snapshot of tier details'),

        # Payment
        sa.Column('payment_method_id', sa.UUID(), nullable=True, comment='Selected payment method'),
        sa.Column('payment_proof_file_id', sa.UUID(), nullable=True, comment='Payment proof file'),
        sa.Column('payment_proof_uploaded_at', sa.DateTime(timezone=True), nullable=True, comment='Proof upload time'),

        # Status
        sa.Column('status', sa.String(50), nullable=False, server_default="'pending'", comment='Request status'),

        # Review
        sa.Column('reviewed_by_id', sa.UUID(), nullable=True, comment='Reviewer user ID'),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True, comment='Review time'),
        sa.Column('review_notes', sa.Text(), nullable=True, comment='Internal notes'),
        sa.Column('rejection_reason', sa.Text(), nullable=True, comment='Rejection reason for tenant'),

        # Timing
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True, comment='Request expiry'),
        sa.Column('applied_at', sa.DateTime(timezone=True), nullable=True, comment='Tier upgrade application time'),

        # Requestor
        sa.Column('requested_by_id', sa.UUID(), nullable=True, comment='User who created request'),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['payment_method_id'], ['payment_methods.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['payment_proof_file_id'], ['files.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['requested_by_id'], ['users.id'], ondelete='SET NULL'),
    )

    # Indexes for upgrade_requests
    op.create_index('ix_upgrade_requests_request_number', 'upgrade_requests', ['request_number'], unique=True)
    op.create_index('ix_upgrade_requests_tenant_id', 'upgrade_requests', ['tenant_id'])
    op.create_index('ix_upgrade_requests_status', 'upgrade_requests', ['status'])
    op.create_index('ix_upgrade_requests_payment_method_id', 'upgrade_requests', ['payment_method_id'])
    op.create_index('ix_upgrade_requests_tenant_status', 'upgrade_requests', ['tenant_id', 'status'])
    op.create_index('ix_upgrade_requests_status_created', 'upgrade_requests', ['status', 'created_at'])
    op.create_index('ix_upgrade_requests_tenant_created', 'upgrade_requests', ['tenant_id', 'created_at'])


def downgrade() -> None:
    """Drop subscription system tables."""

    # Drop upgrade_requests indexes and table
    op.drop_index('ix_upgrade_requests_tenant_created', table_name='upgrade_requests')
    op.drop_index('ix_upgrade_requests_status_created', table_name='upgrade_requests')
    op.drop_index('ix_upgrade_requests_tenant_status', table_name='upgrade_requests')
    op.drop_index('ix_upgrade_requests_payment_method_id', table_name='upgrade_requests')
    op.drop_index('ix_upgrade_requests_status', table_name='upgrade_requests')
    op.drop_index('ix_upgrade_requests_tenant_id', table_name='upgrade_requests')
    op.drop_index('ix_upgrade_requests_request_number', table_name='upgrade_requests')
    op.drop_table('upgrade_requests')

    # Drop payment_methods indexes and table
    op.drop_index('ix_payment_methods_type', table_name='payment_methods')
    op.drop_index('ix_payment_methods_code', table_name='payment_methods')
    op.drop_table('payment_methods')

    # Drop subscription_tiers indexes and table
    op.drop_index('ix_subscription_tiers_code', table_name='subscription_tiers')
    op.drop_table('subscription_tiers')
