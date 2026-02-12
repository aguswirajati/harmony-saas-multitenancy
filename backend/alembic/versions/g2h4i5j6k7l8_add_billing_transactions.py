"""Add billing transactions table

Revision ID: g2h4i5j6k7l8
Revises: f1a2b3c4d5e6
Create Date: 2026-02-12 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'g2h4i5j6k7l8'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create billing_transactions table."""

    op.create_table(
        'billing_transactions',
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

        # Transaction fields
        sa.Column('transaction_number', sa.String(50), nullable=False, comment='Unique transaction/invoice number'),
        sa.Column('upgrade_request_id', sa.UUID(), nullable=False, comment='Associated upgrade request'),
        sa.Column('amount', sa.Integer(), nullable=False, comment='Transaction amount'),
        sa.Column('currency', sa.String(3), nullable=False, server_default="'IDR'", comment='Currency code'),
        sa.Column('billing_period', sa.String(20), nullable=False, comment='monthly or yearly'),
        sa.Column('payment_method_id', sa.UUID(), nullable=True, comment='Payment method used'),
        sa.Column('status', sa.String(50), nullable=False, server_default="'pending'", comment='Transaction status'),
        sa.Column('invoice_date', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()'), comment='Invoice generation date'),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True, comment='Payment confirmation date'),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True, comment='Cancellation date'),
        sa.Column('notes', sa.Text(), nullable=True, comment='Internal notes'),
        sa.Column('description', sa.Text(), nullable=True, comment='Line item description'),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['upgrade_request_id'], ['upgrade_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['payment_method_id'], ['payment_methods.id'], ondelete='SET NULL'),
    )

    # Indexes
    op.create_index('ix_billing_transactions_transaction_number', 'billing_transactions', ['transaction_number'], unique=True)
    op.create_index('ix_billing_transactions_tenant_id', 'billing_transactions', ['tenant_id'])
    op.create_index('ix_billing_transactions_upgrade_request_id', 'billing_transactions', ['upgrade_request_id'])
    op.create_index('ix_billing_transactions_status', 'billing_transactions', ['status'])
    op.create_index('ix_billing_transactions_tenant_status', 'billing_transactions', ['tenant_id', 'status'])


def downgrade() -> None:
    """Drop billing_transactions table."""

    op.drop_index('ix_billing_transactions_tenant_status', table_name='billing_transactions')
    op.drop_index('ix_billing_transactions_status', table_name='billing_transactions')
    op.drop_index('ix_billing_transactions_upgrade_request_id', table_name='billing_transactions')
    op.drop_index('ix_billing_transactions_tenant_id', table_name='billing_transactions')
    op.drop_index('ix_billing_transactions_transaction_number', table_name='billing_transactions')
    op.drop_table('billing_transactions')
