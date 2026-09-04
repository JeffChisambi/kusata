import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DashboardSection } from '../lib/sections';

export interface StaffMember {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  isActive: boolean;
  sections: DashboardSection[];
  mustChangePassword: boolean;
  lastSignInAt: string | null;
  createdAt: string;
}

export interface InviteStaffResult {
  staffId: string;
  email: string;
  sections: DashboardSection[];
  emailSent: boolean;
  /** Present only when the email could not be sent - shown once, never again. */
  temporaryPassword?: string;
}

const keys = {
  all: ['staff'] as const,
  list: () => [...keys.all, 'list'] as const,
};

export function useStaffList(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.list(),
    enabled: opts.enabled ?? true,
    queryFn: () => api.get<{ staff: StaffMember[] }>('/v1/admin/staff'),
    retry: (count, err: any) => (err?.status === 403 ? false : count < 2),
  });
}

export function useInviteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; firstName: string; lastName: string; sections: DashboardSection[] }) =>
      api.post<InviteStaffResult>('/v1/admin/staff', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateStaffSections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sections }: { id: string; sections: DashboardSection[] }) =>
      api.patch<{ staffId: string; sections: DashboardSection[] }>(`/v1/admin/staff/${id}/sections`, { sections }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useSetStaffActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<{ staffId: string; isActive: boolean }>(`/v1/admin/staff/${id}/active`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useResetStaffPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ staffId: string; emailSent: boolean; temporaryPassword?: string }>(`/v1/admin/staff/${id}/reset-password`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
