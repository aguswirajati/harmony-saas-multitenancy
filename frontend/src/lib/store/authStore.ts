import { create } from 'zustand';
import { authAPI } from '@/lib/api/auth';
import { featuresAPI } from '@/lib/api/features';
import { User, Tenant, LoginRequest, RegisterRequest, isSystemUser } from '@/types/auth';

const FEATURES_STORAGE_KEY = 'harmony_features';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  features: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => void;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  loadFeatures: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tenant: null,
  features: [],
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
      // Load features after login (for tenant users)
      if (response.tenant) {
        get().loadFeatures();
      }
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
      // Load features after registration (for tenant users)
      if (response.tenant) {
        get().loadFeatures();
      }
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
      // Clear features from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem(FEATURES_STORAGE_KEY);
      }
      set({
        user: null,
        tenant: null,
        features: [],
        isAuthenticated: false,
        error: null
      });
    }
  },

  checkAuth: () => {
    const user = authAPI.getStoredUser();
    const tenant = authAPI.getStoredTenant();

    // Load features from localStorage
    let storedFeatures: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        const featuresJson = localStorage.getItem(FEATURES_STORAGE_KEY);
        if (featuresJson) {
          storedFeatures = JSON.parse(featuresJson);
        }
      } catch {
        storedFeatures = [];
      }
    }

    // System users (tenant_id=null) don't need tenant to authenticate
    // Tenant users require a tenant
    if (user && (isSystemUser(user) || tenant)) {
      set({
        user,
        tenant,
        features: storedFeatures,
        isAuthenticated: true
      });
      // Refresh features from API for tenant users
      if (tenant) {
        // Use setTimeout to avoid blocking the initial render
        setTimeout(() => {
          useAuthStore.getState().loadFeatures();
        }, 100);
      }
    } else {
      set({
        user: null,
        tenant: null,
        features: [],
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
  },

  loadFeatures: async () => {
    try {
      const response = await featuresAPI.list();
      const features = response.features || [];
      // Store in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem(FEATURES_STORAGE_KEY, JSON.stringify(features));
      }
      set({ features });
    } catch (error) {
      console.error('Failed to load features:', error);
      // Don't clear features on error - keep cached version
    }
  }
}));
