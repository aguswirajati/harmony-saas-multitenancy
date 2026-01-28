from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_super_admin_user
from app.models.user import User
from app.models.tenant import Tenant
from app.models.branch import Branch
from app.core.security import get_password_hash
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction, AuditStatus
from datetime import datetime
import uuid

router = APIRouter(prefix="/admin/tools", tags=["Admin - Tools"])


@router.post("/seed-data")
async def seed_dummy_data(
    request: Request,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """
    Seed database with dummy tenants, branches, and users (Super Admin only)

    Creates:
    - 3 demo tenants (free, basic, premium tiers)
    - Multiple branches for each tenant
    - Multiple users with different roles for each tenant
    """

    try:
        # Dummy data configuration
        tenants_data = [
            {
                "name": "Acme Corporation",
                "subdomain": "acme",
                "tier": "premium",
                "max_users": 100,
                "max_branches": 20,
                "max_storage_gb": 50
            },
            {
                "name": "TechStart Inc",
                "subdomain": "techstart",
                "tier": "basic",
                "max_users": 20,
                "max_branches": 5,
                "max_storage_gb": 10
            },
            {
                "name": "Demo Company",
                "subdomain": "demo",
                "tier": "free",
                "max_users": 5,
                "max_branches": 1,
                "max_storage_gb": 1
            }
        ]

        created_tenants = []
        created_users = []
        created_branches = []

        for tenant_data in tenants_data:
            # Check if tenant already exists
            existing_tenant = db.query(Tenant).filter(
                Tenant.subdomain == tenant_data["subdomain"]
            ).first()

            if existing_tenant:
                continue  # Skip if already exists

            # Create tenant
            tenant = Tenant(**tenant_data)
            db.add(tenant)
            db.flush()  # Get tenant ID
            created_tenants.append(tenant)

            # Create HQ branch
            hq_branch = Branch(
                tenant_id=tenant.id,
                name="Head Office",
                code="HQ",
                is_hq=True
            )
            db.add(hq_branch)
            db.flush()
            created_branches.append(hq_branch)

            # Create additional branches (except for free tier)
            if tenant.tier != "free":
                additional_branches = [
                    {"name": "New York Office", "code": "NY"},
                    {"name": "London Office", "code": "LON"},
                ]

                if tenant.tier == "premium":
                    additional_branches.extend([
                        {"name": "Tokyo Office", "code": "TKY"},
                        {"name": "Singapore Office", "code": "SG"},
                    ])

                for branch_data in additional_branches:
                    branch = Branch(
                        tenant_id=tenant.id,
                        **branch_data
                    )
                    db.add(branch)
                    db.flush()
                    created_branches.append(branch)

            # Create users with different roles
            users_to_create = [
                {
                    "email": f"admin@{tenant.subdomain}.com",
                    "password": "admin123",
                    "full_name": f"{tenant.name} Admin",
                    "role": "admin",
                    "branch": hq_branch
                },
                {
                    "email": f"manager@{tenant.subdomain}.com",
                    "password": "manager123",
                    "full_name": f"{tenant.name} Manager",
                    "role": "staff",
                    "branch": hq_branch
                },
                {
                    "email": f"staff@{tenant.subdomain}.com",
                    "password": "staff123",
                    "full_name": f"{tenant.name} Staff",
                    "role": "staff",
                    "branch": hq_branch
                },
            ]

            for user_data in users_to_create:
                branch = user_data.pop("branch")
                password = user_data.pop("password")

                user = User(
                    tenant_id=tenant.id,
                    default_branch_id=branch.id,
                    password_hash=get_password_hash(password),
                    is_verified=True,
                    email_verified_at=datetime.utcnow(),
                    **user_data
                )
                db.add(user)
                created_users.append(user)

        db.commit()

        # Log audit event for seeding data
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=None,
            action="system.seed_data",
            resource="system",
            details={
                "tenants_created": len(created_tenants),
                "branches_created": len(created_branches),
                "users_created": len(created_users),
                "tenant_names": [t.name for t in created_tenants]
            },
            status=AuditStatus.SUCCESS,
            request=request
        )

        return {
            "message": "Dummy data seeded successfully",
            "created": {
                "tenants": len(created_tenants),
                "branches": len(created_branches),
                "users": len(created_users)
            },
            "details": {
                "tenants": [{"name": t.name, "subdomain": t.subdomain, "tier": t.tier} for t in created_tenants],
                "sample_credentials": [
                    {"tenant": "acme", "email": "admin@acme.com", "password": "admin123"},
                    {"tenant": "techstart", "email": "admin@techstart.com", "password": "admin123"},
                    {"tenant": "demo", "email": "admin@demo.com", "password": "admin123"}
                ]
            }
        }

    except Exception as e:
        db.rollback()
        # Log failed seed attempt
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=None,
            action="system.seed_data",
            resource="system",
            details={"error": str(e)},
            status=AuditStatus.ERROR,
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed data: {str(e)}"
        )


@router.post("/reset-database")
async def reset_database(
    request: Request,
    current_user: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db)
):
    """
    Reset database to clean state (Super Admin only)

    WARNING: This will delete ALL data except super admin users!
    - Deletes all tenants (cascade deletes branches, users)
    - Preserves super admin users

    Use this for testing or fresh installation.
    """

    try:
        # Order matters due to foreign key constraints!
        # 1. First delete tenant users (non-super-admin)
        deleted_users = db.query(User).filter(
            User.tenant_id.isnot(None)  # Only delete users with tenant_id
        ).delete(synchronize_session='fetch')

        # 2. Delete branches
        deleted_branches = db.query(Branch).delete(synchronize_session='fetch')

        # 3. Finally delete tenants
        deleted_tenants = db.query(Tenant).delete(synchronize_session='fetch')

        db.commit()

        # Count remaining super admins
        remaining_super_admins = db.query(User).filter(
            User.is_super_admin == True
        ).count()

        # Log audit event for database reset
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=None,
            action="system.reset_database",
            resource="system",
            details={
                "tenants_deleted": deleted_tenants,
                "branches_deleted": deleted_branches,
                "users_deleted": deleted_users,
                "super_admins_preserved": remaining_super_admins
            },
            status=AuditStatus.SUCCESS,
            request=request
        )

        return {
            "message": "Database reset successfully",
            "deleted": {
                "tenants": deleted_tenants,
                "branches": deleted_branches,
                "users": deleted_users
            },
            "preserved": {
                "super_admins": remaining_super_admins
            },
            "warning": "All tenant data has been permanently deleted"
        }

    except Exception as e:
        db.rollback()
        # Log failed reset attempt
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=None,
            action="system.reset_database",
            resource="system",
            details={"error": str(e)},
            status=AuditStatus.ERROR,
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset database: {str(e)}"
        )
