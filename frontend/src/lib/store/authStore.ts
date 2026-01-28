import { create } from 'zustand';
import { authAPI } from '@/lib/api/auth';
import { User, Tenant, LoginRequest, RegisterRequest } from '@/types/auth';

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
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Login failed';
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
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Registration failed';
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

    // Super admins don't need tenant to authenticate
    if (user && (user.role === 'super_admin' || tenant)) {
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
  }
}));
