import { apiClient } from './client';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, User } from '@/types/auth';

export const authAPI = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);

    // Store tokens and context
    apiClient.setAccessToken(response.tokens.access_token);
    apiClient.setRefreshToken(response.tokens.refresh_token);
    if (response.tenant) {
      apiClient.setTenantId(response.tenant.id);
    }

    // Store user info (only store tenant if it exists)
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));

      // Only store tenant if super admin has one
      if (response.tenant) {
        localStorage.setItem('tenant', JSON.stringify(response.tenant));
      }

      // Set user cookie
      document.cookie = `user=${encodeURIComponent(JSON.stringify(response.user))}; path=/; max-age=604800`; // 7 days
    }

    return response;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);

    // Store tokens and context
    apiClient.setAccessToken(response.tokens.access_token);
    apiClient.setRefreshToken(response.tokens.refresh_token);
    if (response.tenant) {
      apiClient.setTenantId(response.tenant.id);
    }

    // Store user info (only store tenant if it exists)
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));

      if (response.tenant) {
        localStorage.setItem('tenant', JSON.stringify(response.tenant));
      }
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
        // Clear user cookie
        document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
  },

  // Set user in localStorage and cookie
  setStoredUser: (user: User) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('user', JSON.stringify(user));
    document.cookie = `user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=604800`; // 7 days
  },

  // Refresh access token using refresh token
  refreshToken: async (): Promise<{ access_token: string; refresh_token: string }> => {
    if (typeof window === 'undefined') {
      throw new Error('Cannot refresh token on server side');
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await apiClient.post<{ access_token: string; refresh_token: string }>(
        '/auth/refresh',
        { refresh_token: refreshToken }
      );

      // Update tokens in storage
      apiClient.setAccessToken(response.access_token);
      apiClient.setRefreshToken(response.refresh_token);

      return response;
    } catch (error) {
      // If refresh fails, clear auth and redirect to login
      apiClient.clearAuth();
      throw error;
    }
  }
};
