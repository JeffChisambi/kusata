import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

// ── Types ───────────────────────────────────────────────────────────────────

export type SupportStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
export type SupportCategory =
  | 'DEPOSITS' | 'WITHDRAWALS' | 'TRADING' | 'TREASURY' | 'ACCOUNT' | 'OTHER';
export type SupportAuthorType = 'USER' | 'ADMIN' | 'SYSTEM';

export type SupportTicketUser = { id: string; name: string; phone: string; email?: string | null };

export type SupportMessage = {
  id: string;
  authorType: SupportAuthorType;
  authorName: string | null;
  body: string;
  attachmentUrl: string | null;
  createdAt: string;
};

export type SupportTicketSummary = {
  ticketId: string;
  reference: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  statusLabel: string;
  unread: boolean;
  awaitingAdmin: boolean;
  relatedTransactionId: string | null;
  lastMessageAt: string;
  createdAt: string;
  lastMessage: { authorType: SupportAuthorType; authorName: string | null; preview: string; createdAt: string } | null;
  user: SupportTicketUser | null;
};

export type SupportTicketThread = Omit<SupportTicketSummary, 'lastMessage'> & {
  messages: SupportMessage[];
};

export type SupportListResponse = {
  tickets: SupportTicketSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type SupportStats = { awaitingAdmin: number; open: number; inReview: number };

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useSupportTickets(filters: { status?: SupportStatus; awaitingAdmin?: boolean } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.awaitingAdmin) params.set('awaitingAdmin', 'true');
  params.set('limit', '100');
  const qs = params.toString();
  return useQuery<SupportListResponse>({
    queryKey: queryKeys.support.list(filters),
    queryFn: () => api.get<SupportListResponse>(`/v1/admin/support?${qs}`),
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

export function useSupportTicket(id: string | undefined) {
  return useQuery<SupportTicketThread>({
    queryKey: queryKeys.support.detail(id ?? ''),
    queryFn: () => api.get<SupportTicketThread>(`/v1/admin/support/${id}`),
    enabled: !!id,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
}

export function useSupportStats() {
  return useQuery<SupportStats>({
    queryKey: queryKeys.support.stats(),
    queryFn: () => api.get<SupportStats>('/v1/admin/support/stats'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}

/** Count of tickets awaiting a staff reply — for the sidebar badge. */
export function useUnreadSupportCount(): number {
  const { data } = useSupportStats();
  return data?.awaitingAdmin ?? 0;
}

export function useReplyToTicket(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      api.post<SupportTicketThread>(`/v1/admin/support/${ticketId}/messages`, { message }),
    onSuccess: (thread) => {
      qc.setQueryData(queryKeys.support.detail(ticketId), thread);
      qc.invalidateQueries({ queryKey: queryKeys.support.all });
    },
  });
}

export function useUpdateTicketStatus(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: SupportStatus) =>
      api.patch<SupportTicketThread>(`/v1/admin/support/${ticketId}/status`, { status }),
    onSuccess: (thread) => {
      qc.setQueryData(queryKeys.support.detail(ticketId), thread);
      qc.invalidateQueries({ queryKey: queryKeys.support.all });
    },
  });
}
