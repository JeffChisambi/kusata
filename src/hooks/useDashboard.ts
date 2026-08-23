import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => api.get<{
      totalUsers: number;
      activeUsers: number;
      pendingKyc: number;
      todayOrders: number;
      todayVolume: string;
      pendingPayments: number;
      activeSessions: number;
      totalWalletBalance: string;
      todayNewUsers: number;
    }>('/v1/admin/dashboard/stats'),
    refetchInterval: 30_000,
    // Do not poll when the tab is in the background — avoids unnecessary load
    // on the API from inactive sessions.
    refetchIntervalInBackground: false,
  });
}

export function useDashboardFinancials() {
  return useQuery({
    queryKey: [...queryKeys.dashboard.all, 'financials'] as const,
    queryFn: () => api.get<{
      clientAssets: {
        clientCash: number;
        portfolioValue: number;
        totalInvestorAssets: number;
      };
      brokerRevenue: { tradingCommissions: number };
      statutory: { leviesCollected: number };
      paymentCosts: { processingFees: number };
      pendingWithdrawals: { count: number; amount: number };
    }>('/v1/admin/dashboard/financials'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useDashboardCharts(days = 14) {
  return useQuery({
    queryKey: queryKeys.dashboard.charts(days),
    queryFn: () => api.get<Array<{
      date: string;
      trades: number;
      volume: string;
      deposits: string;
      withdrawals: string;
      revenue: string;
      newUsers: number;
      activeUsers: number;
    }>>(`/v1/admin/dashboard/charts?days=${days}`),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: queryKeys.dashboard.health(),
    queryFn: () => api.get<{
      status: string;
      checks: Record<string, { status: string; latencyMs?: number }>;
      timestamp: string;
    }>('/v1/admin/dashboard/health'),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}
