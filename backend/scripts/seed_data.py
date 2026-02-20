"""
Comprehensive Seed Data Script

Seeds all necessary data for development/testing:
1. Subscription tiers
2. Payment methods
3. System admin user
4. Demo tenant with owner, admin, and member users
5. Multiple branches

Usage:
    python scripts/seed_data.py [--skip-tiers] [--skip-payments]

Default credentials:
    System Admin: sysadmin@harmony.com / sysadmin123
    Tenant Owner: owner@demo.com / owner123
    Tenant Admin: admin@demo.com / admin123
    Tenant Member: member@demo.com / member123
"""
import sys
import os
import argparse
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models import Tenant, Branch, User
from app.models.user import TenantRole, SystemRole
from app.core.security import get_password_hash
from datetime import datetime, timedelta


def seed_tiers_and_payments(skip_tiers: bool = False, skip_payments: bool = False):
    """Seed subscription tiers and payment methods using existing script."""
    from scripts.seed_tiers import seed_tiers, seed_payment_methods

    if not skip_tiers:
        print("\n" + "=" * 60)
        print("SEEDING SUBSCRIPTION TIERS")
        print("=" * 60)
        seed_tiers(force=False)

    if not skip_payments:
        print("\n" + "=" * 60)
        print("SEEDING PAYMENT METHODS")
        print("=" * 60)
        seed_payment_methods()


def seed_system_admin(db):
    """Create system admin user."""
    print("\n" + "=" * 60)
    print("SEEDING SYSTEM ADMIN")
    print("=" * 60)

    # Check if system admin already exists
    existing = db.query(User).filter(
        User.email == "sysadmin@harmony.com"
    ).first()

    if existing:
        print("[!] System admin already exists, skipping")
        return existing

    sys_admin = User(
        tenant_id=None,
        default_branch_id=None,
        email="sysadmin@harmony.com",
        password_hash=get_password_hash("sysadmin123"),
        first_name="System",
        last_name="Admin",
        full_name="System Admin",
        system_role=SystemRole.ADMIN,
        is_verified=True,
        is_active=True,
    )
    db.add(sys_admin)
    db.flush()

    print(f"[+] Created: sysadmin@harmony.com (password: sysadmin123) [System Admin]")
    return sys_admin


def seed_demo_tenant(db):
    """Create demo tenant with branches and users."""
    print("\n" + "=" * 60)
    print("SEEDING DEMO TENANT")
    print("=" * 60)

    # Check if demo tenant already exists
    existing_tenant = db.query(Tenant).filter(
        Tenant.subdomain == "demo"
    ).first()

    if existing_tenant:
        print("[!] Demo tenant already exists, skipping")
        return existing_tenant

    # Create demo tenant with premium tier
    tenant = Tenant(
        name="Demo Company",
        subdomain="demo",
        tier="premium",
        subscription_status="active",
        max_users=100,
        max_branches=20,
        max_storage_gb=50,
        subscription_started_at=datetime.utcnow(),
        subscription_ends_at=datetime.utcnow() + timedelta(days=365),
    )
    db.add(tenant)
    db.flush()

    print(f"[+] Created tenant: {tenant.name} (subdomain: {tenant.subdomain}, tier: {tenant.tier})")

    # Create branches
    branches = [
        {
            "name": "Head Office",
            "code": "HQ",
            "is_hq": True,
            "city": "Jakarta",
            "province": "DKI Jakarta",
            "address": "Jl. Sudirman No. 1",
            "phone": "+62 21 1234567",
            "email": "hq@demo.com",
        },
        {
            "name": "Surabaya Branch",
            "code": "SBY",
            "is_hq": False,
            "city": "Surabaya",
            "province": "Jawa Timur",
            "address": "Jl. Pemuda No. 100",
            "phone": "+62 31 7654321",
            "email": "surabaya@demo.com",
        },
        {
            "name": "Bandung Branch",
            "code": "BDG",
            "is_hq": False,
            "city": "Bandung",
            "province": "Jawa Barat",
            "address": "Jl. Asia Afrika No. 50",
            "phone": "+62 22 4567890",
            "email": "bandung@demo.com",
        },
    ]

    branch_objects = []
    for branch_data in branches:
        branch = Branch(
            tenant_id=tenant.id,
            country="Indonesia",
            timezone="Asia/Jakarta",
            currency="IDR",
            **branch_data
        )
        db.add(branch)
        db.flush()
        branch_objects.append(branch)
        print(f"[+] Created branch: {branch.name} ({branch.code})")

    hq_branch = branch_objects[0]
    sby_branch = branch_objects[1]

    # Create users
    users = [
        {
            "email": "owner@demo.com",
            "password": "owner123",
            "first_name": "Owner",
            "last_name": "User",
            "tenant_role": TenantRole.OWNER,
            "branch": hq_branch,
            "phone": "+62 812 1111 1111",
        },
        {
            "email": "admin@demo.com",
            "password": "admin123",
            "first_name": "Admin",
            "last_name": "User",
            "tenant_role": TenantRole.ADMIN,
            "branch": hq_branch,
            "phone": "+62 812 2222 2222",
        },
        {
            "email": "member@demo.com",
            "password": "member123",
            "first_name": "Member",
            "last_name": "User",
            "tenant_role": TenantRole.MEMBER,
            "branch": sby_branch,
            "phone": "+62 812 3333 3333",
        },
        {
            "email": "staff1@demo.com",
            "password": "staff123",
            "first_name": "Staff",
            "last_name": "One",
            "tenant_role": TenantRole.MEMBER,
            "branch": hq_branch,
            "phone": "+62 812 4444 4444",
        },
        {
            "email": "staff2@demo.com",
            "password": "staff123",
            "first_name": "Staff",
            "last_name": "Two",
            "tenant_role": TenantRole.MEMBER,
            "branch": sby_branch,
            "phone": "+62 812 5555 5555",
        },
    ]

    for user_data in users:
        user = User(
            tenant_id=tenant.id,
            email=user_data["email"],
            password_hash=get_password_hash(user_data["password"]),
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            full_name=f"{user_data['first_name']} {user_data['last_name']}",
            tenant_role=user_data["tenant_role"],
            default_branch_id=user_data["branch"].id,
            phone=user_data.get("phone"),
            is_verified=True,
            is_active=True,
        )
        db.add(user)
        role_display = user_data["tenant_role"].value if user_data["tenant_role"] else "member"
        print(f"[+] Created user: {user_data['email']} (password: {user_data['password']}) [{role_display}]")

    return tenant


def seed_second_tenant(db):
    """Create a second tenant for multi-tenant testing."""
    print("\n" + "=" * 60)
    print("SEEDING SECOND TENANT (Acme Corp)")
    print("=" * 60)

    # Check if tenant already exists
    existing = db.query(Tenant).filter(
        Tenant.subdomain == "acme"
    ).first()

    if existing:
        print("[!] Acme tenant already exists, skipping")
        return existing

    # Create tenant with basic tier
    tenant = Tenant(
        name="Acme Corporation",
        subdomain="acme",
        tier="basic",
        subscription_status="active",
        max_users=20,
        max_branches=5,
        max_storage_gb=10,
        subscription_started_at=datetime.utcnow(),
        subscription_ends_at=datetime.utcnow() + timedelta(days=30),
    )
    db.add(tenant)
    db.flush()

    print(f"[+] Created tenant: {tenant.name} (subdomain: {tenant.subdomain}, tier: {tenant.tier})")

    # Create HQ branch
    branch = Branch(
        tenant_id=tenant.id,
        name="Acme HQ",
        code="ACME",
        is_hq=True,
        city="Yogyakarta",
        province="DI Yogyakarta",
        country="Indonesia",
        timezone="Asia/Jakarta",
        currency="IDR",
    )
    db.add(branch)
    db.flush()
    print(f"[+] Created branch: {branch.name} ({branch.code})")

    # Create owner
    owner = User(
        tenant_id=tenant.id,
        email="owner@acme.com",
        password_hash=get_password_hash("owner123"),
        first_name="Acme",
        last_name="Owner",
        full_name="Acme Owner",
        tenant_role=TenantRole.OWNER,
        default_branch_id=branch.id,
        is_verified=True,
        is_active=True,
    )
    db.add(owner)
    print(f"[+] Created user: owner@acme.com (password: owner123) [owner]")

    return tenant


def main():
    parser = argparse.ArgumentParser(description="Seed comprehensive demo data")
    parser.add_argument("--skip-tiers", action="store_true", help="Skip seeding subscription tiers")
    parser.add_argument("--skip-payments", action="store_true", help="Skip seeding payment methods")
    parser.add_argument("--skip-second-tenant", action="store_true", help="Skip creating second tenant")
    args = parser.parse_args()

    print("=" * 60)
    print("HARMONY SAAS - COMPREHENSIVE SEED DATA")
    print("=" * 60)

    # Seed tiers and payment methods first
    seed_tiers_and_payments(
        skip_tiers=args.skip_tiers,
        skip_payments=args.skip_payments
    )

    db = SessionLocal()

    try:
        # Seed system admin
        seed_system_admin(db)

        # Seed demo tenant
        seed_demo_tenant(db)

        # Seed second tenant for multi-tenant testing
        if not args.skip_second_tenant:
            seed_second_tenant(db)

        db.commit()

        print("\n" + "=" * 60)
        print("SEEDING COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("\nDefault Credentials:")
        print("-" * 60)
        print("SYSTEM ADMIN:")
        print("  Email: sysadmin@harmony.com")
        print("  Password: sysadmin123")
        print("\nDEMO COMPANY (demo):")
        print("  Owner:  owner@demo.com / owner123")
        print("  Admin:  admin@demo.com / admin123")
        print("  Member: member@demo.com / member123")
        print("\nACME CORPORATION (acme):")
        print("  Owner:  owner@acme.com / owner123")
        print("-" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Error seeding data: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
