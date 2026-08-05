import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ShieldCheck, XCircle, CheckCircle2, AlertTriangle, User,
  FileText, ExternalLink, Loader2, Download, MapPin, BadgeCheck, FilePlus,
  ScanLine, Camera, Fingerprint, Pencil, Save, RotateCcw, Mail, Phone, Calendar,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import {
  useKycApplication, useApproveKyc, useRejectKyc, useRequestAdditionalDocs,
  useCsdData, useSaveCsdData, downloadCsdForm,
  type KycDocument, type ReconciledField, type CsdFieldValues, type FieldSource,
} from "@/hooks/useKyc";

export const Route = createFileRoute("/kyc_/$applicationId")({
  head: () => ({ meta: [{ title: "KYC Review — Pine Broker Admin" }] }),
  component: KycReviewPage,
});

/* ── document slot groupings ── */
const ID_FRONT_TYPES = new Set(["ID_FRONT", "NATIONAL_ID", "PASSPORT", "PASSPORT_FRONT", "DRIVERS_LICENSE_FRONT"]);
const ID_BACK_TYPES  = new Set(["ID_BACK", "NATIONAL_ID_BACK", "PASSPORT_BACK", "DRIVERS_LICENSE_BACK"]);
const SELFIE_TYPES   = new Set(["SELFIE", "LIVENESS"]);
const ADDRESS_TYPES  = new Set(["PROOF_OF_RESIDENCE", "UTILITY_BILL", "BANK_STATEMENT", "ADDRESS_PROOF"]);

const scoreColor    = (v: number) => (v >= 85 ? "text-pine" : v >= 70 ? "text-amber" : "text-rose");
const scoreBarColor = (v: number) => (v >= 85 ? "bg-pine" : v >= 70 ? "bg-amber" : "bg-rose");

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* CSD field labels + ordering for the editable form */
const CSD_FIELDS: Array<{ key: keyof CsdFieldValues; label: string; wide?: boolean }> = [
  { key: "fullName", label: "Full name", wide: true },
  { key: "gender", label: "Gender" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "idType", label: "ID type" },
  { key: "idNumber", label: "ID number" },
  { key: "nationality", label: "Nationality" },
  { key: "investorType", label: "Investor type" },
  { key: "physicalAddress", label: "Physical address", wide: true },
  { key: "postalAddress", label: "Postal address", wide: true },
  { key: "telephone", label: "Telephone" },
  { key: "cellphone", label: "Cellphone" },
  { key: "email", label: "Email", wide: true },
  { key: "bankName", label: "Bank name" },
  { key: "bankBranchCode", label: "Bank branch code" },
  { key: "accountNumber", label: "Account number" },
  { key: "accountName", label: "Account name", wide: true },
];

const SOURCE_LABEL: Record<FieldSource, string> = {
  registration: "Registration",
  mrz: "MRZ verified",
  ocr: "OCR",
  reconciled: "Verified",
  override: "Edited",
  none: "—",
};
const SOURCE_STYLE: Record<FieldSource, string> = {
  registration: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  mrz: "bg-pine/10 text-pine",
  ocr: "bg-muted text-muted-foreground",
  reconciled: "bg-pine/10 text-pine",
  override: "bg-amber/10 text-amber",
  none: "bg-muted text-muted-foreground",
};

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
  const registration = app?.registration ?? null;

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
  const isReviewed = status === "APPROVED" || status === "REJECTED";
  const ocrPct = app?.ocrConfidence ?? 0;
  const facePct = app?.facialMatchScore ?? 0;
  const livePct = app?.livenessScore ?? 0;
  const mrz = app?.mrz ?? null;

  useEffect(() => {
    if (app?.reviewNotes) setReviewNotes(app.reviewNotes);
  }, [app?.reviewNotes]);

  const goBack = () => navigate({ to: "/kyc" });

  const handleApprove = () => {
    approveMutation.mutate(
      { applicationId, notes: reviewNotes.trim() || undefined },
      { onSuccess: () => { setShowApprove(false); goBack(); } },
    );
  };
  const handleReject = () => {
    if (!rejectReason.trim()) return;
    rejectMutation.mutate(
      { applicationId, reason: rejectReason.trim(), notes: reviewNotes.trim() || undefined },
      { onSuccess: () => { setShowReject(false); goBack(); } },
    );
  };
  const handleRequestDocs = () => {
    requestDocsMutation.mutate(
      { applicationId, requiredDocuments: [], message: docsMessage.trim() || undefined },
      { onSuccess: () => { setShowRequestDocs(false); goBack(); } },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !app) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <AlertTriangle className="w-8 h-8 text-amber mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-4">Failed to load this KYC application.</p>
        <button onClick={goBack} className="text-sm text-pine underline underline-offset-2">Back to queue</button>
      </div>
    );
  }

  const applicantName = registration?.fullName || app.userName || "Applicant";

  return (
    <div className="max-w-[1400px] mx-auto pb-16">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-[3px] border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
          aria-label="Back to queue"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
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
            Submitted {relativeTime(app.submittedAt)}
            {app.reviewerName && <> · Reviewed by {app.reviewerName}</>}
          </p>
        </div>
        <button
          onClick={() => downloadCsdForm(applicationId)}
          className="h-9 px-3 rounded-[3px] border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> CSD form
        </button>
      </div>

      {/* ── Score signals ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <ScoreCard icon={<ScanLine className="w-4 h-4" />} label="OCR confidence" value={ocrPct} />
        <ScoreCard icon={<Camera className="w-4 h-4" />} label="Face match" value={facePct} />
        <ScoreCard icon={<Fingerprint className="w-4 h-4" />} label="Liveness" value={livePct} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-5 items-start">
        {/* ── Left: documents ── */}
        <Card className="p-0 overflow-hidden">
          <div className="flex border-b border-border px-2">
            {([
              ["front", "ID Front", !!idDoc],
              ["back", "ID Back", !!backDoc],
              ["selfie", "Selfie", !!selfieDoc],
              ["address", "Address", !!addressDoc],
            ] as const).filter(([, , has]) => has).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setDocTab(t as typeof docTab)}
                className={`relative py-2.5 px-3 text-xs font-medium transition-colors ${docTab === t ? "text-pine" : "text-muted-foreground hover:text-foreground"}`}
              >
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
              <a
                href={currentDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 h-8 px-2.5 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 inline-flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Open full size
              </a>
            )}
          </div>
        </Card>

        {/* ── Right: info ── */}
        <div className="flex flex-col gap-5 min-w-0">
          {/* Verified identity */}
          <Card className="p-5">
            <SectionHeader icon={<ShieldCheck className="w-4 h-4" />} title="Verified identity" hint="OCR/MRZ reconciled against registration" />
            {reconciled ? (
              <>
                {reconciled.mismatchFlags.length > 0 && (
                  <div className="mb-3 flex items-start gap-2 rounded-[3px] border border-amber/25 bg-amber/5 px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground">
                      Extraction conflicts with registration on: <strong>{reconciled.mismatchFlags.join(", ")}</strong>. Registered values are shown (trusted); review the document.
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  <IdentityRow label="Full name" f={reconciled.fullName} />
                  <IdentityRow label="Date of birth" f={reconciled.dateOfBirth} />
                  <IdentityRow label="Gender" f={reconciled.gender} render={(v) => (v === "M" ? "Male" : v === "F" ? "Female" : v)} />
                  <IdentityRow label="National ID" f={reconciled.nationalId} />
                  <IdentityRow label="Document no." f={reconciled.documentNumber} />
                  <IdentityRow label="Expiry date" f={reconciled.expiryDate} />
                  <IdentityRow label="Nationality" f={reconciled.nationality} />
                  <IdentityRow label="Email" f={reconciled.email} />
                  <IdentityRow label="Phone" f={reconciled.phone} />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-4">No extraction data yet.</p>
            )}
          </Card>

          {/* Registration snapshot + address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="p-5">
              <SectionHeader icon={<User className="w-4 h-4" />} title="Registration details" hint="What the applicant entered" />
              <div className="space-y-2.5">
                <RegRow icon={<User className="w-3.5 h-3.5" />} label="Name" value={registration?.fullName} />
                <RegRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={registration?.email} verified={registration?.emailVerified} />
                <RegRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={registration?.phone} verified={registration?.phoneVerified} />
                <RegRow icon={<Calendar className="w-3.5 h-3.5" />} label="Date of birth" value={registration?.dateOfBirth ? new Date(registration.dateOfBirth).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null} />
                <RegRow icon={<User className="w-3.5 h-3.5" />} label="Gender" value={registration?.gender === "M" ? "Male" : registration?.gender === "F" ? "Female" : registration?.gender} />
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader icon={<MapPin className="w-4 h-4" />} title="Residential address" hint="From proof of residency" />
              {app.address?.formatted ? (
                <div>
                  <p className="text-sm font-medium leading-relaxed">{app.address.formatted}</p>
                  {(app.address.city || app.address.district) && (
                    <p className="text-xs text-muted-foreground mt-1">{[app.address.city, app.address.district].filter((v, i, a) => v && a.indexOf(v) === i).join(" · ")}</p>
                  )}
                  {typeof app.address.confidence === "number" && (
                    <span className="inline-block mt-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{app.address.confidence}% extracted</span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No address extracted.</p>
              )}
            </Card>
          </div>

          {/* Editable CSD form */}
          <CsdFormEditor applicationId={applicationId} />

          {/* Notes */}
          <Card className="p-5">
            <SectionHeader icon={<FileText className="w-4 h-4" />} title="Reviewer notes" />
            <textarea
              className="w-full h-24 rounded-[3px] border border-border bg-transparent p-3 text-sm resize-none focus:outline-none focus:border-pine/50 placeholder:text-muted-foreground/50"
              placeholder="Add internal review notes…"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
            />
          </Card>
        </div>
      </div>

      {/* ── Sticky decision bar ── */}
      {!isReviewed && (
        <div className="sticky bottom-0 mt-5 flex items-center gap-2 px-4 py-3 rounded-[3px] border border-border bg-card/95 backdrop-blur">
          <button onClick={() => setShowRequestDocs(true)} className="h-9 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5">
            <FilePlus className="w-3.5 h-3.5" /> Request docs
          </button>
          <div className="flex-1" />
          <button onClick={() => setShowReject(true)} className="h-9 px-4 rounded-[3px] border border-rose/30 text-rose text-xs font-medium hover:bg-rose/8 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
          <button onClick={() => setShowApprove(true)} className="h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Approve
          </button>
        </div>
      )}

      {/* ── Dialogs ── */}
      {showApprove && (
        <Dialog title="Approve application" onClose={() => setShowApprove(false)}>
          <p className="text-xs text-muted-foreground mb-4">Approve <strong>{applicantName}</strong>'s identity verification? This lets them trade on the platform.</p>
          <DialogActions
            onCancel={() => setShowApprove(false)}
            confirmLabel="Confirm approve"
            confirmIcon={<ShieldCheck className="w-3.5 h-3.5" />}
            confirmClass="bg-pine text-primary-foreground hover:bg-pine/90"
            pending={approveMutation.isPending}
            onConfirm={handleApprove}
          />
        </Dialog>
      )}
      {showReject && (
        <Dialog title="Reject application" onClose={() => setShowReject(false)}>
          <p className="text-xs text-muted-foreground mb-2">Reason (shown to the applicant):</p>
          <textarea
            className="w-full h-20 rounded-[3px] border border-border bg-transparent p-2.5 text-sm resize-none focus:outline-none focus:border-rose/50 mb-3"
            placeholder="e.g. ID photo is blurry — please re-upload"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogActions
            onCancel={() => setShowReject(false)}
            confirmLabel="Confirm reject"
            confirmIcon={<XCircle className="w-3.5 h-3.5" />}
            confirmClass="bg-rose text-white hover:bg-rose/90"
            confirmDisabled={!rejectReason.trim()}
            pending={rejectMutation.isPending}
            onConfirm={handleReject}
          />
        </Dialog>
      )}
      {showRequestDocs && (
        <Dialog title="Request additional documents" onClose={() => setShowRequestDocs(false)}>
          <p className="text-xs text-muted-foreground mb-2">Message to the applicant (optional):</p>
          <textarea
            className="w-full h-20 rounded-[3px] border border-border bg-transparent p-2.5 text-sm resize-none focus:outline-none focus:border-pine/50 mb-3"
            placeholder="e.g. Please upload a clearer photo of the ID back"
            value={docsMessage}
            onChange={(e) => setDocsMessage(e.target.value)}
          />
          <DialogActions
            onCancel={() => setShowRequestDocs(false)}
            confirmLabel="Send request"
            confirmIcon={<FilePlus className="w-3.5 h-3.5" />}
            confirmClass="bg-pine text-primary-foreground hover:bg-pine/90"
            pending={requestDocsMutation.isPending}
            onConfirm={handleRequestDocs}
          />
        </Dialog>
      )}
    </div>
  );
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber/10 text-amber",
    APPROVED: "bg-pine/10 text-pine",
    REJECTED: "bg-rose/10 text-rose",
    MANUAL_REVIEW: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    ADDITIONAL_DOCS: "bg-muted text-muted-foreground",
  };
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[status] ?? "bg-muted text-muted-foreground"}`}>{label}</span>;
}

function ScoreCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
        <span className={`ml-auto text-sm font-bold tabular-nums ${scoreColor(value)}`}>{value}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${scoreBarColor(value)}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </Card>
  );
}

function SectionHeader({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3.5">
      <span className="text-pine">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <span className="text-[11px] text-muted-foreground ml-1">· {hint}</span>}
    </div>
  );
}

function IdentityRow({ label, f, render }: { label: string; f: ReconciledField; render?: (v: string) => string }) {
  const shown = f.value ? (render ? render(f.value) : f.value) : "—";
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium truncate">{shown}</span>
        {f.matchesRegistration === false && (
          <AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0" />
        )}
        {f.value && (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${SOURCE_STYLE[f.source]}`}>
            {SOURCE_LABEL[f.source]}
          </span>
        )}
      </div>
    </div>
  );
}

function RegRow({ icon, label, value, verified }: { icon: React.ReactNode; label: string; value?: string | null; verified?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-sm font-medium truncate flex-1">{value || "—"}</span>
      {verified === true && <CheckCircle2 className="w-3.5 h-3.5 text-pine shrink-0" />}
      {verified === false && <span className="text-[10px] text-amber shrink-0">unverified</span>}
    </div>
  );
}

/* ── Editable CSD form (Task: broker overrides) ── */
function CsdFormEditor({ applicationId }: { applicationId: string }) {
  const { data, isLoading } = useCsdData(applicationId);
  const saveMutation = useSaveCsdData(applicationId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CsdFieldValues | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fields = data?.fields ?? null;
  const startEdit = () => { setDraft(fields ? { ...fields } : null); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(null); };
  const save = () => {
    if (!draft) return;
    saveMutation.mutate(draft, { onSuccess: () => { setEditing(false); setDraft(null); } });
  };
  const download = async () => {
    setDownloading(true);
    try { await downloadCsdForm(applicationId); } finally { setDownloading(false); }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3.5">
        <span className="text-pine"><FileText className="w-4 h-4" /></span>
        <h2 className="text-sm font-semibold">CSD Account Opening form</h2>
        <span className="text-[11px] text-muted-foreground ml-1">· editable before download</span>
        <div className="ml-auto flex items-center gap-2">
          {!editing ? (
            <>
              <button onClick={startEdit} className="h-8 px-2.5 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button onClick={download} disabled={downloading} className="h-8 px-2.5 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5 disabled:opacity-50">
                {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Download PDF
              </button>
            </>
          ) : (
            <>
              <button onClick={cancelEdit} className="h-8 px-2.5 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3" /> Cancel
              </button>
              <button onClick={save} disabled={saveMutation.isPending} className="h-8 px-2.5 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5 disabled:opacity-50">
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading || !fields ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
          {CSD_FIELDS.map(({ key, label, wide }) => {
            const value = (editing ? draft?.[key] : fields[key]) ?? "";
            return (
              <div key={key} className={wide ? "sm:col-span-2" : ""}>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</label>
                {editing ? (
                  <input
                    className="w-full h-9 rounded-[3px] border border-border bg-transparent px-2.5 text-sm focus:outline-none focus:border-pine/50"
                    value={value}
                    onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
                  />
                ) : (
                  <div className="min-h-[36px] rounded-[3px] bg-muted/20 px-2.5 py-2 text-sm font-medium break-words">
                    {value || <span className="text-muted-foreground/50">—</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {saveMutation.isError && (
        <p className="mt-3 text-xs text-rose">Failed to save changes. Please try again.</p>
      )}
    </Card>
  );
}

/* ── generic dialog ── */
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
      <button onClick={onCancel} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40">Cancel</button>
      <button
        onClick={onConfirm}
        disabled={confirmDisabled || pending}
        className={`h-8 px-4 rounded-[3px] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 ${confirmClass}`}
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : confirmIcon} {confirmLabel}
      </button>
    </div>
  );
}
