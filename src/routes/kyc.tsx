import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, FileText,
  Eye, MoreHorizontal, ChevronDown, AlertTriangle, User,
  Camera, ScanLine, ClipboardList, FilePlus,
  TrendingUp, TrendingDown, Copy, Phone, MapPin, Calendar,
  Download, Fingerprint, ZoomIn, RotateCw, ExternalLink,
} from "lucide-react";
import { AdminShell, Card } from "@/components/admin-shell";
import { RoleShell } from "@/components/role-shell";
import { useKycQueue, useKycApplication, useApproveKyc, useRejectKyc, type KycApplicationRow } from "@/hooks/useKyc";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [
      { title: "KYC — Pine Broker Admin" },
      { name: "description", content: "Review, approve and manage KYC verification submissions." },
    ],
  }),
  component: KycPage,
});

/* ─────────────────────────── types ─────────────────────────── */

type KycStatus = "pending" | "approved" | "rejected" | "additional_docs" | "manual";
type DocType = "national_id" | "passport" | "drivers_license";
type TierRequested = "tier1" | "tier2";

type KycApplication = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string;
  city: string;
  docType: DocType;
  tierRequested: TierRequested;
  status: KycStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewer?: string;
  ocrConfidence: number;
  faceMatchScore: number;
  livenessScore: number;
  flags: string[];
  notes?: string;
};

/* ─────────────────────────── map API → local type ─────────────────────────── */

function mapApiToLocal(app: KycApplicationRow): KycApplication {
  const statusMap: Record<string, KycStatus> = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    NOT_SUBMITTED: "pending",
  };
  const docMap: Record<string, DocType> = {
    NATIONAL_ID: "national_id",
    PASSPORT: "passport",
    DRIVERS_LICENSE: "drivers_license",
  };

  return {
    id: app.id,
    userId: app.userId,
    name: app.userName || "Unknown",
    email: app.userEmail,
    phone: app.userPhone || "",
    city: app.city || "",
    docType: docMap[app.documentType ?? ""] ?? "national_id",
    tierRequested: "tier1",
    status: statusMap[app.status] ?? "pending",
    submittedAt: app.submittedAt,
    reviewedAt: app.reviewedAt ?? undefined,
    ocrConfidence: app.ocrConfidence ?? 0,
    faceMatchScore: app.facialMatchScore ?? 0,
    livenessScore: 0,
    flags: [],
  };
}

/* ─────────────────────────── helpers ─────────────────────────── */

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const docTypeLabel: Record<DocType, string> = {
  national_id: "National ID",
  passport: "Passport",
  drivers_license: "Driver's License",
};

/* ─────────────────────────── tabs ─────────────────────────── */

type Tab = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; filter: (a: KycApplication) => boolean };

const tabs: Tab[] = [
  { key: "all", label: "All", icon: ClipboardList, filter: () => true },
];

const filterTabs: Tab[] = [
  { key: "manual", label: "Manual Review", icon: Eye, filter: (a) => a.status === "manual" },
  { key: "approved", label: "Approved", icon: CheckCircle2, filter: (a) => a.status === "approved" },
  { key: "rejected", label: "Rejected", icon: XCircle, filter: (a) => a.status === "rejected" },
  { key: "additional", label: "Additional Docs", icon: FilePlus, filter: (a) => a.status === "additional_docs" },
  { key: "pending", label: "Pending Review", icon: Clock, filter: (a) => a.status === "pending" },
  { key: "ocr", label: "OCR Results", icon: ScanLine, filter: (a) => a.ocrConfidence < 85 },
];

const allTabs: Tab[] = [...tabs, ...filterTabs];

/* ─────────────────────────── page ─────────────────────────── */

function KycPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [selected, setSelected] = useState<KycApplication | null>(null);

  // Fetch real data from API
  const { data: apiData, isLoading } = useKycQueue({ limit: 100 });
  const applications: KycApplication[] = useMemo(
    () => (apiData?.applications ?? []).map(mapApiToLocal),
    [apiData],
  );

  const tab = allTabs.find((t) => t.key === activeTab)!;

  const rows = useMemo(() => {
    const base = applications.filter(tab.filter);
    return [...base].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [activeTab, applications]);

  return (
    <RoleShell activeLabel="KYC" eyebrow="Clients" title="KYC">
      <KycStats applications={applications} />

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border -mx-8 px-8">
        <FilterTabsDropdown activeTab={activeTab} setActiveTab={setActiveTab} applications={applications} />
        <div className="ml-auto flex items-center gap-2 py-2">
          <button className="flex items-center gap-1.5 h-9 px-3 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* List */}
        <div className="flex-1 min-w-0">
          <Card className="!p-0 overflow-hidden">
            <KycTable rows={rows} onSelect={setSelected} showDetailColumns={activeTab === "all"} />

            <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
              <div>Showing <span className="text-foreground font-medium">{Math.min(rows.length, 25)}</span> of {rows.length}</div>
              <div className="flex items-center gap-1">
                <button className="h-8 px-3 rounded-[3px] border border-border hover:bg-muted/40">Previous</button>
                <button className="h-8 w-8 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium">1</button>
                <button className="h-8 w-8 rounded-[3px] hover:bg-muted/40">2</button>
                <button className="h-8 px-3 rounded-[3px] border border-border hover:bg-muted/40">Next</button>
              </div>
            </div>
          </Card>
        </div>

        {/* Inline review panel */}
        {selected && (
          <div
            className="w-[560px] shrink-0 rounded-[3px] bg-card border border-border overflow-hidden flex flex-col sticky top-4"
            style={{ maxHeight: "calc(100vh - 160px)" }}
          >
            <ReviewPanel
              app={selected}
              onClose={() => setSelected(null)}
              onApprove={() => setSelected(null)}
              onReject={() => setSelected(null)}
            />
          </div>
        )}
      </div>
    </RoleShell>
  );
}

/* ─────────────────────────── stats ─────────────────────────── */

function KycStats({ applications }: { applications: KycApplication[] }) {
  const total = applications.length;
  const pending = applications.filter((a) => a.status === "pending").length;
  const approved = applications.filter((a) => a.status === "approved").length;
  const rejected = applications.filter((a) => a.status === "rejected").length;
  const manual = applications.filter((a) => a.status === "manual").length;
  const additional = applications.filter((a) => a.status === "additional_docs").length;
  const avgScore = total > 0
    ? Math.round(applications.reduce((s, a) => s + a.ocrConfidence, 0) / total)
    : 0;

  const stats = [
    { label: "Pending Review", value: pending, icon: Clock, tone: pending > 0 ? "amber" : "pine", trend: pending > 0 ? "queue" : "clear", up: false },
    { label: "Approved", value: approved, icon: CheckCircle2, tone: "pine", trend: total > 0 ? `${Math.round((approved / total) * 100)}%` : "—", up: true },
    { label: "Rejected", value: rejected, icon: XCircle, tone: rejected > 0 ? "rose" : "pine", trend: total > 0 ? `${Math.round((rejected / total) * 100)}%` : "—", up: false },
    { label: "Manual Review", value: manual, icon: Eye, tone: manual > 0 ? "amber" : "pine", trend: manual > 0 ? "flagged" : "clear", up: false },
  ] as const;

  return (
    <div className="flex flex-wrap gap-4 pt-6">
      {stats.map((s) => {
        const Icon = s.icon;
        const Trend = s.up ? TrendingUp : TrendingDown;
        return (
          <div key={s.label} className="flex-1 min-w-[160px] rounded-[3px] bg-card border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 flex items-center justify-center">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${s.up ? "text-pine" : "text-amber"}`}>
                <Trend className="w-3 h-3" /> {s.trend}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-bold mt-0.5">{s.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── filter tabs dropdown ─────────────────────────── */

function FilterTabsDropdown({
  activeTab,
  setActiveTab,
  applications,
}: {
  activeTab: string;
  setActiveTab: (v: string) => void;
  applications: KycApplication[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const activeFilterTab = allTabs.find((t) => t.key === activeTab);
  const ButtonIcon = activeFilterTab?.icon ?? FileText;

  return (
    <div ref={ref} className="relative ml-0.5 shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13px] font-medium transition-colors ${
          activeFilterTab ? "text-pine" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ButtonIcon className="w-3.5 h-3.5" />
        {activeFilterTab ? activeFilterTab.label : "Filter"}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {activeFilterTab && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[13rem] rounded-[3px] border border-border bg-card shadow-lg py-1 overflow-hidden">
          {allTabs.map((t) => {
            const Icon = t.icon;
            const count = applications.filter(t.filter).length;
            const isActive = t.key === activeTab;
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-pine/10 text-pine font-medium" : "text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left">{t.label}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isActive ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── table ─────────────────────────── */

function KycTable({ rows, onSelect, showDetailColumns }: { rows: KycApplication[]; onSelect: (a: KycApplication) => void; showDetailColumns: boolean }) {
  const colCount = showDetailColumns ? 10 : 6;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <th className="pl-5 py-2.5 text-left font-medium w-10">#</th>
            <th className="py-2.5 text-left font-medium">Applicant</th>
            <th className="py-2.5 text-left font-medium">Document</th>
            <th className="py-2.5 text-left font-medium">Tier</th>
            <th className="py-2.5 text-left font-medium">Status</th>
            {showDetailColumns && (
              <>
                <th className="py-2.5 text-left font-medium">OCR</th>
                <th className="py-2.5 text-left font-medium">Face</th>
                <th className="py-2.5 text-left font-medium">Submitted</th>
                <th className="py-2.5 text-left font-medium">Flags</th>
              </>
            )}
            <th className="pr-5 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <KycRow key={r.id} app={r} idx={idx + 1} onSelect={onSelect} showDetailColumns={showDetailColumns} />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={colCount} className="py-16 text-center text-sm text-muted-foreground">
                No applications match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function KycRow({ app, idx, onSelect, showDetailColumns }: { app: KycApplication; idx: number; onSelect: (a: KycApplication) => void; showDetailColumns: boolean }) {
  return (
    <tr
      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onSelect(app)}
    >
      <td className="pl-5 py-3 text-[11px] text-muted-foreground font-mono">{idx}</td>
      <td className="py-3">
        <div className="flex items-center gap-2.5">
          <Initials name={app.name} />
          <div className="font-medium text-[13px]">{app.name}</div>
        </div>
      </td>
      <td className="py-3 text-[12px] text-muted-foreground">{docTypeLabel[app.docType]}</td>
      <td className="py-3">
        <TierBadge tier={app.tierRequested} />
      </td>
      <td className="py-3">
        <KycStatusBadge status={app.status} />
      </td>
      {showDetailColumns && (
        <>
          <td className="py-3">
            <ScoreBar value={app.ocrConfidence} />
          </td>
          <td className="py-3">
            <ScoreBar value={app.faceMatchScore} />
          </td>
          <td className="py-3 text-[12px] text-muted-foreground whitespace-nowrap">{relativeTime(app.submittedAt)}</td>
          <td className="py-3">
            {app.flags.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber font-medium">
                <AlertTriangle className="w-3 h-3" /> {app.flags.length}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">—</span>
            )}
          </td>
        </>
      )}
      <td className="pr-5 py-3" onClick={(e) => e.stopPropagation()}>
        <RowMenu onReview={() => onSelect(app)} />
      </td>
    </tr>
  );
}

function Initials({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((s) => s[0]).join("");
  return (
    <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
      {initials}
    </div>
  );
}

function TierBadge({ tier }: { tier: TierRequested }) {
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-foreground">
      {tier === "tier2" ? "Tier 2" : "Tier 1"}
    </span>
  );
}

function KycStatusBadge({ status }: { status: KycStatus }) {
  const map: Record<KycStatus, { cls: string; dot: string; label: string }> = {
    pending: { cls: "bg-amber/10 text-amber", dot: "bg-amber", label: "Pending" },
    approved: { cls: "bg-pine/10 text-pine", dot: "bg-pine", label: "Approved" },
    rejected: { cls: "bg-rose/10 text-rose", dot: "bg-rose", label: "Rejected" },
    additional_docs: { cls: "bg-amber/10 text-amber", dot: "bg-amber", label: "Awaiting Docs" },
    manual: { cls: "bg-muted text-foreground", dot: "bg-muted-foreground", label: "Manual Review" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
}

function ScoreBar({ value }: { value: number }) {
  const color = value >= 85 ? "bg-pine" : value >= 70 ? "bg-amber" : "bg-rose";
  const textColor = value >= 85 ? "text-pine" : value >= 70 ? "text-amber" : "text-rose";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-[11px] font-medium tabular-nums ${textColor}`}>{value}%</span>
    </div>
  );
}

/* ─────────────────────────── row menu ─────────────────────────── */

function RowMenu({ onReview }: { onReview: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const items = [
    { label: "Review", icon: Eye, action: onReview },
    { label: "Approve", icon: CheckCircle2, action: () => {} },
    { label: "Request docs", icon: FilePlus, action: () => {} },
    { label: "Reject", icon: XCircle, tone: "rose" as const, action: () => {} },
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-[3px] hover:bg-muted/60 inline-flex items-center justify-center"
      >
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-[3px] border border-border bg-card shadow-lg py-1 overflow-hidden">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.label}
                onClick={() => { it.action(); setOpen(false); }}
                className={`w-full text-left px-3.5 py-2 text-sm flex items-center gap-2.5 transition-colors ${
                  it.tone === "rose"
                    ? "text-rose hover:bg-rose/10"
                    : "text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-muted-foreground" /> {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── review modal ─────────────────────────── */

type ReviewDoc = { id: string; type: string; imageUrl: string | null; mimeType: string };

function ReviewPanel({
  app, onClose, onApprove, onReject,
}: {
  app: KycApplication; onClose: () => void; onApprove: () => void; onReject: () => void;
}) {
  const [docTab, setDocTab] = useState<"front" | "back" | "selfie">("front");
  const [infoTab, setInfoTab] = useState<"checklist" | "ocr" | "notes">("checklist");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  // Fetch full review data with document image URLs
  const { data: reviewData } = useKycApplication(app.id);
  const approveMutation = useApproveKyc();
  const rejectMutation = useRejectKyc();

  // Extract document URLs from review data
  const docs: ReviewDoc[] = useMemo(() => {
    const raw = (reviewData as any)?.documents ?? [];
    return raw.map((d: any) => ({
      id: d.id,
      type: d.type,
      imageUrl: d.imageUrl ?? null,
      mimeType: d.mimeType ?? 'image/jpeg',
    }));
  }, [reviewData]);

  const idDoc = docs.find((d: ReviewDoc) => d.type === 'ID_FRONT' || d.type === 'NATIONAL_ID');
  const selfieDoc = docs.find((d: ReviewDoc) => d.type === 'SELFIE');

  const currentDocUrl = docTab === "selfie" ? selfieDoc?.imageUrl : idDoc?.imageUrl;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleApprove = () => {
    approveMutation.mutate(
      { applicationId: app.id, notes: reviewNotes || undefined },
      { onSuccess: () => { setShowApproveConfirm(false); onApprove(); } },
    );
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    rejectMutation.mutate(
      { applicationId: app.id, reason: rejectReason, notes: reviewNotes || undefined },
      { onSuccess: () => { setShowRejectDialog(false); onReject(); } },
    );
  };

  const steps = [
    { label: "Email verified", ok: true },
    { label: "Phone verified", ok: true },
    { label: "ID document uploaded", ok: !!idDoc },
    { label: "Selfie uploaded", ok: !!selfieDoc },
    { label: "OCR read successful", ok: app.ocrConfidence >= 70 },
    { label: "Face match passed", ok: app.faceMatchScore >= 75 },
    { label: "No flagged issues", ok: app.flags.length === 0 },
  ];

  // Extract OCR data from review response
  const ocrData = (reviewData as any)?.application?.ocrExtractedData ?? {};
  const ocrFields = [
    { label: "Full name", value: ocrData.fullName ?? app.name, match: true },
    { label: "Document type", value: docTypeLabel[app.docType], match: true },
    ...(ocrData.nationalId ? [{ label: "National ID", value: ocrData.nationalId, match: true }] : []),
    ...(ocrData.dateOfBirth ? [{ label: "Date of birth", value: ocrData.dateOfBirth, match: true }] : []),
  ];

  const passCount = steps.filter((s) => s.ok).length;
  const allPass = passCount === steps.length;
  const hasIssues = app.flags.length > 0;
  const isAlreadyReviewed = app.status === "approved" || app.status === "rejected";

  const scoreColor = (v: number) => v >= 85 ? "text-pine" : v >= 70 ? "text-amber" : "text-rose";
  const scoreBarColor = (v: number) => v >= 85 ? "bg-pine" : v >= 70 ? "bg-amber" : "bg-rose";

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Section 1: Identity ── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
        <Initials name={app.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm leading-none">{app.name}</span>
            <KycStatusBadge status={app.status} />
            <TierBadge tier={app.tierRequested} />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {docTypeLabel[app.docType]}
            {app.phone && <span className="mx-1.5 opacity-40">·</span>}
            {app.phone && <span>{app.phone}</span>}
            {app.city && <span className="mx-1.5 opacity-40">·</span>}
            {app.city && <span>{app.city}</span>}
            <span className="mx-1.5 opacity-40">·</span>
            <span>Submitted {relativeTime(app.submittedAt)}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-[3px] hover:bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0 transition-colors"
          aria-label="Close"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* ── Section 2: Risk signals strip ── */}
      <div className={`flex items-center gap-5 px-5 py-2 border-b shrink-0 ${hasIssues ? "bg-amber/5 border-amber/20" : "border-border bg-muted/10"}`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Signals</span>

        <div className="flex items-center gap-1.5">
          <ScanLine className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">OCR</span>
          <div className="w-14 h-1 bg-muted rounded-full overflow-hidden mx-0.5">
            <div className={`h-full ${scoreBarColor(app.ocrConfidence)} rounded-full`} style={{ width: `${app.ocrConfidence}%` }} />
          </div>
          <span className={`text-xs font-semibold tabular-nums ${scoreColor(app.ocrConfidence)}`}>{app.ocrConfidence}%</span>
        </div>

        <span className="text-border text-xs">·</span>

        <div className="flex items-center gap-1.5">
          <Camera className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Face</span>
          <div className="w-14 h-1 bg-muted rounded-full overflow-hidden mx-0.5">
            <div className={`h-full ${scoreBarColor(app.faceMatchScore)} rounded-full`} style={{ width: `${app.faceMatchScore}%` }} />
          </div>
          <span className={`text-xs font-semibold tabular-nums ${scoreColor(app.faceMatchScore)}`}>{app.faceMatchScore}%</span>
        </div>

        {app.flags.length > 0 && (
          <>
            <span className="text-border text-xs">·</span>
            {app.flags.map((f) => (
              <span key={f} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber/10 text-amber">
                <AlertTriangle className="w-3 h-3" /> {f}
              </span>
            ))}
          </>
        )}

        <div className={`ml-auto text-[11px] font-medium shrink-0 ${allPass ? "text-pine" : "text-muted-foreground"}`}>
          {passCount}/{steps.length} checks
        </div>
      </div>

      {/* ── Section 3: Document + Info ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: Document viewer */}
        <div className="w-72 shrink-0 border-r border-border flex flex-col">
          <div className="flex border-b border-border px-3 pt-0.5 shrink-0">
            {(["front", "selfie"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDocTab(t)}
                className={`relative py-2.5 px-3 text-xs font-medium transition-colors ${
                  docTab === t ? "text-pine" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "front" ? "ID Document" : "Selfie"}
                {docTab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-muted/20 flex flex-col gap-3 p-4 min-h-0 overflow-hidden">
            <div className="w-full aspect-[3/2] rounded-md border border-border bg-card flex flex-col items-center justify-center gap-2 relative overflow-hidden shrink-0">
              {currentDocUrl ? (
                <img
                  src={currentDocUrl}
                  alt={docTab === "selfie" ? "Selfie" : "ID Document"}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  {docTab === "selfie" ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground">Selfie not available</span>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-9 rounded border-2 border-muted-foreground/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-muted-foreground/40" />
                      </div>
                      <span className="text-xs text-muted-foreground">ID not available</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {currentDocUrl && (
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={currentDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 px-2.5 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Open full size
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right: Checklist / OCR / Notes */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex border-b border-border px-5 shrink-0">
            {(["checklist", "ocr", "notes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setInfoTab(t)}
                className={`relative py-2.5 px-3 text-xs font-medium transition-colors ${
                  infoTab === t ? "text-pine" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "checklist"
                  ? `Checklist · ${passCount}/${steps.length}`
                  : t === "ocr"
                  ? "OCR Data"
                  : "Notes"}
                {infoTab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {infoTab === "checklist" && (
              <ul className="divide-y divide-border px-5">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    {s.ok
                      ? <CheckCircle2 className="w-4 h-4 text-pine shrink-0" />
                      : <XCircle className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
                    <span className={`text-sm flex-1 ${s.ok ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                    <span className={`text-[11px] font-medium shrink-0 ${s.ok ? "text-pine" : "text-muted-foreground"}`}>
                      {s.ok ? "Pass" : "–"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {infoTab === "ocr" && (
              <div className="px-5">
                {ocrFields.map((f) => (
                  <div key={f.label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{f.value}</span>
                      {f.match
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-pine" />
                        : <AlertTriangle className="w-3.5 h-3.5 text-amber" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {infoTab === "notes" && (
              <div className="p-5 space-y-3">
                {app.notes && (
                  <div className="rounded-[3px] bg-muted/30 border border-border p-3 text-sm text-muted-foreground">
                    {app.notes}
                  </div>
                )}
                <textarea
                  className="w-full h-28 rounded-[3px] border border-border bg-transparent p-3 text-sm resize-none focus:outline-none focus:border-pine/50 placeholder:text-muted-foreground/50"
                  placeholder="Add internal review notes…"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 4: Decision footer ── */}
      {!isAlreadyReviewed ? (
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-background shrink-0">
          <div className="flex-1" />
          <button
            onClick={() => setShowRejectDialog(true)}
            disabled={rejectMutation.isPending}
            className="h-8 px-4 rounded-[3px] border border-rose/30 text-rose text-xs font-medium hover:bg-rose/8 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
          <button
            onClick={() => setShowApproveConfirm(true)}
            disabled={approveMutation.isPending}
            className="h-8 px-4 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Approve
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-border bg-muted/20 shrink-0">
          <span className="text-xs text-muted-foreground">
            This application has been {app.status === "approved" ? "approved" : "rejected"}.
          </span>
        </div>
      )}

      {/* ── Approve confirmation dialog ── */}
      {showApproveConfirm && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowApproveConfirm(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-1">Approve KYC Application</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Approve <strong>{app.name}</strong>'s identity verification? This will allow them to trade on the platform.
            </p>
            {approveMutation.isError && (
              <div className="mb-3 text-xs text-rose bg-rose/10 rounded px-3 py-2">
                Failed to approve: {(approveMutation.error as Error)?.message ?? 'Unknown error'}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApproveConfirm(false)}
                className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="h-8 px-4 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5 disabled:opacity-50"
              >
                {approveMutation.isPending ? "Approving…" : "Confirm Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject dialog with reason ── */}
      {showRejectDialog && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowRejectDialog(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-1">Reject KYC Application</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Reject <strong>{app.name}</strong>'s identity verification. A reason is required.
            </p>
            <textarea
              className="w-full h-20 rounded-[3px] border border-border bg-transparent p-3 text-sm resize-none focus:outline-none focus:border-rose/50 placeholder:text-muted-foreground/50 mb-3"
              placeholder="Reason for rejection (required)…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              autoFocus
            />
            {rejectMutation.isError && (
              <div className="mb-3 text-xs text-rose bg-rose/10 rounded px-3 py-2">
                Failed to reject: {(rejectMutation.error as Error)?.message ?? 'Unknown error'}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectDialog(false)}
                className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="h-8 px-4 rounded-[3px] bg-rose text-white text-xs font-medium hover:bg-rose/90 flex items-center gap-1.5 disabled:opacity-50"
              >
                {rejectMutation.isPending ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ScoreRow({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  const color = value >= 85 ? "bg-pine" : value >= 70 ? "bg-amber" : "bg-rose";
  const textColor = value >= 85 ? "text-pine" : value >= 70 ? "text-amber" : "text-rose";
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-[11px] font-semibold tabular-nums w-8 text-right ${textColor}`}>{value}%</span>
    </div>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground text-xs w-20 shrink-0">{label}</span>
      <span className="font-medium text-xs truncate">{value}</span>
    </div>
  );
}

