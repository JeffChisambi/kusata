import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface CommissionTier {
  minAmount: number;
  maxAmount?: number | null;
  ratePct: number;
  minFee?: number;
}

export interface FeeConfig {
  brokerId: string;
  depositFeeEnabled: boolean;
  depositFeeKind: 'FIXED' | 'PERCENT';
  depositFeeValue: number;
  depositFeeDescription: string | null;
  commissionEnabled: boolean;
  commissionTiers: CommissionTier[];
  statutory: { secLevyPct: number; mseLevyPct: number };
}

const feeKeys = {
  all: ['fees'] as const,
  config: () => [...feeKeys.all, 'config'] as const,
  preview: (amount: number) => [...feeKeys.all, 'preview', amount] as const,
};

export function useFeeConfig() {
  return useQuery<FeeConfig>({
    queryKey: feeKeys.config(),
    queryFn: () => api.get<FeeConfig>('/v1/admin/fees/config'),
    retry: (count, err: any) => {
      // 403 = platform admin (observe-only) — don't hammer the endpoint.
      if (err?.status === 403 || err?.statusCode === 403) return false;
      return count < 2;
    },
  });
}

export function useUpdateFeeConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      depositFeeEnabled: boolean;
      depositFeeKind: 'FIXED' | 'PERCENT';
      depositFeeValue: number;
      depositFeeDescription?: string;
      commissionEnabled: boolean;
      commissionTiers: CommissionTier[];
    }) => api.put<FeeConfig>('/v1/admin/fees/config', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feeKeys.all });
    },
  });
}

export function useFeePreview(amount: number, enabled: boolean) {
  return useQuery({
    queryKey: feeKeys.preview(amount),
    queryFn: () => api.get<{
      deposit: { grossAmount: number; processingFee: number; netAmount: number };
      buy: { grossValue: number; commission: number; levies: number; totalCost: number };
    }>(`/v1/admin/fees/preview?amount=${amount}`),
    enabled: enabled && amount > 0,
    staleTime: 10_000,
  });
}
