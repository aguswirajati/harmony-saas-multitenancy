from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from uuid import UUID
from fastapi import Request

from app.models.audit_log import AuditLog, AuditAction, AuditStatus
from app.models.user import User


class AuditService:
    """
    Service for managing audit logs.

    This service provides methods to:
    - Log user actions throughout the system
    - Retrieve audit logs for compliance and investigation
    - Track security events
    - Monitor user activity

    Usage:
        # Log a user action
        AuditService.log_action(
            db=db,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            action=AuditAction.USER_CREATED,
            resource="user",
            resource_id=new_user.id,
            details={"email": new_user.email, "role": new_user.role},
            request=request
        )
    """

    @staticmethod
    def log_action(
        db: Session,
        action: str,
        resource: str,
        user_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        resource_id: Optional[UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        status: str = AuditStatus.SUCCESS,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        request: Optional[Request] = None,
    ) -> AuditLog:
        """
        Log an audit event.

        Args:
            db: Database session
            action: Action performed (use AuditAction constants)
            resource: Resource type affected (e.g., "user", "tenant", "branch")
            user_id: ID of user performing the action (optional for system actions)
            tenant_id: ID of tenant context (optional for super admin or system actions)
            resource_id: ID of specific resource affected (optional)
            details: Additional context (before/after values, error info, etc.)
            status: Action outcome (success/failure/error)
            ip_address: Client IP address (will extract from request if not provided)
            user_agent: Client user agent (will extract from request if not provided)
            request_id: Request ID for correlation (will extract from request if not provided)
            request: FastAPI request object (used to extract metadata if not provided)

        Returns:
            AuditLog: The created audit log entry
        """
        # Extract metadata from request if available
        if request:
            if not ip_address:
                ip_address = AuditService._get_client_ip(request)
            if not user_agent:
                user_agent = request.headers.get("user-agent")
            if not request_id and hasattr(request.state, "request_id"):
                request_id = request.state.request_id

        # Create audit log entry
        audit_log = AuditLog(
            user_id=user_id,
            tenant_id=tenant_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details,
            status=status,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )

        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)

        return audit_log

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        """
        Extract client IP address from request.

        Checks headers in order of preference:
        1. X-Forwarded-For (first IP in list)
        2. X-Real-IP
        3. request.client.host (direct connection)

        Args:
            request: FastAPI request object

        Returns:
            str: Client IP address
        """
        # Check X-Forwarded-For (proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take the first (original client)
            return forwarded_for.split(",")[0].strip()

        # Check X-Real-IP (nginx proxy)
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fallback to direct client IP
        if request.client:
            return request.client.host

        return "unknown"

    @staticmethod
    def get_audit_logs(
        db: Session,
        tenant_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        action: Optional[str] = None,
        resource: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[List[AuditLog], int]:
        """
        Retrieve audit logs with filtering.

        Args:
            db: Database session
            tenant_id: Filter by tenant
            user_id: Filter by user
            action: Filter by action type
            resource: Filter by resource type
            resource_id: Filter by specific resource
            status: Filter by status (success/failure/error)
            start_date: Filter logs after this date
            end_date: Filter logs before this date
            limit: Maximum number of results
            offset: Pagination offset

        Returns:
            tuple: (list of AuditLog, total count)
        """
        query = db.query(AuditLog).filter(AuditLog.is_active == True)

        # Apply filters
        if tenant_id:
            query = query.filter(AuditLog.tenant_id == tenant_id)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if action:
            query = query.filter(AuditLog.action == action)
        if resource:
            query = query.filter(AuditLog.resource == resource)
        if resource_id:
            query = query.filter(AuditLog.resource_id == resource_id)
        if status:
            query = query.filter(AuditLog.status == status)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)

        # Get total count
        total = query.count()

        # Get paginated results (ordered by most recent first)
        logs = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset).all()

        return logs, total

    @staticmethod
    def get_user_activity(
        db: Session,
        user_id: UUID,
        days: int = 30,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Get recent activity for a specific user.

        Args:
            db: Database session
            user_id: User ID
            days: Number of days to look back (default: 30)
            limit: Maximum number of results

        Returns:
            List[AuditLog]: Recent user activity
        """
        start_date = datetime.utcnow() - timedelta(days=days)
        logs, _ = AuditService.get_audit_logs(
            db=db,
            user_id=user_id,
            start_date=start_date,
            limit=limit
        )
        return logs

    @staticmethod
    def get_tenant_activity(
        db: Session,
        tenant_id: UUID,
        days: int = 30,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Get recent activity for a specific tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            days: Number of days to look back (default: 30)
            limit: Maximum number of results

        Returns:
            List[AuditLog]: Recent tenant activity
        """
        start_date = datetime.utcnow() - timedelta(days=days)
        logs, _ = AuditService.get_audit_logs(
            db=db,
            tenant_id=tenant_id,
            start_date=start_date,
            limit=limit
        )
        return logs

    @staticmethod
    def get_failed_login_attempts(
        db: Session,
        ip_address: Optional[str] = None,
        user_id: Optional[UUID] = None,
        hours: int = 24,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Get failed login attempts for security monitoring.

        Args:
            db: Database session
            ip_address: Filter by IP address
            user_id: Filter by user ID
            hours: Number of hours to look back (default: 24)
            limit: Maximum number of results

        Returns:
            List[AuditLog]: Failed login attempts
        """
        start_date = datetime.utcnow() - timedelta(hours=hours)

        query = db.query(AuditLog).filter(
            AuditLog.action == AuditAction.LOGIN_FAILED,
            AuditLog.created_at >= start_date,
            AuditLog.is_active == True
        )

        if ip_address:
            query = query.filter(AuditLog.ip_address == ip_address)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)

        return query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    @staticmethod
    def get_security_events(
        db: Session,
        tenant_id: Optional[UUID] = None,
        days: int = 7,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Get security-related events (login failures, password changes, etc.).

        Args:
            db: Database session
            tenant_id: Filter by tenant (optional)
            days: Number of days to look back (default: 7)
            limit: Maximum number of results

        Returns:
            List[AuditLog]: Security events
        """
        start_date = datetime.utcnow() - timedelta(days=days)

        security_actions = [
            AuditAction.LOGIN_FAILED,
            AuditAction.PASSWORD_RESET_REQUEST,
            AuditAction.PASSWORD_RESET,
            AuditAction.PASSWORD_CHANGED,
            AuditAction.USER_ROLE_CHANGED,
            AuditAction.USER_ACTIVATED,
            AuditAction.USER_DEACTIVATED,
        ]

        query = db.query(AuditLog).filter(
            AuditLog.action.in_(security_actions),
            AuditLog.created_at >= start_date,
            AuditLog.is_active == True
        )

        if tenant_id:
            query = query.filter(AuditLog.tenant_id == tenant_id)

        return query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    @staticmethod
    def log_login(
        db: Session,
        user: User,
        request: Request,
        success: bool = True
    ) -> AuditLog:
        """
        Convenience method to log login events.

        Args:
            db: Database session
            user: User who is logging in (or attempting to)
            request: FastAPI request object
            success: Whether login was successful

        Returns:
            AuditLog: The created audit log entry
        """
        return AuditService.log_action(
            db=db,
            user_id=user.id if success else None,
            tenant_id=user.tenant_id,
            action=AuditAction.LOGIN if success else AuditAction.LOGIN_FAILED,
            resource="user",
            resource_id=user.id,
            details={
                "email": user.email,
                "role": user.role,
                "is_super_admin": user.is_super_admin,
            },
            status=AuditStatus.SUCCESS if success else AuditStatus.FAILURE,
            request=request
        )

    @staticmethod
    def log_logout(
        db: Session,
        user: User,
        request: Request
    ) -> AuditLog:
        """
        Convenience method to log logout events.

        Args:
            db: Database session
            user: User who is logging out
            request: FastAPI request object

        Returns:
            AuditLog: The created audit log entry
        """
        return AuditService.log_action(
            db=db,
            user_id=user.id,
            tenant_id=user.tenant_id,
            action=AuditAction.LOGOUT,
            resource="user",
            resource_id=user.id,
            details={"email": user.email},
            request=request
        )
