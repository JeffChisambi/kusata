import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

// ── Queue row (returned from list / queue endpoint) ───────────────────────────

export type KycApplicationRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  userPhone: string;
  /**
   * Uppercase status from API.
   * Expected values: PENDING | APPROVED | REJECTED | ADDITIONAL_DOCS | MANUAL_REVIEW | NOT_SUBMITTED
   */
  status: string;
  nationalIdNumber: string | null;
  city: string | null;
  facialMatchScore: number | null;
  ocrConfidence: number | null;
  /** Liveness / anti-spoofing score (0–100). */
  livenessScore: number | null;
  /**
   * Uppercase document type.
   * Expected values: NATIONAL_ID | PASSPORT | DRIVERS_LICENSE
   */
  documentType: string | null;
  /**
   * Uppercase tier.
   * Expected values: TIER_1 | TIER_2 (also accepts TIER1 / TIER2 / 1 / 2 for leniency).
   */
  tier: string | null;
  reviewDecision: string | null;
  /** Display name of the admin who last reviewed this application. */
  reviewerName: string | null;
  /** Internal notes left by the reviewer. */
  reviewNotes: string | null;
  /**
   * Automated risk flag codes, e.g. ["LIVENESS_FAIL", "OCR_LOW_CONFIDENCE",
   * "FACE_MISMATCH", "DOCUMENT_EXPIRED", "DUPLICATE_DETECTED"].
   */
  riskFlags: string[] | null;
  emailVerified: boolean | null;
  phoneVerified: boolean | null;
  submittedAt: string;
  reviewedAt: string | null;
};

// ── Document ──────────────────────────────────────────────────────────────────

export type KycDocument = {
  id: string;
  /**
   * Document slot identifier.
   * Expected values: ID_FRONT | ID_BACK | SELFIE | NATIONAL_ID | NATIONAL_ID_BACK |
   *   PASSPORT_FRONT | PASSPORT_BACK | DRIVERS_LICENSE_FRONT | DRIVERS_LICENSE_BACK
   */
  type: string;
  /** Presigned or direct URL to the document image. May be null if not yet uploaded. */
  imageUrl: string | null;
  mimeType: string;
  uploadedAt: string;
};

// ── OCR extracted data ────────────────────────────────────────────────────────

export type KycOcrData = {
  fullName: string | null;
  dateOfBirth: string | null;
  /** National ID / document number as read by OCR. */
  nationalId: string | null;
  documentNumber: string | null;
  expiryDate: string | null;
  address: string | null;
  nationality: string | null;
  gender: string | null;
  /** Any additional raw OCR fields the backend chooses to surface. */
  [key: string]: string | null | undefined;
};

// ── MRZ verification summary (back-of-ID machine-readable zone) ───────────────

export type KycMrzInfo = {
  found: boolean;
  /** % of ICAO check digits that validated (100 = fully verified). */
  checkDigitScore: number;
};

// ── Extracted residential address (proof-of-residency pipeline) ───────────────

export type KycAddress = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  /** Single formatted display string. */
  formatted: string | null;
  /** Extraction confidence 0–100 (null when address came from profile). */
  confidence: number | null;
};

// ── Full application detail (returned from single-application endpoint) ───────

export type KycApplicationDetail = {
  application: KycApplicationRow & {
    ocrExtractedData: KycOcrData | null;
    /** Per-field OCR confidence, 0–100 (e.g. { fullName: 90 }). */
    ocrFieldConfidences: Record<string, number> | null;
    mrz: KycMrzInfo | null;
    address: KycAddress | null;
  };
  documents: KycDocument[];
};

// ── Counts per status (returned from counts endpoint) ────────────────────────

export type KycCountsByStatus = {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  ADDITIONAL_DOCS: number;
  MANUAL_REVIEW: number;
  NOT_SUBMITTED: number;
  /** Any other status codes the backend may introduce. */
  [status: string]: number;
};

// ── Queue (paginated, server-side status filter) ──────────────────────────────

export type KycQueueParams = {
  limit?: number;
  page?: number;
  /** Uppercase API status string, e.g. "PENDING". Omit for all statuses. */
  status?: string;
};

export type KycQueueResponse = {
  applications: KycApplicationRow[];
  /** Count of items in this page (≤ limit). */
  count: number;
  /** Total matching records across all pages. */
  total: number;
  page: number;
  totalPages: number;
};

export function useKycQueue(params?: KycQueueParams) {
  const limit = params?.limit ?? 50;
  const page = params?.page ?? 1;
  const status = params?.status;

  const filters: Record<string, unknown> = { limit, page };
  if (status) filters.status = status;

  return useQuery({
    queryKey: queryKeys.kyc.queue(filters),
    queryFn: (): Promise<KycQueueResponse> => {
      const qs = new URLSearchParams({ limit: String(limit), page: String(page) });
      if (status) qs.set('status', status);
      return api.get<KycQueueResponse>(`/v1/admin/kyc/queue?${qs}`);
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    // Keeps previous page data visible while the next page loads — prevents flicker.
    placeholderData: (prev) => prev,
  });
}

// ── Per-status counts (drives tab badges and stats cards) ────────────────────

/**
 * Fetches aggregate KYC counts per status from GET /v1/admin/kyc/counts.
 * Fails gracefully if the endpoint does not exist yet — the UI degrades to
 * showing zero values rather than crashing.
 */
export function useKycCounts() {
  return useQuery<KycCountsByStatus>({
    queryKey: queryKeys.kyc.counts(),
    queryFn: () => api.get<KycCountsByStatus>('/v1/admin/kyc/counts'),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    // Only retry once — don't hammer a not-yet-implemented endpoint.
    retry: 1,
  });
}

// ── Single application detail ─────────────────────────────────────────────────

export function useKycApplication(applicationId: string | null) {
  return useQuery<KycApplicationDetail>({
    queryKey: queryKeys.kyc.application(applicationId ?? ''),
    queryFn: () => api.get<KycApplicationDetail>(`/v1/admin/kyc/${applicationId}`),
    enabled: !!applicationId,
    // Detail data only changes after a review action, which invalidates the cache.
    staleTime: 60_000,
  });
}

// ── CSD Account Opening form download ────────────────────────────────────────

/**
 * Download the pre-filled Reserve Bank of Malawi CSD Securities Account
 * Opening form (PDF) for an application, generated server-side from the
 * verified KYC data.
 */
export async function downloadCsdForm(applicationId: string): Promise<void> {
  const blob = await api.getBlob(`/v1/admin/kyc/${applicationId}/csd-form`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CSD-Account-Opening-${applicationId.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Shared post-mutation cache invalidation ───────────────────────────────────

function invalidateKycCaches(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.kyc.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
  // Users page reflects updated KYC status — invalidate list only (not full users.all).
  queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
}

// ── Approve ───────────────────────────────────────────────────────────────────

export function useApproveKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, notes }: { applicationId: string; notes?: string }) =>
      api.post(`/v1/admin/kyc/${applicationId}/approve`, { notes }),
    onSuccess: () => invalidateKycCaches(queryClient),
  });
}

// ── Reject ────────────────────────────────────────────────────────────────────

export function useRejectKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      reason,
      notes,
    }: {
      applicationId: string;
      reason: string;
      notes?: string;
    }) => api.post(`/v1/admin/kyc/${applicationId}/reject`, { reason, notes }),
    onSuccess: () => invalidateKycCaches(queryClient),
  });
}

// ── Request additional documents ─────────────────────────────────────────────

export function useRequestAdditionalDocs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      requiredDocuments,
      message,
    }: {
      applicationId: string;
      /** Document slot codes the applicant must resubmit, e.g. ["ID_FRONT", "SELFIE"]. */
      requiredDocuments: string[];
      /** Optional plain-text message shown to the applicant. */
      message?: string;
    }) =>
      api.post(`/v1/admin/kyc/${applicationId}/request-docs`, {
        requiredDocuments,
        message,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kyc.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}
