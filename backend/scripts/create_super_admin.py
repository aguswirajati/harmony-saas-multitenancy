"""
Create Super Admin User Script

Usage:
    python scripts/create_super_admin.py

This script creates a super admin user that can manage all tenants.
Super admin users are not associated with any specific tenant.
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.user import User
from app.core.security import get_password_hash
from uuid import uuid4
from datetime import datetime
import getpass


def create_super_admin(
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    db: Session
):
    """Create a super admin user"""
    
    # Check if super admin already exists
    existing = db.query(User).filter(
        User.email == email
    ).first()
    
    if existing:
        print(f"❌ User with email '{email}' already exists")
        return False
    
    # Import SystemRole for new architecture
    from app.models.user import SystemRole

    # Create system admin user (no tenant_id required)
    super_admin = User(
        id=uuid4(),
        tenant_id=None,  # System user has no tenant
        default_branch_id=None,
        email=email,
        password_hash=get_password_hash(password),
        first_name=first_name,
        last_name=last_name,
        full_name=f"{first_name} {last_name}",
        system_role=SystemRole.ADMIN,  # System admin role
        is_verified=True,
        is_active=True,
        permissions=[],
        created_at=datetime.utcnow()
    )
    
    db.add(super_admin)
    db.commit()
    db.refresh(super_admin)
    
    print(f"✅ Super Admin created successfully!")
    print(f"   Email: {email}")
    print(f"   Name: {first_name} {last_name}")
    print(f"   ID: {super_admin.id}")
    
    return True


def main():
    """Main function"""
    print("=" * 60)
    print("CREATE SUPER ADMIN USER")
    print("=" * 60)
    print()
    
    # Get input
    print("Enter Super Admin details:")
    print()
    
    email = input("Email: ").strip()
    if not email:
        print("❌ Email is required")
        return
    
    first_name = input("First Name: ").strip()
    if not first_name:
        print("❌ First name is required")
        return
    
    last_name = input("Last Name: ").strip()
    if not last_name:
        print("❌ Last name is required")
        return
    
    password = getpass.getpass("Password (min 8 chars): ")
    if len(password) < 8:
        print("❌ Password must be at least 8 characters")
        return
    
    password_confirm = getpass.getpass("Confirm Password: ")
    if password != password_confirm:
        print("❌ Passwords do not match")
        return
    
    print()
    print("Creating super admin user...")
    
    # Create database session
    db = SessionLocal()
    
    try:
        success = create_super_admin(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            db=db
        )
        
        if success:
            print()
            print("=" * 60)
            print("SUPER ADMIN LOGIN CREDENTIALS")
            print("=" * 60)
            print(f"Email: {email}")
            print(f"Password: (the one you entered)")
            print()
            print("You can now login with these credentials and access:")
            print("- Super Admin Dashboard (/admin)")
            print("- Tenant Management")
            print("- System Statistics")
            print("=" * 60)
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        db.rollback()
    
    finally:
        db.close()


if __name__ == "__main__":
    main()
