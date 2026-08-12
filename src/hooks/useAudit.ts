import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

/* Mirrors GET /v1/admin/audit (audit.controller.ts + audit.repository.ts). */

export interface AuditActor {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: AuditActor | null;
}

export interface AuditSearchFilters {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface AuditSearchPage {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useAuditLogs(filters: AuditSearchFilters = {}) {
  const params = new URLSearchParams();
  if (filters.actorId) params.set('actorId', filters.actorId);
  if (filters.action) params.set('action', filters.action);
  if (filters.resourceType) params.set('resourceType', filters.resourceType);
  if (filters.resourceId) params.set('resourceId', filters.resourceId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return useQuery<AuditSearchPage>({
    queryKey: queryKeys.audit.search({ ...filters }),
    queryFn: () => api.get<AuditSearchPage>(`/v1/admin/audit${qs ? `?${qs}` : ''}`),
    placeholderData: (prev) => prev,
  });
}
