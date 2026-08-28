import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface DepositRule {
  id: string;
  label?: string;
  enabled: boolean;
  method?: 'CARD' | 'BANK' | 'MOBILE_MONEY' | null;
  kycStatus?: 'APPROVED' | 'PENDING' | 'NOT_SUBMITTED' | 'REJECTED' | null;
  perTransactionMax?: number | null;
  dailyMax?: number | null;
  monthlyMax?: number | null;
  velocityMaxCount?: number | null;
  velocityWindowMinutes?: number | null;
}

export interface RiskConfig {
  brokerId: string;
  concentrationEnabled: boolean;
  maxPositionPct: number;
  warnPositionPct: number | null;
  depositRules: DepositRule[];
}

const riskKeys = {
  all: ['risk'] as const,
  config: () => [...riskKeys.all, 'config'] as const,
};

export function useRiskConfig() {
  return useQuery<RiskConfig>({
    queryKey: riskKeys.config(),
    queryFn: () => api.get<RiskConfig>('/v1/admin/risk/config'),
    retry: (count, err: any) => {
      if (err?.status === 403 || err?.statusCode === 403) return false;
      return count < 2;
    },
  });
}

export function useUpdateRiskConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      concentrationEnabled: boolean;
      maxPositionPct: number;
      warnPositionPct?: number | null;
      depositRules: DepositRule[];
    }) => api.put<RiskConfig>('/v1/admin/risk/config', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riskKeys.all });
    },
  });
}
