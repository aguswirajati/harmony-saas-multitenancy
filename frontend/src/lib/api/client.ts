import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosRequestConfig } from 'axios';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

class APIClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add tenant & branch context
        const tenantId = this.getTenantId();
        const branchId = this.getBranchId();

        if (tenantId) {
          config.headers['X-Tenant-ID'] = tenantId;
        }

        if (branchId) {
          config.headers['X-Branch-ID'] = branchId;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh the token
            const refreshToken = this.getRefreshToken();

            if (refreshToken) {
              // Call refresh endpoint directly to avoid circular dependency
              const response = await axios.post<{ access_token: string; refresh_token: string }>(
                `${this.baseURL}/auth/refresh`,
                { refresh_token: refreshToken }
              );

              // Update tokens
              this.setAccessToken(response.data.access_token);
              this.setRefreshToken(response.data.refresh_token);

              // Update the Authorization header with new token
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
              }

              // Retry the original request
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // If refresh fails, clear auth and redirect to login
            this.clearAuth();

            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }

            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Token management
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  }

  private getTenantId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('tenant_id');
  }

  private getBranchId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('branch_id');
  }

  public setAccessToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  public setRefreshToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('refresh_token', token);
    }
  }

  public setTenantId(tenantId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tenant_id', tenantId);
    }
  }

  public setBranchId(branchId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('branch_id', branchId);
    }
  }

  public clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('branch_id');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
    }
  }

  // HTTP methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * Download a file with authentication headers
   * Fetches the file as blob and triggers browser download
   */
  async downloadFile(url: string, filename: string): Promise<void> {
    const response = await this.client.get(url, {
      responseType: 'blob',
    });

    // Create blob URL and trigger download
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

export const apiClient = new APIClient();
