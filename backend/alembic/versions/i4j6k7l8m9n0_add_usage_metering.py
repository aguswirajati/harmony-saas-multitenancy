"""Add usage metering tables

Revision ID: i4j6k7l8m9n0
Revises: h3i5j6k7l8m9
Create Date: 2026-02-13 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'i4j6k7l8m9n0'
down_revision: Union[str, None] = 'h3i5j6k7l8m9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create usage_records table
    op.create_table(
        'usage_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('metric_type', sa.String(50), nullable=False),
        sa.Column('value', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('recorded_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['deleted_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('tenant_id', 'metric_type', 'recorded_date', name='uix_usage_record_tenant_metric_date'),
    )

    op.create_index('ix_usage_records_tenant_id', 'usage_records', ['tenant_id'])
    op.create_index('ix_usage_records_metric_type', 'usage_records', ['metric_type'])
    op.create_index('ix_usage_records_recorded_date', 'usage_records', ['recorded_date'])
    op.create_index('ix_usage_records_tenant_date', 'usage_records', ['tenant_id', 'recorded_date'])
    op.create_index('ix_usage_records_metric_date', 'usage_records', ['metric_type', 'recorded_date'])

    # Create usage_quotas table
    op.create_table(
        'usage_quotas',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('metric_type', sa.String(50), nullable=False),
        sa.Column('limit_value', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('current_value', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('reset_date', sa.Date(), nullable=True),
        sa.Column('alert_threshold', sa.Integer(), nullable=False, server_default='80'),
        sa.Column('alert_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['deleted_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('tenant_id', 'metric_type', name='uix_usage_quota_tenant_metric'),
    )

    op.create_index('ix_usage_quotas_tenant_id', 'usage_quotas', ['tenant_id'])
    op.create_index('ix_usage_quotas_metric_type', 'usage_quotas', ['metric_type'])

    # Create usage_alerts table
    op.create_table(
        'usage_alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('metric_type', sa.String(50), nullable=False),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('usage_percentage', sa.Integer(), nullable=False),
        sa.Column('current_value', sa.BigInteger(), nullable=False),
        sa.Column('limit_value', sa.BigInteger(), nullable=False),
        sa.Column('message', sa.String(500), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['deleted_by_id'], ['users.id'], ondelete='SET NULL'),
    )

    op.create_index('ix_usage_alerts_tenant_id', 'usage_alerts', ['tenant_id'])
    op.create_index('ix_usage_alerts_tenant_created', 'usage_alerts', ['tenant_id', 'created_at'])


def downgrade() -> None:
    op.drop_table('usage_alerts')
    op.drop_table('usage_quotas')
    op.drop_table('usage_records')
