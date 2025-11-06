import { apiClient } from './client';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, User } from '@/types/auth';

export const authAPI = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);

    // Store tokens and context
    apiClient.setAccessToken(response.tokens.access_token);
    apiClient.setRefreshToken(response.tokens.refresh_token);
    if (response.tenant) { // ✅ Check if tenant exists
      apiClient.setTenantId(response.tenant.id);
    }
    // Store user info
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('tenant', JSON.stringify(response.tenant));
      
      // ✅ SET COOKIE
      document.cookie = `user=${encodeURIComponent(JSON.stringify(response.user))}; path=/; max-age=604800`; // 7 days
    }

    return response;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);

    // Store tokens and context
    apiClient.setAccessToken(response.tokens.access_token);
    apiClient.setRefreshToken(response.tokens.refresh_token);
    // ✅ Add null check:
    if (response.tenant) {
      apiClient.setTenantId(response.tenant.id);
    }

    // Store user info
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('tenant', JSON.stringify(response.tenant));
    }

    return response;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      apiClient.clearAuth();
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
    }
  },

  getCurrentUser: async (): Promise<User> => {
    return await apiClient.get<User>('/auth/me');
  },

  // Get user from localStorage
  getStoredUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Get tenant from localStorage
  getStoredTenant: () => {
    if (typeof window === 'undefined') return null;
    const tenantStr = localStorage.getItem('tenant');
    return tenantStr ? JSON.parse(tenantStr) : null;
  }
};
