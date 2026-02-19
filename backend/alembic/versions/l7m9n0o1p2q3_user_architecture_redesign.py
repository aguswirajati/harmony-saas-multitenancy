"""User architecture redesign - System and Tenant scopes

Revision ID: l7m9n0o1p2q3
Revises: k6l8m9n0o1p2
Create Date: 2025-02-19

Changes:
- Add system_role enum (admin, operator) for system users
- Add tenant_role enum (owner, admin, member) for tenant users
- Add system_role, tenant_role, business_role columns to users table
- Migrate existing data (super_admin -> system admin, first admin per tenant -> owner)
- Add constraints (one owner per tenant, scope validation)
- Remove old role and is_super_admin columns
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'l7m9n0o1p2q3'
down_revision = 'k6l8m9n0o1p2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create enum types
    op.execute("CREATE TYPE system_role_enum AS ENUM ('admin', 'operator')")
    op.execute("CREATE TYPE tenant_role_enum AS ENUM ('owner', 'admin', 'member')")

    # 2. Add new columns (all nullable initially)
    op.add_column('users', sa.Column('system_role', sa.Enum('admin', 'operator', name='system_role_enum', create_type=False), nullable=True))
    op.add_column('users', sa.Column('tenant_role', sa.Enum('owner', 'admin', 'member', name='tenant_role_enum', create_type=False), nullable=True))
    op.add_column('users', sa.Column('business_role', sa.String(50), nullable=True))

    # 3. Migrate existing data - COMPREHENSIVE migration

    # 3a. System users: is_super_admin=True AND tenant_id IS NULL -> system_role='admin'
    op.execute("""
        UPDATE users
        SET system_role = 'admin'
        WHERE is_super_admin = TRUE AND tenant_id IS NULL
    """)

    # 3b. Handle any super_admin with tenant_id (shouldn't exist, but just in case)
    # These are tenant users who were incorrectly marked as super_admin
    op.execute("""
        UPDATE users
        SET tenant_role = 'admin'
        WHERE is_super_admin = TRUE AND tenant_id IS NOT NULL
    """)

    # 3c. Tenant owners: first admin per tenant -> tenant_role='owner'
    op.execute("""
        WITH first_admins AS (
            SELECT DISTINCT ON (tenant_id) id
            FROM users
            WHERE tenant_id IS NOT NULL
              AND role = 'admin'
              AND is_active = TRUE
              AND tenant_role IS NULL
            ORDER BY tenant_id, created_at ASC
        )
        UPDATE users
        SET tenant_role = 'owner'
        WHERE id IN (SELECT id FROM first_admins)
    """)

    # 3d. Remaining tenant admins -> tenant_role='admin'
    op.execute("""
        UPDATE users
        SET tenant_role = 'admin'
        WHERE tenant_id IS NOT NULL
          AND role = 'admin'
          AND tenant_role IS NULL
    """)

    # 3e. Staff -> tenant_role='member'
    op.execute("""
        UPDATE users
        SET tenant_role = 'member'
        WHERE tenant_id IS NOT NULL
          AND role = 'staff'
          AND tenant_role IS NULL
    """)

    # 3f. Any remaining tenant users without tenant_role -> default to member
    op.execute("""
        UPDATE users
        SET tenant_role = 'member'
        WHERE tenant_id IS NOT NULL
          AND tenant_role IS NULL
    """)

    # 3g. Any remaining system users without system_role -> default to admin
    # (This handles edge cases like system users that weren't properly marked)
    op.execute("""
        UPDATE users
        SET system_role = 'admin'
        WHERE tenant_id IS NULL
          AND system_role IS NULL
    """)

    # 3h. Ensure every tenant has an owner
    # If no owner exists for a tenant, promote the first active admin
    op.execute("""
        WITH tenants_without_owner AS (
            SELECT DISTINCT tenant_id
            FROM users
            WHERE tenant_id IS NOT NULL
              AND is_active = TRUE
            EXCEPT
            SELECT DISTINCT tenant_id
            FROM users
            WHERE tenant_id IS NOT NULL
              AND tenant_role = 'owner'
              AND is_active = TRUE
        ),
        first_admin_per_tenant AS (
            SELECT DISTINCT ON (u.tenant_id) u.id
            FROM users u
            INNER JOIN tenants_without_owner t ON u.tenant_id = t.tenant_id
            WHERE u.tenant_role = 'admin'
              AND u.is_active = TRUE
            ORDER BY u.tenant_id, u.created_at ASC
        )
        UPDATE users
        SET tenant_role = 'owner'
        WHERE id IN (SELECT id FROM first_admin_per_tenant)
    """)

    # 3i. If still no owner (only members), promote first active member
    op.execute("""
        WITH tenants_without_owner AS (
            SELECT DISTINCT tenant_id
            FROM users
            WHERE tenant_id IS NOT NULL
              AND is_active = TRUE
            EXCEPT
            SELECT DISTINCT tenant_id
            FROM users
            WHERE tenant_id IS NOT NULL
              AND tenant_role = 'owner'
              AND is_active = TRUE
        ),
        first_member_per_tenant AS (
            SELECT DISTINCT ON (u.tenant_id) u.id
            FROM users u
            INNER JOIN tenants_without_owner t ON u.tenant_id = t.tenant_id
            WHERE u.tenant_role = 'member'
              AND u.is_active = TRUE
            ORDER BY u.tenant_id, u.created_at ASC
        )
        UPDATE users
        SET tenant_role = 'owner'
        WHERE id IN (SELECT id FROM first_member_per_tenant)
    """)

    # 4. Add constraints

    # 4a. Ensure exactly one owner per tenant (among active users)
    op.execute("""
        CREATE UNIQUE INDEX unique_tenant_owner
        ON users (tenant_id)
        WHERE tenant_role = 'owner' AND is_active = TRUE AND tenant_id IS NOT NULL
    """)

    # 4b. Ensure scope consistency: system users have system_role, tenant users have tenant_role
    op.execute("""
        ALTER TABLE users ADD CONSTRAINT user_scope_check CHECK (
            (tenant_id IS NULL AND system_role IS NOT NULL AND tenant_role IS NULL) OR
            (tenant_id IS NOT NULL AND tenant_role IS NOT NULL AND system_role IS NULL)
        )
    """)

    # 5. Drop old columns (after verification that migration was successful)
    op.drop_column('users', 'role')
    op.drop_column('users', 'is_super_admin')


def downgrade() -> None:
    # 1. Re-add old columns
    op.add_column('users', sa.Column('role', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('is_super_admin', sa.Boolean(), nullable=True, server_default='false'))

    # 2. Migrate data back

    # System admins -> is_super_admin=True, role='admin'
    op.execute("""
        UPDATE users
        SET is_super_admin = TRUE, role = 'admin'
        WHERE system_role = 'admin'
    """)

    # System operators -> is_super_admin=TRUE, role='admin' (no direct equivalent)
    op.execute("""
        UPDATE users
        SET is_super_admin = TRUE, role = 'admin'
        WHERE system_role = 'operator'
    """)

    # Tenant owners/admins -> role='admin'
    op.execute("""
        UPDATE users
        SET role = 'admin', is_super_admin = FALSE
        WHERE tenant_role IN ('owner', 'admin')
    """)

    # Tenant members -> role='staff'
    op.execute("""
        UPDATE users
        SET role = 'staff', is_super_admin = FALSE
        WHERE tenant_role = 'member'
    """)

    # Set defaults for any remaining
    op.execute("""
        UPDATE users
        SET role = 'staff', is_super_admin = FALSE
        WHERE role IS NULL
    """)

    # 3. Drop constraints
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS user_scope_check")
    op.execute("DROP INDEX IF EXISTS unique_tenant_owner")

    # 4. Drop new columns
    op.drop_column('users', 'business_role')
    op.drop_column('users', 'tenant_role')
    op.drop_column('users', 'system_role')

    # 5. Drop enum types
    op.execute("DROP TYPE IF EXISTS tenant_role_enum")
    op.execute("DROP TYPE IF EXISTS system_role_enum")
