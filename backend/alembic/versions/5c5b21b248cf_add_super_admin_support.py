"""Add super admin support

Revision ID: 5c5b21b248cf
Revises: phase_6a_super_admin_2
Create Date: 2025-11-05 14:39:30.261736

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from uuid import uuid4
from uuid import UUID
from passlib.context import CryptContext


# revision identifiers, used by Alembic.
revision: str = '5c5b21b248cf'
down_revision: Union[str, Sequence[str], None] = 'phase_6a_super_admin_2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    """
    Apply changes to support super admin users
    """
    
    # 1. Make tenant_id nullable (allow NULL for super admin)
    op.alter_column('users', 'tenant_id',
                    existing_type=sa.UUID(),
                    nullable=True)  # Changed from False to True
    
    # 2. Add is_super_admin column
    op.add_column('users', 
                  sa.Column('is_super_admin', 
                           sa.Boolean(), 
                           nullable=False, 
                           server_default='false'))
    
    # 3. Update existing super admin users (if any)
    # Set is_super_admin=true for users with role='super_admin' or tenant_id IS NULL
    op.execute("""
        UPDATE users 
        SET is_super_admin = true 
        WHERE role = 'super_admin' OR tenant_id IS NULL
    """)
    
    # 4. Create index for is_super_admin (optional, for performance)
    op.create_index('idx_users_is_super_admin', 'users', ['is_super_admin'])


def downgrade():
    """
    Revert changes (optional, but good practice)
    """
    
    # Remove index
    op.drop_index('idx_users_is_super_admin', table_name='users')
    
    # Remove is_super_admin column
    op.drop_column('users', 'is_super_admin')
    
    # Make tenant_id NOT NULL again (WARNING: This will fail if super admin exists)
    # You may need to delete super admin users before downgrading
    op.alter_column('users', 'tenant_id',
                    existing_type=sa.UUID(),
                    nullable=False)


