import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models import Tenant, Branch, User
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

        # Create admin user
        admin = User(
            tenant_id=tenant.id,
            email="admin@demo.com",
            password_hash=get_password_hash("admin123"),
            first_name="Admin",
            last_name="User",
            full_name="Admin User",
            role="admin",
            default_branch_id=hq_branch.id,
            is_verified=True
        )
        db.add(admin)

        print(f"✅ Created user: {admin.email} (password: admin123)")

        # Create staff user
        staff = User(
            tenant_id=tenant.id,
            email="staff@demo.com",
            password_hash=get_password_hash("staff123"),
            first_name="Staff",
            last_name="User",
            full_name="Staff User",
            role="staff",
            default_branch_id=branch2.id,
            is_verified=True
        )
        db.add(staff)

        print(f"✅ Created user: {staff.email} (password: staff123)")

        db.commit()
        print("\n🎉 Seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_initial_data()
