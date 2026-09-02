import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const platformKeys = {
  all: ['platform'] as const,
  commission: () => [...platformKeys.all, 'commission'] as const,
  earnings: () => [...platformKeys.all, 'brokers', 'earnings'] as const,
};

export interface PlatformCommission {
  platformCommissionPct: number;
  updatedAt: string;
  updatedById: string | null;
}

export interface BrokerEarningsRow {
  brokerId: string;
  name: string;
  code: string;
  isActive: boolean;
  investors: number;
  thisMonth: { trades: number; commissions: number; leviesCollected: number; owedToPlatform: number };
  lastMonth: { commissions: number; owedToPlatform: number };
  lifetime: { trades: number; commissions: number; owedToPlatform: number };
}

export interface BrokerEarningsReport {
  ratePct: number;
  periodStart: string;
  periodEnd: string;
  brokers: BrokerEarningsRow[];
  totals: { commissionsThisMonth: number; owedThisMonth: number; owedLifetime: number };
}

/** Super Admin: Pine's commission rate on broker commissions. */
export function usePlatformCommission() {
  return useQuery<PlatformCommission>({
    queryKey: platformKeys.commission(),
    queryFn: () => api.get<PlatformCommission>('/v1/admin/platform/commission'),
  });
}

export function useUpdatePlatformCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platformCommissionPct: number) =>
      api.put<PlatformCommission>('/v1/admin/platform/commission', { platformCommissionPct }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: platformKeys.all });
    },
  });
}

/** Super Admin: every broker's commissions and what each owes Pine. */
export function useBrokerEarnings() {
  return useQuery<BrokerEarningsReport>({
    queryKey: platformKeys.earnings(),
    queryFn: () => api.get<BrokerEarningsReport>('/v1/admin/platform/brokers/earnings'),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
