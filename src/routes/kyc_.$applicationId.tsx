import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ShieldCheck, XCircle, AlertTriangle, User, FileText, ExternalLink,
  Loader2, Download, BadgeCheck, ScanLine, Camera, Pencil, Save,
  RotateCcw, FilePlus,
} from "lucide-react";
import {
  Breadcrumb, Panel, Ring, Field, DocRow, InitialsAvatar, LoadingBlock,
} from "@/components/detail-kit";
import {
  useKycApplication, useApproveKyc, useRejectKyc, useRequestAdditionalDocs,
  useCsdData, useSaveCsdData, downloadCsdForm,
  type KycDocument, type CsdFieldValues, type FieldSource, type ReconciledField, type ReconciledIdentity,
} from "@/hooks/useKyc";

export const Route = createFileRoute("/kyc_/$applicationId")({
  head: () => ({ meta: [{ title: "KYC Review — Pine Broker Admin" }] }),
  component: KycReviewPage,
});

/* document slot groupings */
const ID_FRONT_TYPES = new Set(["ID_FRONT", "NATIONAL_ID", "PASSPORT", "PASSPORT_FRONT", "DRIVERS_LICENSE_FRONT"]);
const ID_BACK_TYPES  = new Set(["ID_BACK", "NATIONAL_ID_BACK", "PASSPORT_BACK", "DRIVERS_LICENSE_BACK"]);
const SELFIE_TYPES   = new Set(["SELFIE", "LIVENESS"]);
const ADDRESS_TYPES  = new Set(["PROOF_OF_RESIDENCE", "UTILITY_BILL", "BANK_STATEMENT", "ADDRESS_PROOF"]);

const DOC_LABEL: Record<string, string> = {
  ID_FRONT: "ID (front)", NATIONAL_ID: "National ID", PASSPORT: "Passport", PASSPORT_FRONT: "Passport (front)",
  DRIVERS_LICENSE_FRONT: "Licence (front)", ID_BACK: "ID (back)", NATIONAL_ID_BACK: "National ID (back)",
  PASSPORT_BACK: "Passport (back)", DRIVERS_LICENSE_BACK: "Licence (back)",
  SELFIE: "Selfie", LIVENESS: "Liveness selfie",
  PROOF_OF_RESIDENCE: "Proof of residence", UTILITY_BILL: "Utility bill", BANK_STATEMENT: "Bank statement", ADDRESS_PROOF: "Address proof",
};

const scoreVar = (v: number) => (v >= 85 ? "var(--pine)" : v >= 70 ? "var(--amber)" : "var(--rose)");

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SOURCE_LABEL: Record<FieldSource, string> = {
  registration: "Registration", mrz: "MRZ verified", ocr: "OCR", reconciled: "Verified", override: "Edited", none: "—",
};
const SOURCE_STYLE: Record<FieldSource, string> = {
  registration: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  mrz: "bg-pine/10 text-pine", ocr: "bg-muted text-muted-foreground",
  reconciled: "bg-pine/10 text-pine", override: "bg-amber/10 text-amber", none: "bg-muted text-muted-foreground",
};

/* ── The single, definitive account-details form ──
 * Groups every value the applicant entered at registration (resolved into the
 * CSD form fields), annotated with provenance from the OCR/MRZ reconciliation
 * so the broker can compare against the documents on the left and edit gaps. */
const FORM_GROUPS: Array<{ title: string; fields: Array<{ key: keyof CsdFieldValues; label: string; wide?: boolean; recon?: keyof ReconciledIdentity }> }> = [
  {
    title: "Identity",
    fields: [
      { key: "fullName", label: "Full name", wide: true, recon: "fullName" },
      { key: "gender", label: "Gender", recon: "gender" },
      { key: "dateOfBirth", label: "Date of birth", recon: "dateOfBirth" },
      { key: "nationality", label: "Nationality", recon: "nationality" },
      { key: "idType", label: "ID type" },
      { key: "idNumber", label: "ID number", recon: "documentNumber" },
    ],
  },
  {
    title: "Contact",
    fields: [
      { key: "email", label: "Email", wide: true, recon: "email" },
      { key: "cellphone", label: "Cellphone", recon: "phone" },
      { key: "telephone", label: "Telephone" },
    ],
  },
  {
    title: "Address",
    fields: [
      { key: "physicalAddress", label: "Physical address", wide: true },
      { key: "postalAddress", label: "Postal address", wide: true },
    ],
  },
  {
    title: "Investor & banking",
    fields: [
      { key: "investorType", label: "Investor type" },
      { key: "bankName", label: "Bank name" },
      { key: "bankBranchCode", label: "Bank branch code" },
      { key: "accountNumber", label: "Account number" },
      { key: "accountName", label: "Account name", wide: true },
    ],
  },
];

function KycReviewPage() {
  const { applicationId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useKycApplication(applicationId);
  const approveMutation = useApproveKyc();
  const rejectMutation = useRejectKyc();
  const requestDocsMutation = useRequestAdditionalDocs();

  const [docTab, setDocTab] = useState<"front" | "back" | "selfie" | "address">("front");
  const [reviewNotes, setReviewNotes] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showApprove, setShowApprove] = useState(false);
  const [showRequestDocs, setShowRequestDocs] = useState(false);
  const [docsMessage, setDocsMessage] = useState("");

  const app = data?.application;
  const docs: KycDocument[] = useMemo(() => data?.documents ?? [], [data]);
  const reconciled = app?.reconciled ?? null;

  const idDoc = docs.find((d) => ID_FRONT_TYPES.has(d.type));
  const backDoc = docs.find((d) => ID_BACK_TYPES.has(d.type));
  const selfieDoc = docs.find((d) => SELFIE_TYPES.has(d.type));
  const addressDoc = docs.find((d) => ADDRESS_TYPES.has(d.type));
  const currentDocUrl =
    docTab === "selfie" ? selfieDoc?.imageUrl :
    docTab === "back" ? backDoc?.imageUrl :
    docTab === "address" ? addressDoc?.imageUrl :
    idDoc?.imageUrl;

  const status = (app?.status ?? "PENDING").toUpperCase();
  // A decision is only final when a HUMAN made it — the AI pipeline
  // auto-approves/rejects with no reviewer, and brokers can override that.
  const isReviewed =
    (status === "APPROVED" || status === "REJECTED") && !!app?.reviewerName;
  const mrz = app?.mrz ?? null;

  useEffect(() => { if (app?.reviewNotes) setReviewNotes(app.reviewNotes); }, [app?.reviewNotes]);

  const goBack = () => navigate({ to: "/kyc" });
  const handleApprove = () => approveMutation.mutate({ applicationId, notes: reviewNotes.trim() || undefined }, { onSuccess: () => { setShowApprove(false); goBack(); } });
  const handleReject = () => { if (!rejectReason.trim()) return; rejectMutation.mutate({ applicationId, reason: rejectReason.trim(), notes: reviewNotes.trim() || undefined }, { onSuccess: () => { setShowReject(false); goBack(); } }); };
  const handleRequestDocs = () => requestDocsMutation.mutate({ applicationId, requiredDocuments: [], message: docsMessage.trim() || undefined }, { onSuccess: () => { setShowRequestDocs(false); goBack(); } });

  if (isLoading) return <div className="max-w-[1400px] mx-auto"><LoadingBlock /></div>;
  if (isError || !app) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <AlertTriangle className="w-8 h-8 text-amber mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-4">Failed to load this KYC application.</p>
        <button onClick={goBack} className="text-sm text-pine underline underline-offset-2">Back to queue</button>
      </div>
    );
  }

  const applicantName = app.registration?.fullName || app.userName || "Applicant";
  // Liveness gauge removed — the mobile app no longer runs the head-turn
  // liveness capture, so the score would always read 0.
  const scores = [
    { icon: <ScanLine className="w-4 h-4" />, label: "OCR confidence", value: app.ocrConfidence ?? 0 },
    { icon: <Camera className="w-4 h-4" />, label: "Face match", value: app.facialMatchScore ?? 0 },
  ];

  const docTabs = ([
    ["front", "ID Front", !!idDoc],
    ["back", "ID Back", !!backDoc],
    ["selfie", "Selfie", !!selfieDoc],
    ["address", "Address", !!addressDoc],
  ] as const).filter(([, , has]) => has);

  return (
    <div className="max-w-[1400px] mx-auto pb-24">
      <Breadcrumb items={[{ label: "Dashboard", to: "/" }, { label: "KYC", to: "/kyc" }, { label: applicantName }]} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={goBack} className="w-9 h-9 rounded-[4px] border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <InitialsAvatar name={applicantName} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold truncate">{applicantName}</h1>
            <StatusBadge status={status} />
            {mrz?.found && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${mrz.checkDigitScore === 100 ? "bg-pine/10 text-pine" : "bg-amber/10 text-amber"}`}>
                <BadgeCheck className="w-3 h-3" /> MRZ {mrz.checkDigitScore === 100 ? "verified" : `${mrz.checkDigitScore}%`}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submitted {relativeTime(app.submittedAt)}{app.reviewerName && <> · Reviewed by {app.reviewerName}</>}
          </p>
        </div>
      </div>

      {/* Score rings */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {scores.map((s) => (
          <div key={s.label} className="rounded-[6px] bg-card border border-border p-4 flex items-center gap-4">
            <Ring value={s.value} max={100} size={72} stroke={7} color={scoreVar(s.value)}
              centerMain={<span className="text-sm">{s.value}%</span>} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-muted-foreground">{s.icon}<span className="text-xs">{s.label}</span></div>
              <div className="text-[11px] mt-1 font-medium" style={{ color: scoreVar(s.value) }}>
                {s.value >= 85 ? "Strong" : s.value >= 70 ? "Acceptable" : "Needs review"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-5 items-start">
        {/* ── LEFT: documents (sticky for side-by-side comparison) ── */}
        <div className="lg:sticky lg:top-4 flex flex-col gap-4">
          <section className="rounded-[6px] bg-card border border-border overflow-hidden">
            <div className="flex border-b border-border px-2 overflow-x-auto">
              {docTabs.length === 0 && <span className="px-3 py-2.5 text-xs text-muted-foreground">No documents</span>}
              {docTabs.map(([t, label]) => (
                <button key={t} onClick={() => setDocTab(t as typeof docTab)}
                  className={`relative py-2.5 px-3 text-xs font-medium whitespace-nowrap transition-colors ${docTab === t ? "text-pine" : "text-muted-foreground hover:text-foreground"}`}>
                  {label}
                  {docTab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
                </button>
              ))}
            </div>
            <div className="p-4">
              <div className="w-full aspect-[3/4] rounded-md border border-border bg-muted/20 flex items-center justify-center overflow-hidden">
                {currentDocUrl ? (
                  <img src={currentDocUrl} alt={docTab} className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {docTab === "selfie" ? <User className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
                    <span className="text-xs">Not uploaded</span>
                  </div>
                )}
              </div>
              {currentDocUrl && (
                <a href={currentDocUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 h-8 px-2.5 rounded-[4px] border border-border text-xs text-muted-foreground hover:bg-muted/40 inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open full size
                </a>
              )}
            </div>
          </section>

          <Panel title="All documents" subtitle={docs.length ? `${docs.length} uploaded` : undefined}>
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No documents uploaded.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((d) => (
                  <DocRow key={d.id} name={DOC_LABEL[d.type] ?? d.type.replace(/_/g, " ")}
                    thumbUrl={d.imageUrl} downloadUrl={d.imageUrl}
                    onView={d.imageUrl ? () => window.open(d.imageUrl!, "_blank") : undefined} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ── RIGHT: one definitive account form + notes ── */}
        <div className="flex flex-col gap-5 min-w-0">
          <AccountForm applicationId={applicationId} reconciled={reconciled} addressConfidence={app.address?.confidence ?? null} />

          <Panel title="Reviewer notes">
            <textarea
              className="w-full h-24 rounded-[4px] border border-border bg-transparent p-3 text-sm resize-none focus:outline-none focus:border-pine/50 placeholder:text-muted-foreground/50"
              placeholder="Add internal review notes…" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
            />
          </Panel>
        </div>
      </div>

      {/* Sticky decision bar */}
      {!isReviewed && (
        <div className="sticky bottom-0 mt-5 flex items-center gap-2 px-4 py-3 rounded-[6px] border border-border bg-card/95 backdrop-blur shadow-lg">
          <button onClick={() => setShowRequestDocs(true)} className="h-9 px-3 rounded-[4px] border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5">
            <FilePlus className="w-3.5 h-3.5" /> Request docs
          </button>
          <div className="flex-1" />
          <button onClick={() => setShowReject(true)} className="h-9 px-4 rounded-[4px] border border-rose/30 text-rose text-xs font-medium hover:bg-rose/8 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
          <button onClick={() => setShowApprove(true)} className="h-9 px-4 rounded-[4px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Approve
          </button>
        </div>
      )}

      {/* Dialogs */}
      {showApprove && (
        <Dialog title="Approve application" onClose={() => setShowApprove(false)}>
          <p className="text-xs text-muted-foreground mb-4">Approve <strong>{applicantName}</strong>'s identity verification? This lets them trade on the platform.</p>
          <DialogActions onCancel={() => setShowApprove(false)} confirmLabel="Confirm approve" confirmIcon={<ShieldCheck className="w-3.5 h-3.5" />}
            confirmClass="bg-pine text-primary-foreground hover:bg-pine/90" pending={approveMutation.isPending} onConfirm={handleApprove} />
        </Dialog>
      )}
      {showReject && (
        <Dialog title="Reject application" onClose={() => setShowReject(false)}>
          <p className="text-xs text-muted-foreground mb-2">Reason (shown to the applicant):</p>
          <textarea className="w-full h-20 rounded-[4px] border border-border bg-transparent p-2.5 text-sm resize-none focus:outline-none focus:border-rose/50 mb-3"
            placeholder="e.g. ID photo is blurry — please re-upload" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogActions onCancel={() => setShowReject(false)} confirmLabel="Confirm reject" confirmIcon={<XCircle className="w-3.5 h-3.5" />}
            confirmClass="bg-rose text-white hover:bg-rose/90" confirmDisabled={!rejectReason.trim()} pending={rejectMutation.isPending} onConfirm={handleReject} />
        </Dialog>
      )}
      {showRequestDocs && (
        <Dialog title="Request additional documents" onClose={() => setShowRequestDocs(false)}>
          <p className="text-xs text-muted-foreground mb-2">Message to the applicant (optional):</p>
          <textarea className="w-full h-20 rounded-[4px] border border-border bg-transparent p-2.5 text-sm resize-none focus:outline-none focus:border-pine/50 mb-3"
            placeholder="e.g. Please upload a clearer photo of the ID back" value={docsMessage} onChange={(e) => setDocsMessage(e.target.value)} />
          <DialogActions onCancel={() => setShowRequestDocs(false)} confirmLabel="Send request" confirmIcon={<FilePlus className="w-3.5 h-3.5" />}
            confirmClass="bg-pine text-primary-foreground hover:bg-pine/90" pending={requestDocsMutation.isPending} onConfirm={handleRequestDocs} />
        </Dialog>
      )}
    </div>
  );
}

/* ── The consolidated, editable account-details form ── */
function AccountForm({
  applicationId, reconciled, addressConfidence,
}: { applicationId: string; reconciled: ReconciledIdentity | null; addressConfidence: number | null }) {
  const { data, isLoading } = useCsdData(applicationId);
  const saveMutation = useSaveCsdData(applicationId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CsdFieldValues | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fields = data?.fields ?? null;
  const startEdit = () => { setDraft(fields ? { ...fields } : null); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(null); };
  const save = () => { if (draft) saveMutation.mutate(draft, { onSuccess: () => { setEditing(false); setDraft(null); } }); };
  const download = async () => { setDownloading(true); try { await downloadCsdForm(applicationId); } finally { setDownloading(false); } };

  const reconField = (key?: keyof ReconciledIdentity): ReconciledField | null => {
    if (!key || !reconciled) return null;
    const f = reconciled[key];
    return f && typeof f === "object" && "source" in f ? (f as ReconciledField) : null;
  };

  return (
    <Panel
      title="Account details"
      subtitle="Everything the applicant submitted — verified against their documents. Edit to correct gaps before download."
      action={
        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <>
              <button onClick={startEdit} className="h-8 px-2.5 rounded-[4px] border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button onClick={download} disabled={downloading} className="h-8 px-2.5 rounded-[4px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5 disabled:opacity-50">
                {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Download PDF
              </button>
            </>
          ) : (
            <>
              <button onClick={cancelEdit} className="h-8 px-2.5 rounded-[4px] border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3" /> Cancel
              </button>
              <button onClick={save} disabled={saveMutation.isPending} className="h-8 px-2.5 rounded-[4px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5 disabled:opacity-50">
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
              </button>
            </>
          )}
        </div>
      }
    >
      {reconciled && reconciled.mismatchFlags.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-[4px] border border-amber/25 bg-amber/5 px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0 mt-0.5" />
          <span className="text-xs text-muted-foreground">
            Document conflicts with registration on <strong>{reconciled.mismatchFlags.join(", ")}</strong>. Registered values are shown (trusted) — review the document and edit if needed.
          </span>
        </div>
      )}

      {isLoading || !fields ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {FORM_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 pb-1.5 border-b border-border">{group.title}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                {group.fields.map(({ key, label, wide, recon }) => {
                  const value = (editing ? draft?.[key] : fields[key]) ?? "";
                  const rf = reconField(recon);
                  const badge = rf && rf.value ? (
                    <span className="flex items-center gap-1">
                      {rf.matchesRegistration === false && <AlertTriangle className="w-3 h-3 text-amber" />}
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${SOURCE_STYLE[rf.source]}`}>{SOURCE_LABEL[rf.source]}</span>
                    </span>
                  ) : undefined;
                  return (
                    <div key={key} className={wide ? "sm:col-span-2" : ""}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                        {badge}
                        {key === "physicalAddress" && typeof addressConfidence === "number" && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{addressConfidence}% extracted</span>
                        )}
                      </div>
                      {editing ? (
                        <input
                          className="w-full h-9 rounded-[4px] border border-border bg-transparent px-2.5 text-sm focus:outline-none focus:border-pine/50"
                          value={value as string}
                          onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
                        />
                      ) : (
                        <div className="min-h-[36px] rounded-[4px] bg-muted/20 px-2.5 py-2 text-sm font-medium break-words">
                          {value ? String(value) : <span className="text-muted-foreground/50">—</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {saveMutation.isError && <p className="mt-3 text-xs text-rose">Failed to save changes. Please try again.</p>}
    </Panel>
  );
}

/* ── sub-components ── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber/10 text-amber", APPROVED: "bg-pine/10 text-pine", REJECTED: "bg-rose/10 text-rose",
    MANUAL_REVIEW: "bg-blue-500/10 text-blue-600 dark:text-blue-400", ADDITIONAL_DOCS: "bg-muted text-muted-foreground",
  };
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[status] ?? "bg-muted text-muted-foreground"}`}>{label}</span>;
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[6px] bg-card border border-border p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function DialogActions({
  onCancel, onConfirm, confirmLabel, confirmIcon, confirmClass, confirmDisabled, pending,
}: {
  onCancel: () => void; onConfirm: () => void; confirmLabel: string;
  confirmIcon: React.ReactNode; confirmClass: string; confirmDisabled?: boolean; pending?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="h-8 px-3 rounded-[4px] border border-border text-xs text-muted-foreground hover:bg-muted/40">Cancel</button>
      <button onClick={onConfirm} disabled={confirmDisabled || pending}
        className={`h-8 px-4 rounded-[4px] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 ${confirmClass}`}>
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : confirmIcon} {confirmLabel}
      </button>
    </div>
  );
}
