from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


class AuditLogBase(BaseModel):
    """Base audit log schema"""
    action: str = Field(..., description="Action performed")
    resource: str = Field(..., description="Resource type affected")
    resource_id: Optional[UUID] = Field(None, description="ID of specific resource affected")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional action details")
    status: str = Field(default="success", description="Action outcome")


class AuditLogResponse(AuditLogBase):
    """Audit log response schema"""
    id: UUID
    user_id: Optional[UUID] = None
    tenant_id: Optional[UUID] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_id: Optional[str] = None
    timestamp: datetime = Field(..., description="When the action occurred")

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_audit_log(cls, audit_log):
        """Create response from AuditLog model"""
        return cls(
            id=audit_log.id,
            user_id=audit_log.user_id,
            tenant_id=audit_log.tenant_id,
            action=audit_log.action,
            resource=audit_log.resource,
            resource_id=audit_log.resource_id,
            details=audit_log.details,
            status=audit_log.status,
            ip_address=audit_log.ip_address,
            user_agent=audit_log.user_agent,
            request_id=audit_log.request_id,
            timestamp=audit_log.created_at,
        )


class AuditLogListResponse(BaseModel):
    """Paginated audit log list response"""
    logs: List[AuditLogResponse]
    total: int = Field(..., description="Total number of logs matching filters")
    limit: int = Field(..., description="Number of logs per page")
    offset: int = Field(..., description="Current page offset")

    model_config = ConfigDict(from_attributes=True)


class AuditLogFilter(BaseModel):
    """Audit log filter parameters"""
    user_id: Optional[UUID] = Field(None, description="Filter by user ID")
    action: Optional[str] = Field(None, description="Filter by action type")
    resource: Optional[str] = Field(None, description="Filter by resource type")
    resource_id: Optional[UUID] = Field(None, description="Filter by specific resource")
    status: Optional[str] = Field(None, description="Filter by status (success/failure/error)")
    start_date: Optional[datetime] = Field(None, description="Filter logs after this date")
    end_date: Optional[datetime] = Field(None, description="Filter logs before this date")
    limit: int = Field(default=100, ge=1, le=1000, description="Number of results per page")
    offset: int = Field(default=0, ge=0, description="Pagination offset")


class UserActivityResponse(BaseModel):
    """User activity summary"""
    user_id: UUID
    total_actions: int = Field(..., description="Total number of actions")
    recent_actions: List[AuditLogResponse] = Field(..., description="Recent activity")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")
    last_activity: Optional[datetime] = Field(None, description="Last activity timestamp")

    model_config = ConfigDict(from_attributes=True)


class SecurityEventResponse(BaseModel):
    """Security event summary"""
    event_type: str = Field(..., description="Type of security event")
    count: int = Field(..., description="Number of occurrences")
    recent_events: List[AuditLogResponse] = Field(..., description="Recent events of this type")

    model_config = ConfigDict(from_attributes=True)


class AuditStatistics(BaseModel):
    """Audit statistics summary"""
    total_logs: int = Field(..., description="Total number of audit logs")
    total_users: int = Field(..., description="Number of unique users")
    total_actions: int = Field(..., description="Number of unique actions")
    failed_logins_24h: int = Field(..., description="Failed login attempts in last 24 hours")
    successful_logins_24h: int = Field(..., description="Successful logins in last 24 hours")
    actions_by_type: Dict[str, int] = Field(..., description="Count of actions by type")
    actions_by_status: Dict[str, int] = Field(..., description="Count of actions by status")

    model_config = ConfigDict(from_attributes=True)
