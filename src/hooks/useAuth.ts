import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  login as authLogin,
  logout as authLogout,
  verifyMfa as authVerifyMfa,
  setupMfa as authSetupMfa,
  confirmMfaSetup as authConfirmMfaSetup,
  verifyRecoveryCode as authVerifyRecoveryCode,
  isAuthenticated as checkAuth,
  getCurrentUser,
  type AdminUser,
  type LoginResponse,
  type MfaSetupResponse,
  type MfaVerifyResponse,
  type MfaConfirmResponse,
} from '../lib/auth';

// Simple external store for reactivity across components
let authVersion = 0;
const listeners = new Set<() => void>();

function notifyAuthChange() {
  authVersion++;
  listeners.forEach((l) => l());
}

function subscribeAuth(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getAuthSnapshot() {
  return authVersion;
}

export function useAuth() {
  // Re-render on auth changes
  useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot);

  const authenticated = checkAuth();
  const user = getCurrentUser();

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    const result = await authLogin(email, password);
    notifyAuthChange();
    return result;
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, code: string): Promise<MfaVerifyResponse> => {
    const result = await authVerifyMfa(mfaToken, code);
    notifyAuthChange();
    return result;
  }, []);

  const setupMfa = useCallback(async (mfaToken: string): Promise<MfaSetupResponse> => {
    return authSetupMfa(mfaToken);
  }, []);

  const confirmMfaSetup = useCallback(async (mfaToken: string, code: string): Promise<MfaConfirmResponse> => {
    const result = await authConfirmMfaSetup(mfaToken, code);
    notifyAuthChange();
    return result;
  }, []);

  const verifyRecoveryCode = useCallback(async (mfaToken: string, code: string): Promise<MfaVerifyResponse> => {
    const result = await authVerifyRecoveryCode(mfaToken, code);
    notifyAuthChange();
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    notifyAuthChange();
  }, []);

  return {
    isAuthenticated: authenticated,
    user,
    login,
    logout,
    verifyMfa,
    setupMfa,
    confirmMfaSetup,
    verifyRecoveryCode,
  };
}
