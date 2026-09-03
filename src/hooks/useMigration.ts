import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type MigratedInvestorStatus = 'PENDING' | 'INVITED' | 'CLAIMED' | 'CANCELLED';

export interface MigratedInvestor {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  status: MigratedInvestorStatus;
  invitedAt: string | null;
  inviteCount: number;
  claimedAt: string | null;
  createdAt: string;
}

export interface MigrationRow {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  extra?: Record<string, unknown>;
}

export interface ImportResult {
  batchId: string;
  imported: number;
  updated: number;
  skipped: number;
  results: Array<{
    row: number;
    name: string;
    phone: string | null;
    outcome: 'imported' | 'updated' | 'skipped';
    reason?: string;
  }>;
}

const keys = {
  all: ['migration'] as const,
  investors: (status?: string) => [...keys.all, 'investors', status ?? 'all'] as const,
};

export function useMigratedInvestors(status?: MigratedInvestorStatus) {
  return useQuery({
    queryKey: keys.investors(status),
    queryFn: () =>
      api.get<{
        investors: MigratedInvestor[];
        total: number;
        page: number;
        totalPages: number;
        counts: { pending: number; invited: number; claimed: number; cancelled: number };
      }>(`/v1/admin/migration/investors?limit=200${status ? `&status=${status}` : ''}`),
    retry: (count, err: any) => (err?.status === 403 ? false : count < 2),
  });
}

export function useImportInvestors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: MigrationRow[]) =>
      api.post<ImportResult>('/v1/admin/migration/import', { rows }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useInviteInvestors() {
  const qc = useQueryClient();
  return useMutation({
    /** Omit ids to invite everyone not yet claimed. */
    mutationFn: (ids?: string[]) =>
      api.post<{
        sent: number;
        failed: number;
        skippedNoEmail: number;
        details: Array<{ id: string; name: string; outcome: string }>;
      }>('/v1/admin/migration/invite', ids?.length ? { ids } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useCancelInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/admin/migration/investors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
