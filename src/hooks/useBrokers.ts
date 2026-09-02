import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

/* ── Types (mirror the /v1/admin/brokers contracts) ─────────────── */

export interface BrokerSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  userCount: number;
  paymentConfigured: boolean;
  paymentProvider: string | null;
  paymentEnvironment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrokerAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface BrokerApiConfig {
  id: string;
  key: string;
  label: string | null;
  baseUrl: string | null;
  secretSet: boolean;
  metadata: Record<string, unknown> | null;
  isEnabled: boolean;
  require3ds?: boolean;
  updatedAt: string;
}

export interface BrokerDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { users: number; orders: number; transactions: number };
  paymentConfig: {
    isEnabled: boolean;
    provider: string | null;
    environment: string | null;
    updatedAt: string;
  } | null;
  apiConfigs: BrokerApiConfig[];
  admins: BrokerAdmin[];
}

export interface BrokerUserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  kycStatus: string;
  isActive: boolean;
  brokerSelectedAt: string | null;
  createdAt: string;
}

export interface BrokerUsersPage {
  users: BrokerUserRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** One-time invitation payload — the token is NEVER retrievable again. */
export interface BrokerAdminInvitation {
  adminUserId: string;
  email: string;
  invitationId: string;
  invitationToken: string;
  expiresAt: string;
  instructions?: string;
}

export interface BrokerPaymentConfig {
  brokerId: string;
  configured: boolean;
  provider?: string;
  baseUrl?: string;
  apiVersion?: string;
  environment?: 'test' | 'production';
  merchantId?: string;
  apiPasswordSet?: boolean;
  settlementBankName?: string;
  settlementAccountName?: string;
  settlementAccountMasked?: string;
  isEnabled?: boolean;
  require3ds?: boolean;
  updatedAt?: string;
}

/** Result of a live MPGS connection + credential test. Contains no secrets. */
export interface BrokerGatewayTestResult {
  /** The acquirer's gateway host answered its public probe. */
  reachable: boolean;
  /** Merchant ID + API password were accepted by the gateway. */
  authenticated: boolean;
  latencyMs: number;
  environment: string;
  baseUrl: string;
  /** Masked merchant id, e.g. ••••1234. */
  merchantId: string;
  message: string;
}

export interface CreateBrokerInput {
  name: string;
  code: string;
  description?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface UpdateBrokerInput {
  name?: string;
  description?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface PaymentConfigInput {
  provider?: string;
  baseUrl?: string;
  apiVersion?: string;
  environment?: 'test' | 'production';
  merchantId?: string;
  /** Write-only secret — only include when the operator typed a new value. */
  apiPassword?: string;
  settlementBankName?: string;
  settlementAccountName?: string;
  /** Write-only secret — only include when the operator typed a new value. */
  settlementAccountNumber?: string;
  isEnabled?: boolean;
  /** Refuse deposits the issuer cannot 3-D Secure verify. */
  require3ds?: boolean;
}

export interface ApiConfigInput {
  key: string;
  label?: string;
  baseUrl?: string;
  /** Write-only secret — only include when the operator typed a new value. */
  secret?: string;
  metadata?: Record<string, unknown>;
  isEnabled?: boolean;
}

/* ── Queries ────────────────────────────────────────────────────── */

export function useBrokersList() {
  return useQuery({
    queryKey: queryKeys.brokers.list(),
    queryFn: () => api.get<BrokerSummary[]>('/v1/admin/brokers'),
  });
}

export function useBrokerDetail(brokerId: string | null) {
  return useQuery<BrokerDetail>({
    queryKey: queryKeys.brokers.detail(brokerId ?? ''),
    queryFn: () => api.get<BrokerDetail>(`/v1/admin/brokers/${brokerId}`),
    enabled: !!brokerId,
  });
}

export function useBrokerUsers(brokerId: string | null, filters: { page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return useQuery<BrokerUsersPage>({
    queryKey: queryKeys.brokers.users(brokerId ?? '', filters),
    queryFn: () => api.get<BrokerUsersPage>(`/v1/admin/brokers/${brokerId}/users${qs ? `?${qs}` : ''}`),
    enabled: !!brokerId,
  });
}

export function useBrokerPaymentConfig(brokerId: string | null) {
  return useQuery<BrokerPaymentConfig>({
    queryKey: queryKeys.brokers.paymentConfig(brokerId ?? ''),
    queryFn: () => api.get<BrokerPaymentConfig>(`/v1/admin/brokers/${brokerId}/payment-config`),
    enabled: !!brokerId,
  });
}

export function useBrokerApiConfigs(brokerId: string | null) {
  return useQuery<BrokerApiConfig[]>({
    queryKey: queryKeys.brokers.apiConfig(brokerId ?? ''),
    queryFn: () => api.get<BrokerApiConfig[]>(`/v1/admin/brokers/${brokerId}/api-config`),
    enabled: !!brokerId,
  });
}

/* ── Mutations ──────────────────────────────────────────────────── */

export function useCreateBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBrokerInput) => api.post<BrokerSummary>('/v1/admin/brokers', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.all });
    },
  });
}

export function useUpdateBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brokerId, input }: { brokerId: string; input: UpdateBrokerInput }) =>
      api.patch<BrokerDetail>(`/v1/admin/brokers/${brokerId}`, input),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.detail(v.brokerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.list() });
    },
  });
}

export function useUpdateBrokerStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brokerId, isActive }: { brokerId: string; isActive: boolean }) =>
      api.patch(`/v1/admin/brokers/${brokerId}/status`, { isActive }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.detail(v.brokerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.list() });
    },
  });
}

export function useInviteBrokerAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brokerId, input }: {
      brokerId: string;
      input: { email: string; firstName: string; lastName: string; phone?: string };
    }) => api.post<BrokerAdminInvitation>(`/v1/admin/brokers/${brokerId}/admins`, input),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.detail(v.brokerId) });
    },
  });
}

export function useReinviteBrokerAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brokerId, adminId }: { brokerId: string; adminId: string }) =>
      api.post<{ invitationToken: string; expiresAt: string }>(
        `/v1/admin/brokers/${brokerId}/admins/${adminId}/reinvite`,
      ),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.detail(v.brokerId) });
    },
  });
}

export function useUpdateBrokerPaymentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brokerId, input }: { brokerId: string; input: PaymentConfigInput }) =>
      api.put<BrokerPaymentConfig>(`/v1/admin/brokers/${brokerId}/payment-config`, input),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.paymentConfig(v.brokerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.detail(v.brokerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.list() });
    },
  });
}

/**
 * Live credential test against the broker's own MPGS merchant account.
 * Charges nothing: it probes the host, then creates a payment session.
 */
export function useTestBrokerPaymentConfig() {
  return useMutation({
    mutationFn: (brokerId: string) =>
      api.post<BrokerGatewayTestResult>(`/v1/admin/brokers/${brokerId}/payment-config/test`),
  });
}

export function useUpsertBrokerApiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brokerId, input }: { brokerId: string; input: ApiConfigInput }) =>
      api.put<BrokerApiConfig>(`/v1/admin/brokers/${brokerId}/api-config`, input),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.apiConfig(v.brokerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers.detail(v.brokerId) });
    },
  });
}

/* ── Public activation (no auth) ────────────────────────────────── */

export function useActivateAccount() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api.post<{ activated: boolean; email: string; next?: string }>(
        '/v1/admin/auth/activate',
        input,
        { skipAuth: true },
      ),
  });
}
