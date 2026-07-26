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
    queryFn: async (): Promise<{ applications: KycApplicationRow[]; count: number }> => {
      try {
        return await api.get<{ applications: KycApplicationRow[]; count: number }>(
          `/v1/admin/kyc/queue?limit=${limit}${status ? `&status=${status}` : ''}`,
        );
      } catch {
        return { applications: [], count: 0 };
      }
    },
    refetchInterval: 30_000,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.kyc.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}
