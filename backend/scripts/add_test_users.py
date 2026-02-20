"""Add test users with known passwords to existing tenants"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models import Tenant, Branch, User
from app.models.user import TenantRole, SystemRole
from app.core.security import get_password_hash

def add_test_users():
    db = SessionLocal()

    try:
        # 1. Create or update system admin
        existing_sysadmin = db.query(User).filter(
            User.email == "test.sysadmin@harmony.com"
        ).first()

        if not existing_sysadmin:
            sys_admin = User(
                tenant_id=None,
                email="test.sysadmin@harmony.com",
                password_hash=get_password_hash("Test1234"),
                first_name="Test",
                last_name="SysAdmin",
                full_name="Test SysAdmin",
                system_role=SystemRole.ADMIN,
                is_verified=True
            )
            db.add(sys_admin)
            db.flush()
            print(f"[+] Created: test.sysadmin@harmony.com / Test1234 [System Admin]")
        else:
            existing_sysadmin.password_hash = get_password_hash("Test1234")
            print(f"[*] Updated: test.sysadmin@harmony.com / Test1234 [System Admin]")

        # 2. Update existing tenant owner password
        demo_tenant = db.query(Tenant).filter(Tenant.subdomain == "demo").first()

        if demo_tenant:
            # Find the existing owner
            existing_owner = db.query(User).filter(
                User.tenant_id == demo_tenant.id,
                User.tenant_role == TenantRole.OWNER
            ).first()

            if existing_owner:
                existing_owner.password_hash = get_password_hash("Test1234")
                print(f"[*] Updated: {existing_owner.email} / Test1234 [Tenant Owner]")
            else:
                print(f"[!] No owner found for demo tenant")

        db.commit()
        print("\n[OK] Done!")
        print("\n" + "=" * 50)
        print("LOGIN CREDENTIALS")
        print("=" * 50)
        print("System Admin: test.sysadmin@harmony.com / Test1234")
        print("              Route: /admin")
        print("")
        if demo_tenant and existing_owner:
            print(f"Tenant Owner: {existing_owner.email} / Test1234")
            print("              Route: /dashboard")
        print("=" * 50)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    add_test_users()
