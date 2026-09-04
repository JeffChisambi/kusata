/**
 * Settings hooks — current admin user profile, password, MFA, sessions,
 * and notification preferences.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AdminProfile {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface AdminSession {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  location?: string | null;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
}

export interface NotifPrefs {
  order_filled: boolean;
  order_failed: boolean;
  kyc_update: boolean;
  login_alert: boolean;
  daily_summary: boolean;
}

export interface MfaSetupPayload {
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
}

export interface MfaConfirmPayload {
  recoveryCodes: string[];
}

// ── Profile ────────────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: () => api.get<AdminProfile>('/v1/admin/me'),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { firstName: string; lastName: string; phone?: string }) =>
      api.patch<AdminProfile>('/v1/admin/me', data),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.me.profile(), updated);
      // Keep localStorage in sync so the sidebar avatar reflects changes
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('pine_admin_user');
        if (raw) {
          try {
            const user = JSON.parse(raw);
            localStorage.setItem(
              'pine_admin_user',
              JSON.stringify({ ...user, firstName: updated.firstName, lastName: updated.lastName }),
            );
          } catch { /* ignore */ }
        }
      }
    },
  });
}

// ── Password ───────────────────────────────────────────────────────────────────

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post('/v1/admin/me/change-password', data),
  });
}

// ── MFA ────────────────────────────────────────────────────────────────────────

export function useSetupMfa() {
  return useMutation({
    mutationFn: () => api.post<MfaSetupPayload>('/v1/admin/me/mfa/setup'),
  });
}

export function useConfirmMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string }) =>
      api.post<MfaConfirmPayload>('/v1/admin/me/mfa/confirm', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me.profile() });
    },
  });
}

export function useDisableMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/v1/admin/me/mfa/disable'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me.profile() });
    },
  });
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export function useMySessions() {
  return useQuery({
    queryKey: queryKeys.me.sessions(),
    queryFn: () => api.get<AdminSession[]>('/v1/admin/me/sessions'),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post(`/v1/admin/me/sessions/${sessionId}/revoke`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me.sessions() });
    },
  });
}

export function useRevokeAllSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/v1/admin/me/sessions/revoke-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me.sessions() });
    },
  });
}

// ── Notification preferences ───────────────────────────────────────────────────

export function useNotifPrefs() {
  return useQuery({
    queryKey: queryKeys.me.notifPrefs(),
    queryFn: () => api.get<NotifPrefs>('/v1/admin/me/notification-preferences'),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdateNotifPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotifPrefs) =>
      api.patch<NotifPrefs>('/v1/admin/me/notification-preferences', prefs),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.me.notifPrefs(), updated);
    },
  });
}
