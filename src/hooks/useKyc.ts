import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

export type KycApplicationRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  userPhone: string;
  status: string;
  nationalIdNumber: string | null;
  city: string | null;
  facialMatchScore: number | null;
  ocrConfidence: number | null;
  documentType: string | null;
  reviewDecision: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export function useKycQueue(params?: { limit?: number; status?: string }) {
  const limit = params?.limit ?? 50;
  const status = params?.status;

  return useQuery({
    queryKey: queryKeys.kyc.queue({ limit, status }),
    queryFn: (): Promise<{ applications: KycApplicationRow[]; count: number }> =>
      api.get<{ applications: KycApplicationRow[]; count: number }>(
        `/v1/admin/kyc/queue?limit=${limit}${status ? `&status=${status}` : ''}`,
      ),
    // Let TanStack Query surface errors via isError/error — don't swallow them.
    // Previously this silently returned empty data on any failure, hiding outages.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useKycApplication(applicationId: string | null) {
  return useQuery({
    queryKey: queryKeys.kyc.application(applicationId ?? ''),
    queryFn: () => api.get(`/v1/admin/kyc/${applicationId}`),
    enabled: !!applicationId,
  });
}

export function useApproveKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, notes }: { applicationId: string; notes?: string }) =>
      api.post(`/v1/admin/kyc/${applicationId}/approve`, { notes }),
    onSuccess: () => {
      // Narrow invalidation: only the KYC queue and dashboard stats are
      // affected by a single review decision. Invalidating all of users.all
      // previously caused the entire user list cache to be thrown away and
      // re-fetched even though no user data changed.
      queryClient.invalidateQueries({ queryKey: queryKeys.kyc.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
      // Also invalidate the user list so the Users page reflects updated KYC status
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
  });
}

export function useRejectKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, reason, notes }: { applicationId: string; reason: string; notes?: string }) =>
      api.post(`/v1/admin/kyc/${applicationId}/reject`, { reason, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kyc.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
  });
}
