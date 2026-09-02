import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/* Mirrors GET /v1/admin/errors (admin-errors.controller.ts). SUPER_ADMIN only —
   the endpoint is gated by PLATFORM_ADMIN, so callers must pass `enabled`
   false for broker admins rather than letting the request 403. */

export type SystemErrorEvent = {
  id: string;
  source: 'MOBILE_APP' | 'BROKER_DASHBOARD' | 'ADMIN_DASHBOARD' | 'BACKEND';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'RESOLVED';
  message: string;
  stack: string | null;
  location: string | null;
  context: Record<string, unknown> | null;
  userId: string | null;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type SystemErrorStats = {
  open: number;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
};

export const systemErrorKeys = {
  all: ['errors'] as const,
  stats: () => [...systemErrorKeys.all, 'stats'] as const,
  list: (filters: Record<string, unknown>) => [...systemErrorKeys.all, 'list', filters] as const,
};

/** Open-error counts. Drives the errors console header and the topbar queue. */
export function useSystemErrorStats(options: { enabled?: boolean } = {}) {
  return useQuery<SystemErrorStats>({
    queryKey: systemErrorKeys.stats(),
    queryFn: () => api.get<SystemErrorStats>('/v1/admin/errors/stats'),
    enabled: options.enabled ?? true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export interface SystemErrorFilters {
  source?: string;
  severity?: string;
  status?: string;
  /** ISO instant — events last seen at or after this moment. */
  dateFrom?: string;
  /** ISO instant — events last seen at or before this moment. */
  dateTo?: string;
  page?: number;
  limit?: number;
}

export function useSystemErrors(filters: SystemErrorFilters = {}) {
  const params = new URLSearchParams();
  if (filters.source) params.set('source', filters.source);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.status) params.set('status', filters.status);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return useQuery<{ events: SystemErrorEvent[]; total: number }>({
    queryKey: systemErrorKeys.list(filters as Record<string, unknown>),
    queryFn: () =>
      api.get<{ events: SystemErrorEvent[]; total: number }>(
        `/v1/admin/errors${qs ? `?${qs}` : ''}`,
      ),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });
}
