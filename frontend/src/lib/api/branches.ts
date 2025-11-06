import { apiClient } from './client';
import { Branch, BranchCreate, BranchUpdate, BranchListResponse } from '@/types/branch';

export const branchAPI = {
  list: async (params?: { skip?: number; limit?: number; search?: string }): Promise<BranchListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);

    const url = `/branches${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<BranchListResponse>(url);
  },

  get: async (id: string): Promise<Branch> => {
    return apiClient.get<Branch>(`/branches/${id}`);
  },

  create: async (data: BranchCreate): Promise<Branch> => {
    return apiClient.post<Branch>('/branches', data);
  },

  update: async (id: string, data: BranchUpdate): Promise<Branch> => {
    return apiClient.put<Branch>(`/branches/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/branches/${id}`);
  }
};
