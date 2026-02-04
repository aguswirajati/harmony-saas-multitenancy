import { apiClient } from './client';

export interface RuntimeSettings {
  dev_mode: boolean;
  log_level: string;
  rate_limit_enabled: boolean;
}

export interface RuntimeSettingsUpdate {
  dev_mode?: boolean;
  log_level?: string;
  rate_limit_enabled?: boolean;
}

export interface SystemInfo {
  python_version: string;
  fastapi_version: string;
  platform: string;
  database_status: string;
  redis_status: string;
  migration_version: string;
  uptime: string;
  uptime_seconds: number;
  env_vars: Record<string, string>;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export const adminToolsAPI = {
  getSettings: async (): Promise<RuntimeSettings> => {
    return apiClient.get<RuntimeSettings>('/admin/tools/settings');
  },

  updateSettings: async (data: RuntimeSettingsUpdate): Promise<RuntimeSettings> => {
    return apiClient.post<RuntimeSettings>('/admin/tools/settings', data);
  },

  getSystemInfo: async (): Promise<SystemInfo> => {
    return apiClient.get<SystemInfo>('/admin/tools/system-info');
  },

  getLogs: async (params?: { level?: string; limit?: number; offset?: number }): Promise<LogEntry[]> => {
    const queryParams = new URLSearchParams();
    if (params?.level) queryParams.append('level', params.level);
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) queryParams.append('offset', params.offset.toString());
    const qs = queryParams.toString();
    return apiClient.get<LogEntry[]>(`/admin/tools/logs${qs ? `?${qs}` : ''}`);
  },
};
