/**
 * Document slots a broker can ask an applicant to resubmit. The `value` is the
 * slot code the backend's `POST /admin/kyc/:id/request-docs` expects in
 * `requiredDocuments`. Shared by the KYC queue's row dialog and the full-page
 * review so both offer exactly the same options.
 */
export const DOC_REQUEST_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "ID_FRONT",         label: "ID / Passport front" },
  { value: "ID_BACK",          label: "ID / Passport back" },
  { value: "SELFIE",           label: "Selfie / Liveness video" },
  { value: "PROOF_OF_ADDRESS", label: "Proof of address" },
];
