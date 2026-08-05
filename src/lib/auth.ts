/**
 * Auth Store — manages admin authentication state.
 *
 * Token storage: localStorage (acceptable for admin dashboard — not a
 * public-facing consumer app). In production, consider httpOnly cookies.
 *
 * MFA Flow:
 *   1. login(email, password) → { mfaRequired: 'setup' | 'verify', mfaToken }
 *   2. If 'setup':  setupMfa(mfaToken) → { secret, otpauthUri }
 *                   confirmMfa(mfaToken, code) → { accessToken, refreshToken, recoveryCodes }
 *   3. If 'verify': verifyMfa(mfaToken, code) → { accessToken, refreshToken }
 */
import { useEffect, useState } from 'react';
import { api } from './api';

const KEYS = {
  accessToken: 'pine_admin_access_token',
  refreshToken: 'pine_admin_refresh_token',
  user: 'pine_admin_user',
} as const;

export interface AdminUser {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: string;
}

export interface LoginResponse {
  mfaRequired: 'setup' | 'verify';
  mfaToken: string;
  user: AdminUser;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
}

export interface MfaConfirmResponse {
  accessToken: string;
  refreshToken: string;
  recoveryCodes: string[];
  user: AdminUser;
}

export interface MfaVerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
}

// ── Auth Operations ────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await api.post<LoginResponse>('/v1/admin/auth/login', { email, password }, { skipAuth: true });
  // Store the user info for the MFA step
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEYS.user, JSON.stringify(data.user));
  }
  return data;
}

export async function setupMfa(mfaToken: string): Promise<MfaSetupResponse> {
  return api.post<MfaSetupResponse>('/v1/admin/auth/mfa/setup', { mfaToken }, { skipAuth: true });
}

export async function confirmMfaSetup(mfaToken: string, code: string): Promise<MfaConfirmResponse> {
  const data = await api.post<MfaConfirmResponse>(
    '/v1/admin/auth/mfa/confirm-setup',
    { mfaToken, code },
    { skipAuth: true },
  );
  storeTokens(data.accessToken, data.refreshToken, data.user);
  return data;
}

export async function verifyMfa(mfaToken: string, code: string): Promise<MfaVerifyResponse> {
  const data = await api.post<MfaVerifyResponse>(
    '/v1/admin/auth/mfa/verify',
    { mfaToken, code },
    { skipAuth: true },
  );
  storeTokens(data.accessToken, data.refreshToken, data.user);
  return data;
}

export async function verifyRecoveryCode(mfaToken: string, code: string): Promise<MfaVerifyResponse> {
  const data = await api.post<MfaVerifyResponse>(
    '/v1/admin/auth/mfa/recovery',
    { mfaToken, code },
    { skipAuth: true },
  );
  storeTokens(data.accessToken, data.refreshToken, data.user);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/v1/admin/auth/logout');
  } catch {
    // Ignore errors — clear tokens regardless
  }
  clearTokens();
}

// ── Token Management ───────────────────────────────────────────

function storeTokens(accessToken: string, refreshToken: string, user: AdminUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.accessToken, accessToken);
  localStorage.setItem(KEYS.refreshToken, refreshToken);
  localStorage.setItem(KEYS.user, JSON.stringify(user));
}

function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.accessToken);
  localStorage.removeItem(KEYS.refreshToken);
  localStorage.removeItem(KEYS.user);
}

// ── State Queries ──────────────────────────────────────────────

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(KEYS.accessToken);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEYS.accessToken);
}

export function getCurrentUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Hydration-safe accessor for the current user.
 *
 * `getCurrentUser()` reads localStorage, so it returns null on the server but
 * the real user on the client. Rendering that value directly makes the server
 * HTML and the first client render disagree (React hydration error #418). This
 * hook returns null on the server AND on the first client render (matching the
 * SSR output), then swaps in the real user after mount — so user-specific text
 * can be rendered without a hydration mismatch.
 */
export function useCurrentUser(): AdminUser | null {
  const [user, setUser] = useState<AdminUser | null>(null);
  useEffect(() => {
    setUser(getCurrentUser());
  }, []);
  return user;
}
