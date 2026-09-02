import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

interface NotificationFilters {
  status?: string;
  channel?: string;
  page?: number;
  limit?: number;
}

export function useNotificationsList(filters: NotificationFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return useQuery({
    queryKey: queryKeys.notifications.list(filters as Record<string, unknown>),
    queryFn: () => api.get(`/v1/admin/notifications${qs ? `?${qs}` : ''}`),
    // Keep the list live so the dashboard receives new notifications without a
    // manual refresh, and refresh immediately when the tab regains focus.
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: queryKeys.notifications.stats(),
    queryFn: () => api.get<{
      byStatus: Array<{ status: string; count: number }>;
      byChannel: Array<{ channel: string; count: number }>;
    }>('/v1/admin/notifications/stats'),
    // Drives the topbar badge only — a minute is plenty.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

/** Mark one notification (within the caller's broker scope) as read. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/v1/admin/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

/** Mark every unread notification within the caller's broker scope as read. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch<{ updated: number }>('/v1/admin/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

/**
 * Returns the count of notifications that are not in a terminal "read" state.
 * Treats anything that isn't READ/DELIVERED as needing attention.
 */
export function useUnreadNotificationCount(): number {
  const { data } = useNotificationStats();
  if (!data?.byStatus) return 0;
  const READ_STATUSES = new Set(['READ', 'DELIVERED']);
  return data.byStatus
    .filter((s) => !READ_STATUSES.has(s.status.toUpperCase()))
    .reduce((sum, s) => sum + s.count, 0);
}

export function useBroadcastNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      body: string;
      channel?: string;
      targetRole?: string;
      /** ANNOUNCEMENT (broker-authored, default) | SYSTEM | MARKETING */
      category?: string;
    }) => api.post('/v1/admin/notifications/broadcast', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
