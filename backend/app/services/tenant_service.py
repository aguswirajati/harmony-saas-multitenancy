"""
Tenant Service for Phase 6A - Tenant Management
Business logic for tenant operations, subscription management, and statistics
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from uuid import UUID
import logging
from fastapi import Request

from app.models.tenant import Tenant
from app.models.user import User
from app.models.branch import Branch
from app.schemas.tenant import (
    TenantCreate, TenantUpdate, TenantSubscriptionUpdate,
    TenantFeatureUpdate, TenantStatusUpdate, TenantResponse,
    TenantSummary, TenantStats, SystemStats, TenantUsageResponse,
    TenantSettingsUpdate, TierInfo, AvailableTiers
)
from app.core.security import get_password_hash
from app.core.exceptions import (
    TenantNotFoundException, TenantExistsException,
    SubdomainTakenException, LimitExceededException
)
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction, AuditStatus

logger = logging.getLogger(__name__)


class TenantService:
    """Service for tenant management operations"""
    
    # Tier configurations
    TIER_CONFIGS = {
        "free": {
            "display_name": "Free",
            "price_monthly": 0,
            "price_yearly": 0,
            "max_users": 5,
            "max_branches": 1,
            "max_storage_gb": 1,
            "features": ["Basic Dashboard", "User Management", "1 Branch"],
        },
        "basic": {
            "display_name": "Basic",
            "price_monthly": 29,
            "price_yearly": 290,
            "max_users": 20,
            "max_branches": 5,
            "max_storage_gb": 10,
            "features": ["All Free Features", "5 Branches", "10GB Storage", "Email Support"],
        },
        "premium": {
            "display_name": "Premium",
            "price_monthly": 99,
            "price_yearly": 990,
            "max_users": 100,
            "max_branches": 20,
            "max_storage_gb": 50,
            "features": ["All Basic Features", "20 Branches", "50GB Storage", "Priority Support", "API Access"],
        },
        "enterprise": {
            "display_name": "Enterprise",
            "price_monthly": 299,
            "price_yearly": 2990,
            "max_users": -1,  # Unlimited
            "max_branches": -1,  # Unlimited
            "max_storage_gb": 200,
            "features": ["All Premium Features", "Unlimited Users", "Unlimited Branches", "200GB Storage", "24/7 Support", "Custom Integration"],
        }
    }
    
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _get_storage_used_gb(tenant_id) -> float:
        """Calculate storage used by a tenant in GB.

        Returns 0.0 until file upload is implemented (Phase 2+).
        When file uploads are added, this should query the actual storage
        usage from the file/upload table or object storage provider.
        """
        return 0.0

    # ========================================================================
    # CRUD OPERATIONS
    # ========================================================================
    
    def create_tenant(self, tenant_data: TenantCreate, current_user: User = None, request: Request = None) -> Tenant:
        """
        Create new tenant with admin user and HQ branch (Super Admin only)
        """
        # Check subdomain uniqueness
        if self.db.query(Tenant).filter(Tenant.subdomain == tenant_data.subdomain).first():
            raise SubdomainTakenException(f"Subdomain '{tenant_data.subdomain}' already taken")

        # Check email uniqueness
        if self.db.query(User).filter(User.email == tenant_data.admin_email).first():
            raise TenantExistsException(f"Email '{tenant_data.admin_email}' already exists")

        try:
            # Create tenant
            tenant = Tenant(
                name=tenant_data.name,
                subdomain=tenant_data.subdomain,
                domain=tenant_data.domain or None,
                tier=tenant_data.tier,
                subscription_status="active",
                max_users=tenant_data.max_users,
                max_branches=tenant_data.max_branches,
                max_storage_gb=tenant_data.max_storage_gb,
                logo_url=tenant_data.logo_url or None,
                features={},
                settings={},
                meta_data={}
            )
            self.db.add(tenant)
            self.db.flush()  # Get tenant ID

            # Create HQ branch
            hq_branch = Branch(
                tenant_id=tenant.id,
                name="Head Office",
                code="HQ",
                is_hq=True,
                is_active=True
            )
            self.db.add(hq_branch)
            self.db.flush()  # Get branch ID

            # Create admin user
            admin_user = User(
                tenant_id=tenant.id,
                default_branch_id=hq_branch.id,
                email=tenant_data.admin_email,
                password_hash=get_password_hash(tenant_data.admin_password),
                first_name=tenant_data.admin_first_name,
                last_name=tenant_data.admin_last_name,
                full_name=f"{tenant_data.admin_first_name} {tenant_data.admin_last_name}",
                role="admin",
                is_verified=True,
                permissions=[]
            )
            self.db.add(admin_user)

            self.db.commit()
            self.db.refresh(tenant)

            # Log tenant creation
            if current_user and request:
                AuditService.log_action(
                    db=self.db,
                    user_id=current_user.id,
                    tenant_id=tenant.id,
                    action=AuditAction.TENANT_CREATED,
                    resource="tenant",
                    resource_id=tenant.id,
                    details={
                        "tenant_name": tenant.name,
                        "subdomain": tenant.subdomain,
                        "tier": tenant.tier,
                        "admin_email": admin_user.email,
                        "created_by": "super_admin"
                    },
                    status=AuditStatus.SUCCESS,
                    request=request
                )

            logger.info(f"Created tenant: {tenant.subdomain} with admin: {tenant_data.admin_email}")
            return tenant

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create tenant: {str(e)}")
            raise
    
    def get_tenant_by_id(self, tenant_id: UUID) -> Tenant:
        """Get tenant by ID"""
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise TenantNotFoundException(f"Tenant with ID {tenant_id} not found")
        return tenant
    
    def get_tenant_by_subdomain(self, subdomain: str) -> Optional[Tenant]:
        """Get tenant by subdomain"""
        return self.db.query(Tenant).filter(Tenant.subdomain == subdomain).first()
    
    def get_all_tenants(
        self, 
        skip: int = 0, 
        limit: int = 100,
        tier: Optional[str] = None,
        status: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None
    ) -> Tuple[List[Tenant], int]:
        """
        Get all tenants with filters and pagination
        Returns: (tenants, total_count)
        """
        query = self.db.query(Tenant)
        
        # Apply filters
        if tier:
            query = query.filter(Tenant.tier == tier)
        if status:
            query = query.filter(Tenant.subscription_status == status)
        if is_active is not None:
            query = query.filter(Tenant.is_active == is_active)
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Tenant.name.ilike(search_pattern),
                    Tenant.subdomain.ilike(search_pattern)
                )
            )
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        tenants = query.order_by(Tenant.created_at.desc()).offset(skip).limit(limit).all()
        
        return tenants, total
    
    def update_tenant(self, tenant_id: UUID, update_data: TenantUpdate, current_user: User = None, request: Request = None) -> Tenant:
        """Update tenant basic info"""
        tenant = self.get_tenant_by_id(tenant_id)

        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(tenant, key, value)

        self.db.commit()
        self.db.refresh(tenant)

        # Log tenant update
        if current_user and request:
            AuditService.log_action(
                db=self.db,
                user_id=current_user.id,
                tenant_id=tenant.id,
                action=AuditAction.TENANT_UPDATED,
                resource="tenant",
                resource_id=tenant.id,
                details={"updated_fields": list(update_dict.keys()), "subdomain": tenant.subdomain},
                status=AuditStatus.SUCCESS,
                request=request
            )

        logger.info(f"Updated tenant: {tenant.subdomain}")
        return tenant
    
    def update_subscription(
        self,
        tenant_id: UUID,
        subscription_data: TenantSubscriptionUpdate,
        current_user: User = None,
        request: Request = None
    ) -> Tenant:
        """Update tenant subscription (Super Admin only)"""
        tenant = self.get_tenant_by_id(tenant_id)

        # Update subscription fields
        tenant.tier = subscription_data.tier
        tenant.subscription_status = subscription_data.subscription_status
        tenant.max_users = subscription_data.max_users
        tenant.max_branches = subscription_data.max_branches
        tenant.max_storage_gb = subscription_data.max_storage_gb
        tenant.trial_ends_at = subscription_data.trial_ends_at
        tenant.subscription_ends_at = subscription_data.subscription_ends_at

        self.db.commit()
        self.db.refresh(tenant)

        # Log subscription update
        if current_user and request:
            AuditService.log_action(
                db=self.db,
                user_id=current_user.id,
                tenant_id=tenant.id,
                action=AuditAction.TENANT_SUBSCRIPTION_CHANGED,
                resource="tenant",
                resource_id=tenant.id,
                details={
                    "subdomain": tenant.subdomain,
                    "new_tier": subscription_data.tier,
                    "new_status": subscription_data.subscription_status,
                    "max_users": subscription_data.max_users
                },
                status=AuditStatus.SUCCESS,
                request=request
            )

        logger.info(f"Updated subscription for tenant: {tenant.subdomain} to tier: {subscription_data.tier}")
        return tenant
    
    def update_features(
        self,
        tenant_id: UUID,
        feature_data: TenantFeatureUpdate
    ) -> Tenant:
        """Update tenant feature flags (Super Admin only)"""
        tenant = self.get_tenant_by_id(tenant_id)
        
        tenant.features = feature_data.features
        
        self.db.commit()
        self.db.refresh(tenant)
        
        logger.info(f"Updated features for tenant: {tenant.subdomain}")
        return tenant
    
    def update_status(
        self,
        tenant_id: UUID,
        status_data: TenantStatusUpdate,
        current_user: User = None,
        request: Request = None
    ) -> Tenant:
        """Activate/deactivate tenant (Super Admin only)"""
        tenant = self.get_tenant_by_id(tenant_id)

        tenant.is_active = status_data.is_active

        # Log the reason in metadata
        if status_data.reason:
            if not tenant.meta_data:
                tenant.meta_data = {}
            tenant.meta_data['status_change_reason'] = status_data.reason
            tenant.meta_data['status_changed_at'] = datetime.utcnow().isoformat()

        self.db.commit()
        self.db.refresh(tenant)

        # Log tenant status change
        if current_user and request:
            action = AuditAction.TENANT_ACTIVATED if status_data.is_active else AuditAction.TENANT_DEACTIVATED
            AuditService.log_action(
                db=self.db,
                user_id=current_user.id,
                tenant_id=tenant.id,
                action=action,
                resource="tenant",
                resource_id=tenant.id,
                details={
                    "subdomain": tenant.subdomain,
                    "is_active": status_data.is_active,
                    "reason": status_data.reason
                },
                status=AuditStatus.SUCCESS,
                request=request
            )

        status_text = "activated" if status_data.is_active else "deactivated"
        logger.info(f"Tenant {tenant.subdomain} {status_text}")
        return tenant
    
    def delete_tenant(self, tenant_id: UUID, current_user: User = None, request: Request = None) -> bool:
        """
        Soft delete tenant (sets is_active=False)
        Hard delete would use: self.db.delete(tenant)
        """
        tenant = self.get_tenant_by_id(tenant_id)

        # Soft delete
        tenant.is_active = False
        tenant.deleted_at = datetime.utcnow()

        self.db.commit()

        # Log tenant deletion
        if current_user and request:
            AuditService.log_action(
                db=self.db,
                user_id=current_user.id,
                tenant_id=tenant.id,
                action=AuditAction.TENANT_DELETED,
                resource="tenant",
                resource_id=tenant.id,
                details={"subdomain": tenant.subdomain, "deletion_type": "soft_delete"},
                status=AuditStatus.SUCCESS,
                request=request
            )

        logger.info(f"Deleted tenant: {tenant.subdomain}")
        return True
    
    # ========================================================================
    # STATISTICS & ANALYTICS
    # ========================================================================
    
    def get_tenant_stats(self, tenant_id: UUID) -> TenantStats:
        """Get detailed statistics for a tenant"""
        tenant = self.get_tenant_by_id(tenant_id)
        
        # Count users and branches
        user_count = self.db.query(func.count(User.id)).filter(
            User.tenant_id == tenant_id,
            User.is_active == True
        ).scalar() or 0
        
        branch_count = self.db.query(func.count(Branch.id)).filter(
            Branch.tenant_id == tenant_id,
            Branch.is_active == True
        ).scalar() or 0
        
        # Calculate usage percentages
        users_percent = (user_count / tenant.max_users * 100) if tenant.max_users > 0 else 0
        branches_percent = (branch_count / tenant.max_branches * 100) if tenant.max_branches > 0 else 0
        storage_used = self._get_storage_used_gb(tenant_id)
        storage_percent = (storage_used / tenant.max_storage_gb * 100) if tenant.max_storage_gb > 0 else 0
        
        # Check trial/expiry status
        is_trial = tenant.subscription_status == 'trial'
        is_expired = False
        days_until_expiry = None
        
        if tenant.subscription_ends_at:
            days_until_expiry = (tenant.subscription_ends_at - datetime.utcnow()).days
            is_expired = days_until_expiry < 0
        
        # Get last activity (most recent user login)
        last_activity = self.db.query(func.max(User.last_login_at)).filter(
            User.tenant_id == tenant_id
        ).scalar()
        
        return TenantStats(
            id=tenant.id,
            name=tenant.name,
            subdomain=tenant.subdomain,
            tier=tenant.tier,
            subscription_status=tenant.subscription_status,
            max_users=tenant.max_users,
            max_branches=tenant.max_branches,
            max_storage_gb=tenant.max_storage_gb,
            user_count=user_count,
            branch_count=branch_count,
            storage_used_gb=round(storage_used, 2),
            users_usage_percent=round(users_percent, 2),
            branches_usage_percent=round(branches_percent, 2),
            storage_usage_percent=round(storage_percent, 2),
            is_active=tenant.is_active,
            is_trial=is_trial,
            is_expired=is_expired,
            days_until_expiry=days_until_expiry,
            created_at=tenant.created_at,
            last_activity_at=last_activity
        )
    
    def get_system_stats(self) -> SystemStats:
        """Get overall system statistics (Super Admin dashboard)"""
        # Total tenants by status
        total_tenants = self.db.query(func.count(Tenant.id)).scalar() or 0
        active_tenants = self.db.query(func.count(Tenant.id)).filter(
            Tenant.is_active == True
        ).scalar() or 0
        inactive_tenants = total_tenants - active_tenants
        trial_tenants = self.db.query(func.count(Tenant.id)).filter(
            Tenant.subscription_status == 'trial'
        ).scalar() or 0
        
        # By tier
        free_tier = self.db.query(func.count(Tenant.id)).filter(Tenant.tier == 'free').scalar() or 0
        basic_tier = self.db.query(func.count(Tenant.id)).filter(Tenant.tier == 'basic').scalar() or 0
        premium_tier = self.db.query(func.count(Tenant.id)).filter(Tenant.tier == 'premium').scalar() or 0
        enterprise_tier = self.db.query(func.count(Tenant.id)).filter(Tenant.tier == 'enterprise').scalar() or 0
        
        # Total users and branches
        total_users = self.db.query(func.count(User.id)).scalar() or 0
        total_branches = self.db.query(func.count(Branch.id)).scalar() or 0
        
        # Recent activity
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        created_today = self.db.query(func.count(Tenant.id)).filter(
            Tenant.created_at >= today_start
        ).scalar() or 0
        
        created_this_week = self.db.query(func.count(Tenant.id)).filter(
            Tenant.created_at >= week_start
        ).scalar() or 0
        
        created_this_month = self.db.query(func.count(Tenant.id)).filter(
            Tenant.created_at >= month_start
        ).scalar() or 0
        
        # Expiring soon (next 7 days)
        soon = now + timedelta(days=7)
        trials_expiring = self.db.query(func.count(Tenant.id)).filter(
            and_(
                Tenant.subscription_status == 'trial',
                Tenant.trial_ends_at.isnot(None),
                Tenant.trial_ends_at <= soon,
                Tenant.trial_ends_at > now
            )
        ).scalar() or 0
        
        subscriptions_expiring = self.db.query(func.count(Tenant.id)).filter(
            and_(
                Tenant.subscription_ends_at.isnot(None),
                Tenant.subscription_ends_at <= soon,
                Tenant.subscription_ends_at > now
            )
        ).scalar() or 0

        # Build dictionaries for frontend
        tenants_by_tier = {
            'free': free_tier,
            'basic': basic_tier,
            'premium': premium_tier,
            'enterprise': enterprise_tier
        }

        # Count by subscription status
        status_active = self.db.query(func.count(Tenant.id)).filter(
            Tenant.subscription_status == 'active'
        ).scalar() or 0
        status_trial = self.db.query(func.count(Tenant.id)).filter(
            Tenant.subscription_status == 'trial'
        ).scalar() or 0
        status_expired = self.db.query(func.count(Tenant.id)).filter(
            Tenant.subscription_status == 'expired'
        ).scalar() or 0
        status_cancelled = self.db.query(func.count(Tenant.id)).filter(
            Tenant.subscription_status == 'cancelled'
        ).scalar() or 0
        status_suspended = self.db.query(func.count(Tenant.id)).filter(
            Tenant.subscription_status == 'suspended'
        ).scalar() or 0

        tenants_by_status = {
            'active': status_active,
            'trial': status_trial,
            'expired': status_expired,
            'cancelled': status_cancelled,
            'suspended': status_suspended
        }

        return SystemStats(
            total_tenants=total_tenants,
            active_tenants=active_tenants,
            inactive_tenants=inactive_tenants,
            trial_tenants=trial_tenants,
            free_tier_count=free_tier,
            basic_tier_count=basic_tier,
            premium_tier_count=premium_tier,
            enterprise_tier_count=enterprise_tier,
            tenants_by_tier=tenants_by_tier,
            tenants_by_status=tenants_by_status,
            total_users=total_users,
            total_branches=total_branches,
            tenants_created_today=created_today,
            tenants_created_this_week=created_this_week,
            tenants_created_this_month=created_this_month,
            trials_expiring_soon=trials_expiring,
            subscriptions_expiring_soon=subscriptions_expiring
        )
    
    def get_tenant_usage(self, tenant_id: UUID) -> TenantUsageResponse:
        """Get current usage vs limits for tenant dashboard"""
        tenant = self.get_tenant_by_id(tenant_id)
        
        # Count current usage
        user_count = self.db.query(func.count(User.id)).filter(
            User.tenant_id == tenant_id,
            User.is_active == True
        ).scalar() or 0
        
        branch_count = self.db.query(func.count(Branch.id)).filter(
            Branch.tenant_id == tenant_id,
            Branch.is_active == True
        ).scalar() or 0
        
        storage_used = self._get_storage_used_gb(tenant_id)
        
        # Calculate available
        users_available = max(0, tenant.max_users - user_count)
        branches_available = max(0, tenant.max_branches - branch_count)
        storage_available = max(0, tenant.max_storage_gb - storage_used)
        
        # Calculate percentages
        users_percent = (user_count / tenant.max_users * 100) if tenant.max_users > 0 else 0
        branches_percent = (branch_count / tenant.max_branches * 100) if tenant.max_branches > 0 else 0
        storage_percent = (storage_used / tenant.max_storage_gb * 100) if tenant.max_storage_gb > 0 else 0
        
        # Check limits
        is_user_limit_reached = user_count >= tenant.max_users
        is_branch_limit_reached = branch_count >= tenant.max_branches
        is_storage_limit_reached = storage_used >= tenant.max_storage_gb
        
        # Next tier info
        tier_order = ['free', 'basic', 'premium', 'enterprise']
        current_index = tier_order.index(tenant.tier) if tenant.tier in tier_order else -1
        next_tier = tier_order[current_index + 1] if current_index < len(tier_order) - 1 else None
        can_upgrade = next_tier is not None
        
        return TenantUsageResponse(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            tier=tenant.tier,
            users_current=user_count,
            users_limit=tenant.max_users,
            users_available=users_available,
            users_percent=round(users_percent, 2),
            branches_current=branch_count,
            branches_limit=tenant.max_branches,
            branches_available=branches_available,
            branches_percent=round(branches_percent, 2),
            storage_used_gb=round(storage_used, 2),
            storage_limit_gb=tenant.max_storage_gb,
            storage_available_gb=round(storage_available, 2),
            storage_percent=round(storage_percent, 2),
            is_user_limit_reached=is_user_limit_reached,
            is_branch_limit_reached=is_branch_limit_reached,
            is_storage_limit_reached=is_storage_limit_reached,
            can_upgrade=can_upgrade,
            next_tier=next_tier
        )
    
    # ========================================================================
    # TENANT SELF-SERVICE
    # ========================================================================
    
    def update_tenant_settings(
        self,
        tenant_id: UUID,
        settings_data: TenantSettingsUpdate
    ) -> Tenant:
        """Allow tenant to update their own settings (non-subscription)"""
        tenant = self.get_tenant_by_id(tenant_id)
        
        if settings_data.name:
            tenant.name = settings_data.name
        if settings_data.logo_url:
            tenant.logo_url = settings_data.logo_url
        if settings_data.settings:
            tenant.settings = settings_data.settings
        
        self.db.commit()
        self.db.refresh(tenant)
        
        logger.info(f"Tenant {tenant.subdomain} updated their settings")
        return tenant
    
    def get_available_tiers(self, current_tier: str) -> AvailableTiers:
        """Get list of available subscription tiers with pricing"""
        tiers = []
        
        for tier_code, config in self.TIER_CONFIGS.items():
            tier_info = TierInfo(
                tier=tier_code,
                display_name=config['display_name'],
                price_monthly=config['price_monthly'],
                price_yearly=config['price_yearly'],
                max_users=config['max_users'],
                max_branches=config['max_branches'],
                max_storage_gb=config['max_storage_gb'],
                features=config['features'],
                is_recommended=(tier_code == 'premium')
            )
            tiers.append(tier_info)
        
        return AvailableTiers(
            tiers=tiers,
            current_tier=current_tier
        )
    
    # ========================================================================
    # VALIDATION & LIMITS
    # ========================================================================
    
    def check_user_limit(self, tenant_id: UUID) -> bool:
        """Check if tenant can add more users"""
        tenant = self.get_tenant_by_id(tenant_id)
        
        if tenant.max_users == -1:  # Unlimited
            return True
        
        user_count = self.db.query(func.count(User.id)).filter(
            User.tenant_id == tenant_id,
            User.is_active == True
        ).scalar() or 0
        
        return user_count < tenant.max_users
    
    def check_branch_limit(self, tenant_id: UUID) -> bool:
        """Check if tenant can add more branches"""
        tenant = self.get_tenant_by_id(tenant_id)
        
        if tenant.max_branches == -1:  # Unlimited
            return True
        
        branch_count = self.db.query(func.count(Branch.id)).filter(
            Branch.tenant_id == tenant_id,
            Branch.is_active == True
        ).scalar() or 0
        
        return branch_count < tenant.max_branches
    
    def validate_feature_access(self, tenant_id: UUID, feature: str) -> bool:
        """Check if tenant has access to a specific feature"""
        tenant = self.get_tenant_by_id(tenant_id)
        
        if not tenant.features:
            return False
        
        return tenant.features.get(feature, False)
