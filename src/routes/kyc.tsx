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
import { useKycQueue, type KycApplicationRow } from "@/hooks/useKyc";

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
  const [sortBy, setSortBy] = useState<"submitted" | "name">("submitted");

  // Fetch real data from API
  const { data: apiData, isLoading } = useKycQueue({ limit: 100 });
  const applications: KycApplication[] = useMemo(
    () => (apiData?.applications ?? []).map(mapApiToLocal),
    [apiData],
  );

  const tab = allTabs.find((t) => t.key === activeTab)!;

  const rows = useMemo(() => {
    const base = applications.filter(tab.filter);
    if (sortBy === "name") return [...base].sort((a, b) => a.name.localeCompare(b.name));
    return [...base].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [activeTab, sortBy, applications]);

  return (
    <RoleShell activeLabel="KYC" eyebrow="Clients" title="KYC">
      <KycStats applications={applications} />

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border -mx-8 px-8">
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => {
            const Icon = t.icon;
            const count = applications.filter(t.filter).length;
            const isActive = t.key === activeTab;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13px] font-medium transition-colors shrink-0 ${
                  isActive ? "text-pine" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isActive ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
                {isActive && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
              </button>
            );
          })}
        </div>
        <FilterTabsDropdown activeTab={activeTab} setActiveTab={setActiveTab} sortBy={sortBy} setSortBy={setSortBy} applications={applications} />
        <div className="ml-auto flex items-center gap-2 py-2">
          <button className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/40">
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
                <button className="h-8 px-3 rounded-md border border-border hover:bg-muted/40">Previous</button>
                <button className="h-8 w-8 rounded-md bg-pine text-primary-foreground text-xs font-medium">1</button>
                <button className="h-8 w-8 rounded-md hover:bg-muted/40">2</button>
                <button className="h-8 px-3 rounded-md border border-border hover:bg-muted/40">Next</button>
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

const sortOptions: [string, string][] = [
  ["submitted", "Date Submitted"],
  ["name", "Name (A–Z)"],
];

function FilterTabsDropdown({
  activeTab,
  setActiveTab,
  sortBy,
  setSortBy,
  applications,
}: {
  activeTab: string;
  setActiveTab: (v: string) => void;
  sortBy: string;
  setSortBy: (v: any) => void;
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

  const activeFilterTab = filterTabs.find((t) => t.key === activeTab);
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
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[13rem] rounded-[3px] border border-border bg-card shadow-lg py-1 overflow-hidden">
          {filterTabs.map((t) => {
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
          <div className="my-1 border-t border-border" />
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sort by</div>
          {sortOptions.map(([v, l]) => (
            <button
              key={v}
              onClick={() => { setSortBy(v); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${v === sortBy ? "bg-pine/10 text-pine font-medium" : "text-foreground hover:bg-muted/50"}`}
            >
              {l}
            </button>
          ))}
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
        className="w-8 h-8 rounded-md hover:bg-muted/60 inline-flex items-center justify-center"
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

function ReviewPanel({
  app, onClose, onApprove, onReject,
}: {
  app: KycApplication; onClose: () => void; onApprove: () => void; onReject: () => void;
}) {
  const [docTab, setDocTab] = useState<"front" | "back" | "selfie">("front");
  const [actionTab, setActionTab] = useState<"checklist" | "ocr" | "notes">("checklist");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const steps = [
    { label: "Email verified", ok: true },
    { label: "Phone verified", ok: true },
    { label: "ID document uploaded", ok: true },
    { label: "OCR read successful", ok: app.ocrConfidence >= 70 },
    { label: "Face match passed", ok: app.faceMatchScore >= 75 },
    { label: "Liveness check passed", ok: app.livenessScore >= 75 },
    { label: "No flagged issues", ok: app.flags.length === 0 },
    ...(app.tierRequested === "tier2" ? [
      { label: "Proof of address uploaded", ok: app.tierRequested === "tier2" },
      { label: "Source of funds declared", ok: false },
    ] : []),
  ];

  const ocrFields = [
    { label: "Full name", value: app.name, match: true },
    { label: "Document type", value: docTypeLabel[app.docType], match: true },
    { label: "Document number", value: `MW${app.id.slice(-6).toUpperCase()}`, match: true },
    { label: "Date of birth", value: "12 Mar 1991", match: true },
    { label: "Expiry date", value: "08 Oct 2028", match: app.ocrConfidence >= 80 },
    { label: "Nationality", value: "Malawian", match: true },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <Initials name={app.name} />
              <div>
                <div className="font-semibold">{app.name}</div>
                <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                  {app.id} · {app.userId}
                  <button className="hover:text-foreground"><Copy className="w-3 h-3" /></button>
                </div>
              </div>
              <KycStatusBadge status={app.status} />
              <TierBadge tier={app.tierRequested} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onReject}
              className="h-9 px-4 rounded-lg border border-rose/30 text-rose text-sm hover:bg-rose/10 flex items-center gap-1.5 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
            <button className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5 transition-colors">
              <FilePlus className="w-3.5 h-3.5" /> Request docs
            </button>
            <button
              onClick={onApprove}
              className="h-9 px-4 rounded-lg bg-pine text-primary-foreground text-sm hover:bg-pine/90 flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Approve
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground ml-1">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left: document viewer */}
          <div className="w-80 shrink-0 border-r border-border flex flex-col">
            {/* Doc tabs */}
            <div className="flex items-center gap-0 border-b border-border px-4 pt-1 shrink-0">
              {(["front", "back", "selfie"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDocTab(t)}
                  className={`relative py-2.5 px-3 text-xs font-medium capitalize transition-colors ${
                    docTab === t ? "text-pine" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "selfie" ? "Selfie" : t === "front" ? "Front" : "Back"}
                  {docTab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
                </button>
              ))}
            </div>

            {/* Document placeholder */}
            <div className="flex-1 bg-muted/30 flex flex-col items-center justify-center gap-3 p-4 min-h-0">
              <div className="w-full aspect-[3/2] rounded-xl border-2 border-dashed border-border bg-card flex flex-col items-center justify-center gap-2 relative overflow-hidden">
                {docTab === "selfie" ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">Selfie photo</span>
                  </>
                ) : (
                  <>
                    <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="w-16 h-10 rounded border-2 border-muted-foreground/30 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                      <span className="text-xs text-muted-foreground">{docTypeLabel[app.docType]} · {docTab}</span>
                    </div>
                  </>
                )}
                {/* Scan overlay lines */}
                {docTab !== "selfie" && (
                  <div className="absolute inset-3 border border-pine/20 rounded-lg pointer-events-none">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-pine/50 rounded-tl" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-pine/50 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-pine/50 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-pine/50 rounded-br" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5" /> Zoom
                </button>
                <button className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5" /> Rotate
                </button>
                <button className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </button>
              </div>
            </div>

            {/* Scores */}
            <div className="shrink-0 border-t border-border p-4 space-y-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Verification Scores</div>
              <ScoreRow label="OCR Confidence" value={app.ocrConfidence} icon={ScanLine} />
              <ScoreRow label="Face Match" value={app.faceMatchScore} icon={Camera} />
              <ScoreRow label="Liveness" value={app.livenessScore} icon={Fingerprint} />
            </div>
          </div>

          {/* Right: details panel */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Applicant meta */}
            <div className="shrink-0 grid grid-cols-2 gap-x-6 gap-y-2 px-6 py-4 border-b border-border text-sm">
              <MetaRow icon={Phone} label="Phone" value={app.phone} />
              <MetaRow icon={MapPin} label="City" value={app.city} />
              <MetaRow icon={Calendar} label="Submitted" value={fmtDate(app.submittedAt)} />
              {app.reviewedAt && <MetaRow icon={CheckCircle2} label="Reviewed" value={fmtDate(app.reviewedAt)} />}
              {app.reviewer && <MetaRow icon={User} label="Reviewer" value={app.reviewer} />}
              <MetaRow icon={FileText} label="Document" value={docTypeLabel[app.docType]} />
            </div>

            {/* Flags */}
            {app.flags.length > 0 && (
              <div className="shrink-0 flex flex-wrap gap-2 px-6 py-3 border-b border-border">
                {app.flags.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber/10 text-amber">
                    <AlertTriangle className="w-3 h-3" /> {f}
                  </span>
                ))}
              </div>
            )}

            {/* Sub-tabs */}
            <div className="shrink-0 flex items-center gap-0.5 border-b border-border px-6">
              {(["checklist", "ocr", "notes"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActionTab(t)}
                  className={`relative py-2.5 px-3 text-xs font-medium capitalize transition-colors ${
                    actionTab === t ? "text-pine" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "ocr" ? "OCR Data" : t.charAt(0).toUpperCase() + t.slice(1)}
                  {actionTab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
                </button>
              ))}
            </div>

            {/* Sub-tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-thin-gray">
              {actionTab === "checklist" && (
                <ul className="space-y-2">
                  {steps.map((s, i) => (
                    <li key={i} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                      {s.ok
                        ? <CheckCircle2 className="w-4 h-4 text-pine shrink-0" />
                        : <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className={`text-sm ${s.ok ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                      {s.ok
                        ? <span className="ml-auto text-[11px] text-pine font-medium">Pass</span>
                        : <span className="ml-auto text-[11px] text-muted-foreground">Pending</span>}
                    </li>
                  ))}
                </ul>
              )}
              {actionTab === "ocr" && (
                <div className="space-y-0">
                  {ocrFields.map((f) => (
                    <div key={f.label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">{f.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{f.value}</span>
                        {f.match
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-pine" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-amber" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {actionTab === "notes" && (
                <div className="space-y-3">
                  {app.notes && (
                    <div className="rounded-lg bg-muted/40 border border-border p-3 text-sm text-muted-foreground">
                      {app.notes}
                    </div>
                  )}
                  <textarea
                    className="w-full h-28 rounded-lg border border-border bg-muted/30 p-3 text-sm resize-none focus:outline-none focus:border-pine/40 placeholder:text-muted-foreground"
                    placeholder="Add internal review notes…"
                  />
                  <button className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/40">
                    Save note
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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

