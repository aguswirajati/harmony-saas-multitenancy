import { create } from 'zustand';
import { authAPI } from '@/lib/api/auth';
import { User, Tenant, LoginRequest, RegisterRequest, isSystemUser } from '@/types/auth';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => void;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (data: LoginRequest) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(data);
      set({
        user: response.user,
        tenant: response.tenant,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error: unknown) {
      const axiosError = error as {
        response?: {
          data?: {
            detail?: string | Array<{ msg: string; loc: string[] }>;
            error?: { message?: string; details?: Array<{ field: string; message: string }> };
          }
        }
      };
      let errorMessage = 'Login failed';
      const detail = axiosError.response?.data?.detail;
      const errorObj = axiosError.response?.data?.error;

      if (errorObj) {
        // Handle custom error handler format: {error: {message, details}}
        if (errorObj.details && Array.isArray(errorObj.details) && errorObj.details.length > 0) {
          errorMessage = errorObj.details.map(err => err.message).join('. ');
        } else if (errorObj.message) {
          errorMessage = errorObj.message;
        }
      } else if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        errorMessage = detail.map(err => err.msg).join('. ');
      }
      set({
        error: errorMessage,
        isLoading: false,
        isAuthenticated: false
      });
      throw error;
    }
  },

  register: async (data: RegisterRequest) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register(data);
      set({
        user: response.user,
        tenant: response.tenant,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error: unknown) {
      const axiosError = error as {
        response?: {
          data?: {
            detail?: string | Array<{ msg: string; loc: string[] }>;
            error?: { message?: string; details?: Array<{ field: string; message: string }> };
          }
        }
      };
      let errorMessage = 'Registration failed';
      const detail = axiosError.response?.data?.detail;
      const errorObj = axiosError.response?.data?.error;

      if (errorObj) {
        // Handle custom error handler format: {error: {message, details}}
        if (errorObj.details && Array.isArray(errorObj.details) && errorObj.details.length > 0) {
          errorMessage = errorObj.details.map(err => err.message).join('. ');
        } else if (errorObj.message) {
          errorMessage = errorObj.message;
        }
      } else if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Handle Pydantic validation errors (422)
        errorMessage = detail.map(err => err.msg).join('. ');
      }
      set({
        error: errorMessage,
        isLoading: false,
        isAuthenticated: false
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } finally {
      set({
        user: null,
        tenant: null,
        isAuthenticated: false,
        error: null
      });
    }
  },

  checkAuth: () => {
    const user = authAPI.getStoredUser();
    const tenant = authAPI.getStoredTenant();

    // System users (tenant_id=null) don't need tenant to authenticate
    // Tenant users require a tenant
    if (user && (isSystemUser(user) || tenant)) {
      set({
        user,
        tenant,
        isAuthenticated: true
      });
    } else {
      set({
        user: null,
        tenant: null,
        isAuthenticated: false
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  refreshUser: async () => {
    try {
      const response = await authAPI.getCurrentUser();
      // Update the user in store and cookie
      authAPI.setStoredUser(response);
      set({ user: response });
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }
}));
