import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, FileText,
  Eye, MoreHorizontal, ChevronDown, AlertTriangle, User,
  Camera, ScanLine, ClipboardList, FilePlus,
  TrendingUp, TrendingDown, Download, Fingerprint, ExternalLink,
  RefreshCw, Loader2, MapPin, BadgeCheck,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import {
  useKycQueue, useKycApplication, useApproveKyc, useRejectKyc,
  useRequestAdditionalDocs, useKycCounts, downloadCsdForm,
  type KycApplicationRow, type KycDocument, type KycOcrData,
} from "@/hooks/useKyc";
import { useCurrentUser, isSuperAdmin } from "@/lib/auth";

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
  emailVerified: boolean | null;
  phoneVerified: boolean | null;
  /** Owning broker — shown to platform admins observing cross-broker. */
  brokerName: string | null;
};

/* ─────────────────────────── map API → local type ─────────────────────────── */

const STATUS_MAP: Record<string, KycStatus> = {
  PENDING:          "pending",
  NOT_SUBMITTED:    "pending",
  APPROVED:         "approved",
  REJECTED:         "rejected",
  ADDITIONAL_DOCS:  "additional_docs",
  AWAITING_DOCS:    "additional_docs",
  DOCS_REQUESTED:   "additional_docs",
  MANUAL_REVIEW:    "manual",
  MANUAL:           "manual",
  FLAGGED:          "manual",
};

const DOC_MAP: Record<string, DocType> = {
  NATIONAL_ID:      "national_id",
  PASSPORT:         "passport",
  DRIVERS_LICENSE:  "drivers_license",
};

function normaliseTier(tier: string | null | undefined): TierRequested {
  const t = (tier ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (t === "TIER2" || t === "2") return "tier2";
  return "tier1";
}

function mapApiToLocal(app: KycApplicationRow): KycApplication {
  return {
    id:             app.id,
    userId:         app.userId,
    name:           app.userName || "Unknown",
    email:          app.userEmail,
    phone:          app.userPhone || "",
    city:           app.city || "",
    docType:        DOC_MAP[app.documentType ?? ""] ?? "national_id",
    tierRequested:  normaliseTier(app.tier),
    status:         STATUS_MAP[app.status] ?? "pending",
    submittedAt:    app.submittedAt,
    reviewedAt:     app.reviewedAt ?? undefined,
    reviewer:       app.reviewerName ?? undefined,
    ocrConfidence:  app.ocrConfidence ?? 0,
    faceMatchScore: app.facialMatchScore ?? 0,
    livenessScore:  app.livenessScore ?? 0,
    flags:          app.riskFlags ?? [],
    notes:          app.reviewNotes ?? undefined,
    emailVerified:  app.emailVerified ?? null,
    phoneVerified:  app.phoneVerified ?? null,
    brokerName:     (app as any).brokerName ?? null,
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
  national_id:      "National ID",
  passport:         "Passport",
  drivers_license:  "Driver's License",
};

/* ─────────────────────────── tab configuration ─────────────────────────── */

type Tab = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** API status string to pass as ?status= filter. undefined = all. */
  apiStatus?: string;
  /** Client-side filter applied after the API call (for computed tabs like OCR). */
  clientFilter?: (a: KycApplication) => boolean;
};

const TABS: Tab[] = [
  { key: "all",        label: "All",              icon: ClipboardList },
  { key: "pending",    label: "Pending Review",   icon: Clock,         apiStatus: "PENDING" },
  { key: "manual",     label: "Manual Review",    icon: Eye,           apiStatus: "MANUAL_REVIEW" },
  { key: "additional", label: "Additional Docs",  icon: FilePlus,      apiStatus: "ADDITIONAL_DOCS" },
  { key: "approved",   label: "Approved",         icon: CheckCircle2,  apiStatus: "APPROVED" },
  { key: "rejected",   label: "Rejected",         icon: XCircle,       apiStatus: "REJECTED" },
  { key: "ocr",        label: "OCR Results",      icon: ScanLine,      clientFilter: (a) => a.ocrConfidence < 85 },
];

const LIMIT = 50;

/* ─────────────────────────── CSV export ─────────────────────────── */

function exportToCsv(rows: KycApplication[], label: string) {
  const headers = ["ID", "Name", "Email", "Phone", "City", "Document", "Tier", "Status",
    "OCR%", "Face%", "Liveness%", "Flags", "Submitted", "Reviewed At", "Reviewer"];
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csvRows = rows.map((r) => [
    r.id, r.name, r.email, r.phone, r.city,
    docTypeLabel[r.docType], r.tierRequested, r.status,
    r.ocrConfidence, r.faceMatchScore, r.livenessScore,
    r.flags.join("; "), fmtDate(r.submittedAt),
    r.reviewedAt ? fmtDate(r.reviewedAt) : "",
    r.reviewer ?? "",
  ].map(escape).join(","));

  const csv = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kyc-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─────────────────────────── page ─────────────────────────── */

function KycPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pending");
  const [page, setPage] = useState(1);
  const [requestDocsFor, setRequestDocsFor] = useState<KycApplication | null>(null);

  // Opening a review now navigates to a dedicated full-page review at
  // /kyc/$applicationId (was an inline side panel).
  const openReview = (app: KycApplication) =>
    navigate({ to: "/kyc/$applicationId", params: { applicationId: app.id } });

  const tab = TABS.find((t) => t.key === activeTab) ?? TABS[0];
  const { data: counts } = useKycCounts();

  const {
    data: apiData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useKycQueue({
    limit: LIMIT,
    page,
    status: tab.apiStatus,
  });

  const applications: KycApplication[] = useMemo(
    () => (apiData?.applications ?? []).map(mapApiToLocal),
    [apiData],
  );

  const rows = useMemo(() => {
    const base = tab.clientFilter ? applications.filter(tab.clientFilter) : applications;
    return [...base].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  }, [applications, tab]);

  const totalPages = apiData?.totalPages ?? (Math.ceil((apiData?.total ?? 0) / LIMIT) || 1);
  const totalCount = apiData?.total ?? rows.length;
  const startRow = (page - 1) * LIMIT + 1;
  const endRow = Math.min(page * LIMIT, totalCount);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setPage(1);
  };

  const handleApproveFromMenu = (app: KycApplication) => openReview(app);
  const handleRejectFromMenu  = (app: KycApplication) => openReview(app);

  return (
    <>
      <KycStats counts={counts} />

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border -mx-8 px-8">
        <FilterTabsDropdown
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          tabs={TABS}
          counts={counts}
        />
        <div className="ml-auto flex items-center gap-2 py-2">
          {isFetching && !isLoading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 h-9 px-3 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportToCsv(rows, activeTab)}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 h-9 px-3 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="mt-4 flex items-center gap-3 rounded-[3px] border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Failed to load KYC queue: {(error as Error)?.message ?? "Unknown error"}.{" "}
          </span>
          <button onClick={() => refetch()} className="ml-auto underline underline-offset-2 hover:no-underline shrink-0">
            Retry
          </button>
        </div>
      )}

      <div className="mt-4">
        {/* List */}
        <div className="flex-1 min-w-0">
          <Card className="!p-0 overflow-hidden">
            {isLoading ? (
              <KycTableSkeleton />
            ) : (
              <KycTable
                rows={rows}
                onSelect={openReview}
                onApprove={handleApproveFromMenu}
                onReject={handleRejectFromMenu}
                onRequestDocs={setRequestDocsFor}
                showDetailColumns={activeTab === "all"}
              />
            )}

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
              <div>
                {isLoading ? (
                  <span className="animate-pulse">Loading…</span>
                ) : totalCount === 0 ? (
                  "No results"
                ) : (
                  <>
                    Showing <span className="text-foreground font-medium">{startRow}–{endRow}</span>{" "}
                    of <span className="text-foreground font-medium">{totalCount}</span>
                  </>
                )}
              </div>
              {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Request additional docs modal (opened from either row menu or review panel) */}
      {requestDocsFor && (
        <RequestDocsDialog
          app={requestDocsFor}
          onClose={() => setRequestDocsFor(null)}
        />
      )}
    </>
  );
}

/* ─────────────────────────── pagination ─────────────────────────── */

function Pagination({ page, totalPages, onPageChange }: {
  page: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        className="h-8 px-3 rounded-[3px] border border-border hover:bg-muted/40 disabled:opacity-40"
      >
        Previous
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`h-8 w-8 rounded-[3px] text-xs font-medium ${
              p === page ? "bg-pine text-primary-foreground" : "hover:bg-muted/40"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
        className="h-8 px-3 rounded-[3px] border border-border hover:bg-muted/40 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

/* ─────────────────────────── stats ─────────────────────────── */

function KycStats({ counts }: { counts?: Record<string, number> }) {
  const pending    = counts?.PENDING ?? 0;
  const approved   = counts?.APPROVED ?? 0;
  const rejected   = counts?.REJECTED ?? 0;
  const manual     = counts?.MANUAL_REVIEW ?? 0;
  const total      = pending + approved + rejected + manual
    + (counts?.ADDITIONAL_DOCS ?? 0)
    + (counts?.NOT_SUBMITTED ?? 0);

  const stats = [
    {
      label: "Pending Review",
      value: pending,
      icon: Clock,
      tone: pending > 0 ? "amber" : "pine",
      trend: pending > 0 ? "queue" : "clear",
      up: false,
    },
    {
      label: "Approved",
      value: approved,
      icon: CheckCircle2,
      tone: "pine",
      trend: total > 0 ? `${Math.round((approved / total) * 100)}%` : "—",
      up: true,
    },
    {
      label: "Rejected",
      value: rejected,
      icon: XCircle,
      tone: rejected > 0 ? "rose" : "pine",
      trend: total > 0 ? `${Math.round((rejected / total) * 100)}%` : "—",
      up: false,
    },
    {
      label: "Manual Review",
      value: manual,
      icon: Eye,
      tone: manual > 0 ? "amber" : "pine",
      trend: manual > 0 ? "flagged" : "clear",
      up: false,
    },
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
  activeTab, setActiveTab, tabs, counts,
}: {
  activeTab: string;
  setActiveTab: (v: string) => void;
  tabs: Tab[];
  counts?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const activeFilterTab = tabs.find((t) => t.key === activeTab);
  const ButtonIcon = activeFilterTab?.icon ?? FileText;

  /** Map tab key → API status count */
  const statusCountMap: Record<string, string> = {
    all:        String((counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined) ?? "—"),
    pending:    String(counts?.PENDING    ?? "—"),
    manual:     String(counts?.MANUAL_REVIEW ?? "—"),
    additional: String(counts?.ADDITIONAL_DOCS ?? "—"),
    approved:   String(counts?.APPROVED   ?? "—"),
    rejected:   String(counts?.REJECTED   ?? "—"),
    ocr:        "—",
  };

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
          {tabs.map((t) => {
            const Icon = t.icon;
            const count = statusCountMap[t.key] ?? "—";
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
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  isActive ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"
                }`}>
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

/* ─────────────────────────── table skeleton ─────────────────────────── */

function KycTableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
          <div className="w-6 h-3 rounded bg-muted" />
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
            <div className="w-32 h-3 rounded bg-muted" />
          </div>
          <div className="w-20 h-3 rounded bg-muted" />
          <div className="w-12 h-5 rounded bg-muted" />
          <div className="w-16 h-5 rounded-full bg-muted" />
          <div className="ml-auto w-6 h-6 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── table ─────────────────────────── */

function KycTable({
  rows, onSelect, onApprove, onReject, onRequestDocs, showDetailColumns,
}: {
  rows: KycApplication[];
  onSelect: (a: KycApplication) => void;
  onApprove: (a: KycApplication) => void;
  onReject: (a: KycApplication) => void;
  onRequestDocs: (a: KycApplication) => void;
  showDetailColumns: boolean;
}) {
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
            <KycRow
              key={r.id}
              app={r}
              idx={idx + 1}
              onSelect={onSelect}
              onApprove={onApprove}
              onReject={onReject}
              onRequestDocs={onRequestDocs}
              showDetailColumns={showDetailColumns}
            />
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

function KycRow({
  app, idx, onSelect, onApprove, onReject, onRequestDocs, showDetailColumns,
}: {
  app: KycApplication;
  idx: number;
  onSelect: (a: KycApplication) => void;
  onApprove: (a: KycApplication) => void;
  onReject: (a: KycApplication) => void;
  onRequestDocs: (a: KycApplication) => void;
  showDetailColumns: boolean;
}) {
  return (
    <tr
      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onSelect(app)}
    >
      <td className="pl-5 py-3 text-[11px] text-muted-foreground font-mono">{idx}</td>
      <td className="py-3">
        <div className="flex items-center gap-2.5">
          <Initials name={app.name} />
          <div>
            <div className="font-medium text-[13px]">{app.name}</div>
            {app.brokerName && (
              <div className="text-[10px] text-muted-foreground">{app.brokerName}</div>
            )}
          </div>
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
          <td className="py-3"><ScoreBar value={app.ocrConfidence} /></td>
          <td className="py-3"><ScoreBar value={app.faceMatchScore} /></td>
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
        <RowMenu
          app={app}
          onReview={() => onSelect(app)}
          onApprove={() => onApprove(app)}
          onReject={() => onReject(app)}
          onRequestDocs={() => onRequestDocs(app)}
        />
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
    pending:         { cls: "bg-amber/10 text-amber",   dot: "bg-amber",             label: "Pending" },
    approved:        { cls: "bg-pine/10 text-pine",     dot: "bg-pine",              label: "Approved" },
    rejected:        { cls: "bg-rose/10 text-rose",     dot: "bg-rose",              label: "Rejected" },
    additional_docs: { cls: "bg-amber/10 text-amber",   dot: "bg-amber",             label: "Awaiting Docs" },
    manual:          { cls: "bg-muted text-foreground", dot: "bg-muted-foreground",  label: "Manual Review" },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
}

function ScoreBar({ value }: { value: number }) {
  const color     = value >= 85 ? "bg-pine"  : value >= 70 ? "bg-amber"  : "bg-rose";
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

function RowMenu({
  app, onReview, onApprove, onReject, onRequestDocs,
}: {
  app: KycApplication;
  onReview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestDocs: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // A decision is final only when a HUMAN made it (reviewer set) — the AI
  // pipeline auto-approves/rejects with no reviewer, and brokers can override.
  const isReviewed = (app.status === "approved" || app.status === "rejected") && !!app.reviewer;

  const items = [
    { label: "Review",        icon: Eye,          action: onReview,      show: true },
    { label: "Approve",       icon: CheckCircle2, action: onApprove,     show: !isReviewed },
    { label: "Request docs",  icon: FilePlus,     action: onRequestDocs, show: !isReviewed },
    { label: "Reject",        icon: XCircle,      tone: "rose" as const, action: onReject, show: !isReviewed },
  ].filter((it) => it.show);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-[3px] hover:bg-muted/60 inline-flex items-center justify-center"
      >
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <PopoverMenu anchorRef={btnRef} align="right" onClose={() => setOpen(false)}>
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
        </PopoverMenu>
      )}
    </>
  );
}

/**
 * Portal-rendered dropdown, fixed-positioned from the trigger's bounding
 * rect. RowMenu lives inside a table wrapped in `overflow-x-auto` +
 * `overflow-hidden` (for the card's rounded corners) — an absolutely
 * positioned menu there gets silently clipped on rows near the bottom/edge
 * of that scroll area. Rendering to `document.body` with `position: fixed`
 * escapes all ancestor clipping and stays correctly placed regardless of
 * table scroll.
 */
function PopoverMenu({
  anchorRef, align = "right", onClose, children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: "left" | "right";
  onClose: () => void;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos(
        align === "right"
          ? { top: rect.bottom + 6, right: window.innerWidth - rect.right }
          : { top: rect.bottom + 6, left: rect.left },
      );
    };
    place();
    // Reposition (or close, for scroll) so the menu never drifts from its
    // trigger if the page scrolls/resizes while it's open.
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [anchorRef, align, onClose]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [anchorRef, onClose]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-44 rounded-[3px] border border-border bg-card shadow-lg py-1 overflow-hidden"
      style={{ top: pos.top, left: pos.left, right: pos.right }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ─────────────────────────── request docs dialog ─────────────────────────── */

const DOC_REQUEST_OPTIONS = [
  { value: "ID_FRONT",         label: "ID / Passport front" },
  { value: "ID_BACK",          label: "ID / Passport back" },
  { value: "SELFIE",           label: "Selfie / Liveness video" },
  { value: "PROOF_OF_ADDRESS", label: "Proof of address" },
];

function RequestDocsDialog({ app, onClose }: { app: KycApplication; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message,  setMessage]  = useState("");
  const requestDocsMutation = useRequestAdditionalDocs();

  const toggle = (val: string) =>
    setSelected((s) => s.includes(val) ? s.filter((v) => v !== val) : [...s, val]);

  const handleSubmit = () => {
    if (selected.length === 0) return;
    requestDocsMutation.mutate(
      { applicationId: app.id, requiredDocuments: selected, message: message.trim() || undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg p-6 w-[420px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-sm mb-1">Request Additional Documents</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Select the documents <strong>{app.name}</strong> must resubmit to continue verification.
        </p>

        <div className="space-y-2 mb-4">
          {DOC_REQUEST_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="w-4 h-4 rounded accent-pine"
              />
              <span className="text-sm group-hover:text-foreground transition-colors">{opt.label}</span>
            </label>
          ))}
        </div>

        <textarea
          className="w-full h-20 rounded-[3px] border border-border bg-transparent p-3 text-sm resize-none focus:outline-none focus:border-pine/50 placeholder:text-muted-foreground/50 mb-3"
          placeholder="Optional message to the applicant…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        {requestDocsMutation.isError && (
          <div className="mb-3 text-xs text-rose bg-rose/10 rounded px-3 py-2">
            Failed: {(requestDocsMutation.error as Error)?.message ?? "Unknown error"}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={requestDocsMutation.isPending || selected.length === 0}
            className="h-8 px-4 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5 disabled:opacity-50"
          >
            {requestDocsMutation.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
            ) : (
              <><FilePlus className="w-3.5 h-3.5" /> Send Request</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── review panel ─────────────────────────── */

/** Document slot types that represent the front-facing ID document. */
const ID_FRONT_TYPES  = new Set(["ID_FRONT", "NATIONAL_ID", "PASSPORT", "PASSPORT_FRONT", "DRIVERS_LICENSE_FRONT"]);
const ID_BACK_TYPES   = new Set(["ID_BACK", "NATIONAL_ID_BACK", "PASSPORT_BACK", "DRIVERS_LICENSE_BACK"]);
const SELFIE_TYPES    = new Set(["SELFIE", "LIVENESS"]);
const ADDRESS_TYPES   = new Set(["PROOF_OF_RESIDENCE", "UTILITY_BILL", "BANK_STATEMENT", "ADDRESS_PROOF"]);

function ReviewPanel({
  app, onClose, onApprove, onReject, onRequestDocs,
}: {
  app: KycApplication;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestDocs: () => void;
}) {
  const [docTab,             setDocTab]             = useState<"front" | "back" | "selfie" | "address">("front");
  const [infoTab,            setInfoTab]            = useState<"checklist" | "ocr" | "notes">("checklist");
  const [showRejectDialog,   setShowRejectDialog]   = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [rejectReason,       setRejectReason]       = useState("");
  const [reviewNotes,        setReviewNotes]        = useState(app.notes ?? "");

  // Fetch full detail including document image URLs + OCR data
  const {
    data: reviewData,
    isLoading: isDetailLoading,
    isError: isDetailError,
  } = useKycApplication(app.id);

  const approveMutation = useApproveKyc();
  const rejectMutation  = useRejectKyc();
  // Platform admins observe — KYC decisions belong to the owning broker
  // (the backend rejects them with 403 anyway; don't show dead buttons).
  const superAdmin = isSuperAdmin(useCurrentUser());

  // CSD Securities Account Opening form (server-generated, pre-filled PDF)
  const [csdDownloading, setCsdDownloading] = useState(false);
  const handleCsdDownload = async () => {
    setCsdDownloading(true);
    try {
      await downloadCsdForm(app.id);
    } catch {
      // Non-fatal — keep the panel usable; the button simply re-enables
    } finally {
      setCsdDownloading(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Extract and type documents from review data
  const docs: KycDocument[] = useMemo(
    () => reviewData?.documents ?? [],
    [reviewData],
  );

  const idDoc      = docs.find((d) => ID_FRONT_TYPES.has(d.type));
  const backDoc    = docs.find((d) => ID_BACK_TYPES.has(d.type));
  const selfieDoc  = docs.find((d) => SELFIE_TYPES.has(d.type));
  const addressDoc = docs.find((d) => ADDRESS_TYPES.has(d.type));
  const hasBack    = !!backDoc;
  const hasAddress = !!addressDoc;

  const currentDocUrl =
    docTab === "selfie"   ? selfieDoc?.imageUrl :
    docTab === "back"     ? backDoc?.imageUrl    :
    docTab === "address"  ? addressDoc?.imageUrl :
    idDoc?.imageUrl;

  // OCR data — from detail endpoint; fall back gracefully
  const ocrData: Partial<KycOcrData> = reviewData?.application?.ocrExtractedData ?? {};
  const fieldConf = reviewData?.application?.ocrFieldConfidences ?? {};
  const mrz = reviewData?.application?.mrz ?? null;
  const extractedAddress = reviewData?.application?.address ?? null;

  /** Compare name from OCR with the user's registered name (case-insensitive). */
  const nameMatch = !ocrData.fullName ||
    ocrData.fullName.trim().toLowerCase() === app.name.trim().toLowerCase();

  const genderLabel =
    ocrData.gender === "M" ? "Male" : ocrData.gender === "F" ? "Female" : ocrData.gender;

  const ocrFields = [
    { label: "Full name",       value: ocrData.fullName       ?? app.name,          match: nameMatch, conf: fieldConf.fullName },
    { label: "Document type",   value: docTypeLabel[app.docType],                   match: true },
    ...(ocrData.nationalId      ? [{ label: "National ID",      value: ocrData.nationalId,      match: true, conf: fieldConf.nationalIdNumber }] : []),
    ...(ocrData.documentNumber && ocrData.documentNumber !== ocrData.nationalId
                                ? [{ label: "Document no.",     value: ocrData.documentNumber,  match: true, conf: fieldConf.documentNumber }] : []),
    ...(ocrData.dateOfBirth     ? [{ label: "Date of birth",    value: ocrData.dateOfBirth,     match: true, conf: fieldConf.dateOfBirth }] : []),
    ...(genderLabel             ? [{ label: "Gender",           value: genderLabel,             match: true, conf: fieldConf.gender }] : []),
    ...(ocrData.expiryDate      ? [{ label: "Expiry date",      value: ocrData.expiryDate,      match: true, conf: fieldConf.expiryDate }] : []),
    ...(ocrData.nationality     ? [{ label: "Nationality",      value: ocrData.nationality,     match: true, conf: fieldConf.nationality }] : []),
    ...(ocrData.address         ? [{ label: "Place of origin",  value: ocrData.address,         match: true }] : []),
  ] as Array<{ label: string; value: string; match: boolean; conf?: number }>;

  // Checklist — uses real email/phone verified flags from the API
  const steps = [
    { label: "Email verified",             ok: app.emailVerified === true },
    { label: "Phone verified",             ok: app.phoneVerified === true },
    { label: "ID front uploaded",          ok: !!idDoc },
    { label: "ID back uploaded",           ok: !!backDoc },
    { label: "Selfie uploaded",            ok: !!selfieDoc },
    { label: "Proof of address uploaded",  ok: !!addressDoc },
    { label: "OCR read successful",        ok: app.ocrConfidence >= 70 },
    ...(mrz?.found
      ? [{ label: "MRZ check digits valid",  ok: mrz.checkDigitScore === 100 }]
      : []),
    ...(extractedAddress?.formatted
      ? [{ label: "Address extracted",       ok: true }]
      : []),
    { label: "Face match passed",          ok: app.faceMatchScore >= 75 },
    { label: "Liveness passed",            ok: app.livenessScore >= 70 },
    { label: "No flagged issues",          ok: app.flags.length === 0 },
  ];

  const passCount    = steps.filter((s) => s.ok).length;
  const allPass      = passCount === steps.length;
  const hasIssues    = app.flags.length > 0;
  // Final only when a HUMAN decided (reviewer set): AI auto-decisions stay
  // overridable, and "additional docs requested" must NOT lock the buttons —
  // the broker still needs to decide once the documents arrive.
  const isReviewed   = (app.status === "approved" || app.status === "rejected") && !!app.reviewer;

  const scoreColor    = (v: number) => v >= 85 ? "text-pine"  : v >= 70 ? "text-amber"  : "text-rose";
  const scoreBarColor = (v: number) => v >= 85 ? "bg-pine"    : v >= 70 ? "bg-amber"    : "bg-rose";

  const handleApprove = () => {
    approveMutation.mutate(
      { applicationId: app.id, notes: reviewNotes.trim() || undefined },
      { onSuccess: () => { setShowApproveConfirm(false); onApprove(); } },
    );
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    rejectMutation.mutate(
      { applicationId: app.id, reason: rejectReason.trim(), notes: reviewNotes.trim() || undefined },
      { onSuccess: () => { setShowRejectDialog(false); onReject(); } },
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Section 1: Identity header ── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
        <Initials name={app.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm leading-none">{app.name}</span>
            <KycStatusBadge status={app.status} />
            <TierBadge tier={app.tierRequested} />
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1">
            <span>{docTypeLabel[app.docType]}</span>
            {app.phone && <><span className="opacity-30">·</span><span>{app.phone}</span></>}
            {app.city  && <><span className="opacity-30">·</span><span>{app.city}</span></>}
            <span className="opacity-30">·</span>
            <span>Submitted {relativeTime(app.submittedAt)}</span>
            {app.reviewer && (
              <><span className="opacity-30">·</span><span className="italic">Reviewed by {app.reviewer}</span></>
            )}
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
      <div className={`flex items-center flex-wrap gap-x-5 gap-y-1.5 px-5 py-2 border-b shrink-0 ${hasIssues ? "bg-amber/5 border-amber/20" : "border-border bg-muted/10"}`}>
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

        {app.livenessScore > 0 && (
          <>
            <span className="text-border text-xs">·</span>
            <div className="flex items-center gap-1.5">
              <Fingerprint className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Live</span>
              <div className="w-14 h-1 bg-muted rounded-full overflow-hidden mx-0.5">
                <div className={`h-full ${scoreBarColor(app.livenessScore)} rounded-full`} style={{ width: `${app.livenessScore}%` }} />
              </div>
              <span className={`text-xs font-semibold tabular-nums ${scoreColor(app.livenessScore)}`}>{app.livenessScore}%</span>
            </div>
          </>
        )}

        {mrz?.found && (
          <>
            <span className="text-border text-xs">·</span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                mrz.checkDigitScore === 100 ? "bg-pine/10 text-pine" : "bg-amber/10 text-amber"
              }`}
              title={`Machine-readable zone parsed — ${mrz.checkDigitScore}% of check digits valid`}
            >
              <BadgeCheck className="w-3 h-3" /> MRZ {mrz.checkDigitScore === 100 ? "verified" : `${mrz.checkDigitScore}%`}
            </span>
          </>
        )}

        {app.flags.length > 0 && (
          <>
            <span className="text-border text-xs">·</span>
            {app.flags.map((f) => (
              <span key={f} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber/10 text-amber">
                <AlertTriangle className="w-3 h-3" /> {f.replace(/_/g, " ")}
              </span>
            ))}
          </>
        )}

        <div className={`ml-auto text-[11px] font-medium shrink-0 ${allPass ? "text-pine" : "text-muted-foreground"}`}>
          {passCount}/{steps.length} checks
        </div>
      </div>

      {/* ── Section 3: Document viewer + Info panel ── */}
      <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-y-auto sm:overflow-hidden">

        {/* Left: Document viewer */}
        <div className="w-full sm:w-64 xl:w-72 shrink-0 border-b sm:border-b-0 sm:border-r border-border flex flex-col">
          <div className="flex border-b border-border px-3 pt-0.5 shrink-0">
            {(["front", ...(hasBack ? ["back" as const] : []), "selfie", ...(hasAddress ? ["address" as const] : [])] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDocTab(t as any)}
                className={`relative py-2.5 px-3 text-xs font-medium transition-colors ${
                  docTab === t ? "text-pine" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "front" ? "ID Front" : t === "back" ? "ID Back" : t === "selfie" ? "Selfie" : "Address Doc"}
                {docTab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-muted/20 flex flex-col gap-3 p-4 min-h-0 overflow-hidden">
            <div className="w-full aspect-[3/2] rounded-md border border-border bg-card flex flex-col items-center justify-center gap-2 relative overflow-hidden shrink-0">
              {isDetailLoading ? (
                <div className="w-full h-full bg-muted/40 animate-pulse flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
                </div>
              ) : isDetailError ? (
                <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <AlertTriangle className="w-6 h-6 text-amber" />
                  <span className="text-xs text-muted-foreground">Failed to load document</span>
                </div>
              ) : currentDocUrl ? (
                <img
                  src={currentDocUrl}
                  alt={docTab === "selfie" ? "Selfie" : docTab === "back" ? "ID Back" : "ID Front"}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = "none";
                    img.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  {docTab === "selfie" ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground">Selfie not uploaded</span>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-9 rounded border-2 border-muted-foreground/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-muted-foreground/40" />
                      </div>
                      <span className="text-xs text-muted-foreground">Document not uploaded</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {currentDocUrl && !isDetailLoading && (
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
                    <span className={`text-sm flex-1 ${s.ok ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                    <span className={`text-[11px] font-medium shrink-0 ${s.ok ? "text-pine" : "text-muted-foreground"}`}>
                      {s.ok ? "Pass" : "–"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {infoTab === "ocr" && (
              <div className="px-5 pb-4">
                {isDetailLoading ? (
                  <div className="space-y-3 pt-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : ocrFields.length === 0 ? (
                  <div className="py-8 flex flex-col items-center gap-2 text-center">
                    <ScanLine className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No OCR data extracted yet.</p>
                    <p className="text-[11px] text-muted-foreground/60">OCR runs automatically during KYC processing.</p>
                  </div>
                ) : (
                  <>
                    {mrz?.found && (
                      <div className={`mt-3 flex items-center gap-2 rounded-[3px] border px-3 py-2 ${
                        mrz.checkDigitScore === 100
                          ? "border-pine/25 bg-pine/5"
                          : "border-amber/25 bg-amber/5"
                      }`}>
                        <BadgeCheck className={`w-4 h-4 shrink-0 ${mrz.checkDigitScore === 100 ? "text-pine" : "text-amber"}`} />
                        <span className="text-xs text-muted-foreground">
                          {mrz.checkDigitScore === 100
                            ? "Machine-readable zone parsed — all ICAO check digits valid."
                            : `Machine-readable zone parsed — ${mrz.checkDigitScore}% of check digits valid.`}
                        </span>
                      </div>
                    )}

                    <div className="divide-y divide-border">
                      {ocrFields.map((f) => (
                        <div key={f.label} className="flex items-start justify-between gap-4 py-2.5">
                          <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{f.label}</span>
                          <div className="flex items-center gap-1.5 text-right min-w-0">
                            <span className="text-sm font-medium break-words min-w-0">{f.value}</span>
                            {typeof f.conf === "number" && (
                              <span
                                className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full shrink-0 ${
                                  f.conf >= 85 ? "bg-pine/10 text-pine" : f.conf >= 60 ? "bg-amber/10 text-amber" : "bg-rose/10 text-rose"
                                }`}
                                title="Extraction confidence"
                              >
                                {f.conf}%
                              </span>
                            )}
                            {f.match
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-pine shrink-0" />
                              : <span title="Mismatch with registered name"><AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0" /></span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Residential address extracted from the proof-of-residency document */}
                    {extractedAddress?.formatted && (
                      <div className="mt-4 rounded-[3px] border border-border bg-muted/20 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Residential address
                          </span>
                          {typeof extractedAddress.confidence === "number" && (
                            <span className="ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground" title="Extraction confidence">
                              {extractedAddress.confidence}%
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium leading-relaxed">{extractedAddress.formatted}</div>
                        {(extractedAddress.city || extractedAddress.district) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {[extractedAddress.city, extractedAddress.district]
                              .filter((v, i, a) => v && a.indexOf(v) === i)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {infoTab === "notes" && (
              <div className="p-5 space-y-3">
                {app.notes && (
                  <div className="rounded-[3px] bg-muted/30 border border-border p-3 text-sm text-muted-foreground">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Previous notes</span>
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
      {!isReviewed && !superAdmin ? (
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-background shrink-0">
          <button
            onClick={onRequestDocs}
            className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5 transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" /> Request docs
          </button>
          <button
            onClick={handleCsdDownload}
            disabled={csdDownloading}
            title="Download the pre-filled RBM CSD Securities Account Opening form"
            className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {csdDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            CSD form
          </button>
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
      ) : app.status === "additional_docs" ? (
        <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-border bg-amber/5 shrink-0">
          <FilePlus className="w-3.5 h-3.5 text-amber" />
          <span className="text-xs text-muted-foreground">
            Additional documents requested.
            {app.reviewer && <> · Requested by <strong>{app.reviewer}</strong></>}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-muted/20 shrink-0">
          <span className="text-xs text-muted-foreground flex-1">
            Application {app.status === "approved" ? "approved" : "rejected"}.
            {app.reviewer && <> · Reviewed by <strong>{app.reviewer}</strong></>}
            {app.reviewedAt && <> · {fmtDate(app.reviewedAt)}</>}
          </span>
          {app.status === "approved" && (
            <button
              onClick={handleCsdDownload}
              disabled={csdDownloading}
              title="Download the pre-filled RBM CSD Securities Account Opening form"
              className="h-8 px-3 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
            >
              {csdDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              CSD form
            </button>
          )}
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
                Failed to approve: {(approveMutation.error as Error)?.message ?? "Unknown error"}
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
                {approveMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving…</>
                ) : (
                  <><ShieldCheck className="w-3.5 h-3.5" /> Confirm Approve</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject dialog ── */}
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
                Failed to reject: {(rejectMutation.error as Error)?.message ?? "Unknown error"}
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
                {rejectMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rejecting…</>
                ) : (
                  "Confirm Reject"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
