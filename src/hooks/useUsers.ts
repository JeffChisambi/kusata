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

// Shape of the aggregated workspace payload (GET /admin/users/:id).
export type UserWorkspace = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  createdAt: string;
  isActive: boolean;
  kycStatus: string;
  wallet: { balance: string; isFrozen: boolean; transactions?: WorkspaceTxn[] } | null;
  mfaConfig: { isEnabled: boolean; enabledAt: string | null } | null;
  devices: WorkspaceDevice[];
  sessions: { id: string; deviceId: string; ipAddress: string | null; lastUsedAt: string }[];
  holdings: { quantity: string; averageCost: string; stock: { symbol: string; name: string } }[];
  linkedBanks: WorkspaceBank[];
  kycApplications: { id: string; status: string; createdAt: string }[];
  _count: { orders: number; notifications: number; payments: number };
};
export type WorkspaceDevice = {
  id: string; platform: string; osVersion: string | null; appVersion: string | null;
  trustLevel: string; lastSeenAt: string; lastSeenIp: string | null; lastSeenCountry: string | null;
  isRevoked: boolean;
};
export type WorkspaceBank = {
  id: string; bankName: string; accountName: string; accountNumberMasked: string;
  /** Full account number — brokers need it for CSD account opening. */
  accountNumber?: string;
  isVerified: boolean; isPrimary: boolean;
};
export type WorkspaceTxn = {
  id: string; type: string; status: string; amount: string; description: string | null; createdAt: string;
};

export function useUserWorkspace(userId: string | null) {
  return useQuery<UserWorkspace>({
    queryKey: queryKeys.users.workspace(userId ?? ''),
    queryFn: () => api.get<UserWorkspace>(`/v1/admin/users/${userId}`),
    enabled: !!userId,
    staleTime: 15_000,
  });
}

export function useNotifyUser() {
  return useMutation({
    mutationFn: ({ userId, title, message, channel }: {
      userId: string; title?: string; message: string; channel?: string;
    }) => api.post(`/v1/admin/users/${userId}/notify`, { title, message, channel }),
  });
}

export function useRevokeDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, deviceId }: { userId: string; deviceId: string }) =>
      api.post(`/v1/admin/users/${userId}/devices/${deviceId}/revoke`),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.workspace(v.userId) });
    },
  });
}

export function useUntrustDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, deviceId }: { userId: string; deviceId: string }) =>
      api.post(`/v1/admin/users/${userId}/devices/${deviceId}/untrust`),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.workspace(v.userId) });
    },
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

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/v1/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUserKycStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: string; reason?: string }) =>
      api.patch(`/v1/admin/users/${userId}/kyc-status`, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
