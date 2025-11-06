"""
Phase 6A Migration - Add Super Admin Support

Revision ID: phase_6a_super_admin_2
Revises: phase_6a_super_admin
Create Date: 2024-11-04

This migration:
1. No schema changes needed (role field already exists in users table)
2. Creates a super admin user for system management
3. Updates tenant table indexes for better performance
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from uuid import uuid4
from passlib.context import CryptContext

# revision identifiers, used by Alembic.
revision = 'phase_6a_super_admin_2'
down_revision = 'phase_6a_super_admin'  # Replace with your last migration ID
branch_labels = None
depends_on = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    """
    Upgrade to Phase 6A
    
    Changes:
    - Add indexes for better tenant query performance
    - Create super admin user (optional, can be done via seed script)
    """
    op.alter_column('users', 'tenant_id', nullable=True, existing_type=sa.UUID)
    
    # # Add composite indexes for common queries
    # op.create_index(
    #     'idx_tenants_tier_status',
    #     'tenants',
    #     ['tier', 'subscription_status'],
    #     unique=False
    # )
    
    # op.create_index(
    #     'idx_tenants_active_tier',
    #     'tenants',
    #     ['is_active', 'tier'],
    #     unique=False
    # )
    
    # op.create_index(
    #     'idx_users_tenant_role',
    #     'users',
    #     ['tenant_id', 'role'],
    #     unique=False
    # )
    
    # Note: Super admin user creation should be done via script
    # See: scripts/create_super_admin.py
    
    print("Phase 6A migration complete")
    print("Remember to run: python scripts/create_super_admin.py")


def downgrade() -> None:
    """
    Downgrade from Phase 6A
    """
    
    # Remove indexes
    op.drop_index('idx_users_tenant_role', table_name='users')
    op.drop_index('idx_tenants_active_tier', table_name='tenants')
    op.drop_index('idx_tenants_tier_status', table_name='tenants')
    
    print("Phase 6A migration rolled back")
