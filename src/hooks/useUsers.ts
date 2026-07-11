import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

interface UserFilters {
  search?: string;
  status?: string;
  kycStatus?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export function useUsersList(filters: UserFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.kycStatus) params.set('kycStatus', filters.kycStatus);
  if (filters.role) params.set('role', filters.role);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => api.get<{
      users: Array<{
        id: string;
        phone: string;
        email: string | null;
        firstName: string;
        lastName: string;
        role: string;
        kycStatus: string;
        isActive: boolean;
        walletBalance: string;
        walletFrozen: boolean;
        deviceCount: number;
        orderCount: number;
        holdingCount: number;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/v1/admin/users${qs ? `?${qs}` : ''}`),
  });
}

export function useUserWorkspace(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.users.workspace(userId ?? ''),
    queryFn: () => api.get(`/v1/admin/users/${userId}`),
    enabled: !!userId,
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: string; reason?: string }) =>
      api.patch(`/v1/admin/users/${userId}/status`, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useRevokeUserSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post(`/v1/admin/users/${userId}/sessions/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
