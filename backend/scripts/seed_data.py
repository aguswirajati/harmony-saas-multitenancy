import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models import Tenant, Branch, User
from app.models.user import TenantRole, SystemRole
from app.core.security import get_password_hash

def seed_initial_data():
    db = SessionLocal()

    try:
        print("🌱 Seeding initial data...")

        # Create demo tenant
        tenant = Tenant(
            name="Demo Company",
            subdomain="demo",
            tier="premium",
            max_users=50,
            max_branches=10
        )
        db.add(tenant)
        db.flush()  # Get tenant.id

        print(f"✅ Created tenant: {tenant.name}")

        # Create HQ branch
        hq_branch = Branch(
            tenant_id=tenant.id,
            name="Head Office",
            code="HQ",
            is_hq=True,
            city="Jakarta",
            country="Indonesia"
        )
        db.add(hq_branch)
        db.flush()

        print(f"✅ Created branch: {hq_branch.name}")

        # Create branch 2
        branch2 = Branch(
            tenant_id=tenant.id,
            name="Surabaya Branch",
            code="SBY",
            is_hq=False,
            city="Surabaya",
            country="Indonesia"
        )
        db.add(branch2)
        db.flush()

        print(f"✅ Created branch: {branch2.name}")

        # Create tenant owner
        owner = User(
            tenant_id=tenant.id,
            email="owner@demo.com",
            password_hash=get_password_hash("owner123"),
            first_name="Owner",
            last_name="User",
            full_name="Owner User",
            tenant_role=TenantRole.OWNER,
            default_branch_id=hq_branch.id,
            is_verified=True
        )
        db.add(owner)

        print(f"✅ Created user: {owner.email} (password: owner123) [Tenant Owner]")

        # Create tenant admin
        admin = User(
            tenant_id=tenant.id,
            email="admin@demo.com",
            password_hash=get_password_hash("admin123"),
            first_name="Admin",
            last_name="User",
            full_name="Admin User",
            tenant_role=TenantRole.ADMIN,
            default_branch_id=hq_branch.id,
            is_verified=True
        )
        db.add(admin)

        print(f"✅ Created user: {admin.email} (password: admin123) [Tenant Admin]")

        # Create tenant member
        member = User(
            tenant_id=tenant.id,
            email="member@demo.com",
            password_hash=get_password_hash("member123"),
            first_name="Member",
            last_name="User",
            full_name="Member User",
            tenant_role=TenantRole.MEMBER,
            default_branch_id=branch2.id,
            is_verified=True
        )
        db.add(member)

        print(f"✅ Created user: {member.email} (password: member123) [Tenant Member]")

        # Create system admin (no tenant)
        sys_admin = User(
            tenant_id=None,
            email="sysadmin@harmony.com",
            password_hash=get_password_hash("sysadmin123"),
            first_name="System",
            last_name="Admin",
            full_name="System Admin",
            system_role=SystemRole.ADMIN,
            is_verified=True
        )
        db.add(sys_admin)

        print(f"✅ Created user: {sys_admin.email} (password: sysadmin123) [System Admin]")

        db.commit()
        print("\n🎉 Seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_initial_data()
