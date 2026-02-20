import { apiClient } from './client';
import { User, UserCreate, UserUpdate, UserListResponse, UserChangePassword } from '@/types/user';

export const userAPI = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    search?: string;
    tenant_role?: string;
    branch_id?: string;
  }): Promise<UserListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.tenant_role) queryParams.append('tenant_role', params.tenant_role);
    if (params?.branch_id) queryParams.append('branch_id', params.branch_id);

    const url = `/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<UserListResponse>(url);
  },

  get: async (id: string): Promise<User> => {
    return apiClient.get<User>(`/users/${id}`);
  },

  create: async (data: UserCreate): Promise<User> => {
    return apiClient.post<User>('/users', data);
  },

  update: async (id: string, data: UserUpdate): Promise<User> => {
    return apiClient.put<User>(`/users/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/users/${id}`);
  },

  changePassword: async (id: string, data: UserChangePassword): Promise<void> => {
    return apiClient.post(`/users/${id}/change-password`, data);
  },

  checkLimit: async (): Promise<{
    can_add: boolean;
    current_count: number;
    limit: number;
    available: number;
    percentage: number;
  }> => {
    return apiClient.get('/tenant-settings/limits/users');
  },

  deleteMyAccount: async (password: string): Promise<{ message: string; email: string }> => {
    return apiClient.delete(`/users/me?password=${encodeURIComponent(password)}`);
  },

  getMe: async (): Promise<User> => {
    return apiClient.get('/auth/me');
  }
};

// Admin API - Super Admin Only
export const adminUserAPI = {
  listAll: async (params?: {
    skip?: number;
    limit?: number;
    search?: string;
    role?: string;
    tenant_id?: string;
  }): Promise<UserListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.role) queryParams.append('role', params.role);
    if (params?.tenant_id) queryParams.append('tenant_id', params.tenant_id);

    const url = `/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<UserListResponse>(url);
  },
};
