import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

export interface PendingWithdrawal {
  transactionId: string;
  amount: number;
  status: string;
  requestedAt: string;
  user: { id: string; name: string; email: string | null; broker: string | null };
  walletBalance: number;
}

const withdrawalKeys = {
  pending: () => [...queryKeys.wallets.all, 'withdrawals', 'pending'] as const,
};

export function usePendingWithdrawals(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: withdrawalKeys.pending(),
    enabled: opts.enabled ?? true,
    queryFn: () =>
      api.get<{ withdrawals: PendingWithdrawal[] }>('/v1/admin/wallets/withdrawals/pending'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useApproveWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) =>
      api.post(`/v1/admin/wallets/withdrawals/${transactionId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useRejectWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason?: string }) =>
      api.post(`/v1/admin/wallets/withdrawals/${transactionId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
