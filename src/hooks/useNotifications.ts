import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

/**
 * Admin notifications = the OUTBOUND delivery log.
 *
 * Every row in the `notifications` table belongs to an INVESTOR (a CUSTOMER
 * user) — nothing in the platform ever writes a notification addressed to a
 * staff/broker account. So these hooks describe messages the broker SENT to
 * clients, never a broker inbox. There is deliberately no mark-as-read here:
 * clearing a client's unread badge from the dashboard would corrupt what that
 * client sees in the mobile app.
 */

export interface NotificationRecipient {
  id: string;
  firstName: string;
  lastName: string;
}

export interface NotificationRow {
  id: string;
  userId: string;
  channel: string;
  category: string | null;
  type: string | null;
  title: string | null;
  body: string | null;
  status: string;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
  user: NotificationRecipient | null;
}

export interface NotificationsPage {
  notifications: NotificationRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NotificationFilters {
  status?: string;
  channel?: string;
  category?: string;
  /** ISO instant — deliveries created at or after this moment. */
  dateFrom?: string;
  /** ISO instant — deliveries created at or before this moment. */
  dateTo?: string;
  page?: number;
  limit?: number;
}

export function useNotificationsList(filters: NotificationFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.category) params.set('category', filters.category);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return useQuery<NotificationsPage>({
    queryKey: queryKeys.notifications.list(filters as Record<string, unknown>),
    queryFn: () => api.get<NotificationsPage>(`/v1/admin/notifications${qs ? `?${qs}` : ''}`),
    // Keep the log live so newly dispatched messages appear without a manual
    // refresh, and refresh immediately when the tab regains focus.
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: queryKeys.notifications.stats(),
    queryFn: () => api.get<{
      byStatus: Array<{ status: string; count: number }>;
      byChannel: Array<{ channel: string; count: number }>;
    }>('/v1/admin/notifications/stats'),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
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
