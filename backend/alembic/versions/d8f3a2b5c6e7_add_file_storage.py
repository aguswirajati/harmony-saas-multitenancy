"""Add file storage model and tenant storage tracking

Revision ID: d8f3a2b5c6e7
Revises: 73458efe5641
Create Date: 2026-02-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd8f3a2b5c6e7'
down_revision: Union[str, Sequence[str], None] = '73458efe5641'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create files table and add storage tracking to tenants."""
    # Create files table
    op.create_table(
        'files',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('updated_by_id', sa.UUID(), nullable=True),
        sa.Column('deleted_by_id', sa.UUID(), nullable=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=True),
        sa.Column('filename', sa.String(255), nullable=False, comment='Original filename'),
        sa.Column('storage_key', sa.String(512), nullable=False, comment='S3 object key/path'),
        sa.Column('content_type', sa.String(100), nullable=False, comment='MIME type'),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False, comment='File size in bytes'),
        sa.Column('category', sa.String(50), nullable=False, comment='File category: tenant_logo, user_avatar, document, attachment'),
        sa.Column('resource_type', sa.String(50), nullable=True, comment='Linked resource type: tenant, user, branch, etc.'),
        sa.Column('resource_id', sa.UUID(), nullable=True, comment='Linked resource ID'),
        sa.Column('checksum', sa.String(64), nullable=True, comment='SHA-256 checksum'),
        sa.Column('file_metadata', postgresql.JSON(astext_type=sa.Text()), default={}, comment='Additional file metadata'),
        sa.Column('is_public', sa.Boolean(), nullable=False, default=False, comment='If true, file can be accessed without auth'),
        sa.Column('uploaded_by_id', sa.UUID(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], ondelete='SET NULL'),
    )

    # Create indexes
    op.create_index('ix_files_storage_key', 'files', ['storage_key'], unique=True)
    op.create_index('ix_files_tenant_id', 'files', ['tenant_id'])
    op.create_index('ix_files_category', 'files', ['category'])
    op.create_index('ix_files_resource_type', 'files', ['resource_type'])
    op.create_index('ix_files_resource_id', 'files', ['resource_id'])
    op.create_index('ix_files_uploaded_by_id', 'files', ['uploaded_by_id'])
    op.create_index('ix_files_tenant_category', 'files', ['tenant_id', 'category'])
    op.create_index('ix_files_resource', 'files', ['resource_type', 'resource_id'])
    op.create_index('ix_files_tenant_created', 'files', ['tenant_id', 'created_at'])

    # Add storage tracking to tenants
    op.add_column('tenants', sa.Column(
        'storage_used_bytes',
        sa.BigInteger(),
        nullable=False,
        server_default='0',
        comment='Current storage usage in bytes'
    ))


def downgrade() -> None:
    """Drop files table and remove storage tracking from tenants."""
    # Drop indexes
    op.drop_index('ix_files_tenant_created', table_name='files')
    op.drop_index('ix_files_resource', table_name='files')
    op.drop_index('ix_files_tenant_category', table_name='files')
    op.drop_index('ix_files_uploaded_by_id', table_name='files')
    op.drop_index('ix_files_resource_id', table_name='files')
    op.drop_index('ix_files_resource_type', table_name='files')
    op.drop_index('ix_files_category', table_name='files')
    op.drop_index('ix_files_tenant_id', table_name='files')
    op.drop_index('ix_files_storage_key', table_name='files')

    # Drop files table
    op.drop_table('files')

    # Remove storage tracking from tenants
    op.drop_column('tenants', 'storage_used_bytes')
