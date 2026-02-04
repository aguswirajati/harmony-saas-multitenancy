import { apiClient } from './client';

export interface AuditLog {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  timestamp: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditStatistics {
  total_logs: number;
  total_users: number;
  total_actions: number;
  failed_logins_24h: number;
  successful_logins_24h: number;
  actions_by_type: Record<string, number>;
  actions_by_status: Record<string, number>;
}

export interface AuditLogParams {
  skip?: number;
  limit?: number;
  action?: string;
  resource?: string;
  status?: string;
  user_id?: string;
  tenant_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export const auditAPI = {
  /**
   * Get paginated list of audit logs with optional filters
   */
  getAuditLogs: async (params: AuditLogParams = {}): Promise<AuditLogListResponse> => {
    const queryParams = new URLSearchParams();

    if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params.action) queryParams.append('action', params.action);
    if (params.resource) queryParams.append('resource', params.resource);
    if (params.status) queryParams.append('status', params.status);
    if (params.user_id) queryParams.append('user_id', params.user_id);
    if (params.tenant_id) queryParams.append('tenant_id', params.tenant_id);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = `/admin/audit-logs${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<AuditLogListResponse>(url);
  },

  /**
   * Get audit log statistics
   */
  getStatistics: async (): Promise<AuditStatistics> => {
    return apiClient.get<AuditStatistics>('/admin/audit-logs/statistics');
  },

  /**
   * Get list of unique action types
   */
  getActions: async (): Promise<string[]> => {
    return apiClient.get<string[]>('/admin/audit-logs/actions');
  },

  /**
   * Get list of unique resource types
   */
  getResources: async (): Promise<string[]> => {
    return apiClient.get<string[]>('/admin/audit-logs/resources');
  },

  /**
   * Get single audit log by ID
   */
  getAuditLog: async (logId: string): Promise<AuditLog> => {
    return apiClient.get<AuditLog>(`/admin/audit-logs/${logId}`);
  },

  /**
   * Clear all audit logs (DEV MODE only)
   */
  clearLogs: async (): Promise<{ message: string; deleted: number }> => {
    return apiClient.delete<{ message: string; deleted: number }>('/admin/audit-logs/');
  },

  /**
   * Archive old audit logs before a given date
   */
  archiveLogs: async (beforeDate?: string): Promise<{ message: string; archived: number; before_date: string }> => {
    const params = beforeDate ? `?before_date=${encodeURIComponent(beforeDate)}` : '';
    return apiClient.post<{ message: string; archived: number; before_date: string }>(`/admin/audit-logs/archive${params}`);
  },
};

/**
 * Tenant-scoped audit API — uses the same endpoints as auditAPI.
 * The backend automatically scopes results to the current user's tenant
 * when the caller is not a super admin.
 */
export const tenantAuditAPI = {
  getAuditLogs: async (params: Omit<AuditLogParams, 'tenant_id'> = {}): Promise<AuditLogListResponse> => {
    const queryParams = new URLSearchParams();

    if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params.action) queryParams.append('action', params.action);
    if (params.resource) queryParams.append('resource', params.resource);
    if (params.status) queryParams.append('status', params.status);
    if (params.user_id) queryParams.append('user_id', params.user_id);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = `/admin/audit-logs${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<AuditLogListResponse>(url);
  },

  getStatistics: async (): Promise<AuditStatistics> => {
    return apiClient.get<AuditStatistics>('/admin/audit-logs/statistics');
  },

  getActions: async (): Promise<string[]> => {
    return apiClient.get<string[]>('/admin/audit-logs/actions');
  },

  getResources: async (): Promise<string[]> => {
    return apiClient.get<string[]>('/admin/audit-logs/resources');
  },

  getAuditLog: async (logId: string): Promise<AuditLog> => {
    return apiClient.get<AuditLog>(`/admin/audit-logs/${logId}`);
  },
};
