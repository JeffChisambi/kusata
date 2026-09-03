import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  FileText, ChevronDown, AlertTriangle, ScanLine, FilePlus, TrendingUp, TrendingDown, Loader2,
} from "lucide-react";
import { KycIcon, PendingIcon, ExecutedIcon, RejectedIcon, ManualVerifyIcon, RefreshIcon, ExportIcon } from "@/components/pine-icons";
import { Card } from "@/components/broker-shell";
import {
  useKycQueue, useRequestAdditionalDocs, useKycCounts,
  type KycApplicationRow,
} from "@/hooks/useKyc";
import { DOC_REQUEST_OPTIONS } from "@/lib/kyc-docs";

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
  { key: "all",        label: "All",              icon: KycIcon },
  { key: "pending",    label: "Pending Review",   icon: PendingIcon,   apiStatus: "PENDING" },
  { key: "manual",     label: "Manual Review",    icon: ManualVerifyIcon, apiStatus: "MANUAL_REVIEW" },
  { key: "additional", label: "Additional Docs",  icon: FilePlus,      apiStatus: "ADDITIONAL_DOCS" },
  { key: "approved",   label: "Approved",         icon: ExecutedIcon,  apiStatus: "APPROVED" },
  { key: "rejected",   label: "Rejected",         icon: RejectedIcon,  apiStatus: "REJECTED" },
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
  // Open on every application, not just the pending ones — a broker
  // landing on an empty table cannot tell "none pending" from "no data".
  const [activeTab, setActiveTab] = useState("all");
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

  // The "OCR Results" tab is a client-side filter, so its count comes from the
  // rows currently loaded rather than the server's per-status counts.
  const ocrTab = TABS.find((t) => t.key === "ocr");
  const ocrCount = ocrTab?.clientFilter ? applications.filter(ocrTab.clientFilter).length : 0;

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
          ocrCount={ocrCount}
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
            <RefreshIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportToCsv(rows, activeTab)}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 h-9 px-3 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-40"
          >
            <ExportIcon className="w-3.5 h-3.5" /> Export
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

      {/* Request additional docs modal (opened from the row menu) */}
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
      icon: PendingIcon,
      tone: pending > 0 ? "amber" : "pine",
      trend: pending > 0 ? "queue" : "clear",
      up: false,
    },
    {
      label: "Approved",
      value: approved,
      icon: ExecutedIcon,
      tone: "pine",
      trend: total > 0 ? `${Math.round((approved / total) * 100)}%` : "—",
      up: true,
    },
    {
      label: "Rejected",
      value: rejected,
      icon: RejectedIcon,
      tone: rejected > 0 ? "rose" : "pine",
      trend: total > 0 ? `${Math.round((rejected / total) * 100)}%` : "—",
      up: false,
    },
    {
      label: "Manual Review",
      value: manual,
      icon: ManualVerifyIcon,
      tone: manual > 0 ? "amber" : "pine",
      trend: manual > 0 ? "flagged" : "clear",
      up: false,
    },
  ] as const;

  return (
    <div className="flex flex-wrap gap-4">
      {stats.map((s) => {
        const Icon = s.icon;
        const Trend = s.up ? TrendingUp : TrendingDown;
        return (
          <div key={s.label} className="flex-1 min-w-[160px] rounded-[3px] bg-card border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="w-9 h-9 shrink-0 flex items-center justify-center">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </span>
              {/* Neutral: these are captions, not alerts — the accent belongs
                  to figures that genuinely need attention. */}
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                <Trend className="w-3 h-3" /> {s.trend}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-bold leading-tight mt-0.5">{s.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── filter tabs dropdown ─────────────────────────── */

function FilterTabsDropdown({
  activeTab, setActiveTab, tabs, counts, ocrCount,
}: {
  activeTab: string;
  setActiveTab: (v: string) => void;
  tabs: Tab[];
  counts?: Record<string, number>;
  /** Client-side count for the OCR tab (computed from loaded rows). */
  ocrCount: number;
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
    ocr:        String(ocrCount),
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
  rows, onSelect, onRequestDocs, showDetailColumns,
}: {
  rows: KycApplication[];
  onSelect: (a: KycApplication) => void;
  onRequestDocs: (a: KycApplication) => void;
  showDetailColumns: boolean;
}) {
  const colCount = showDetailColumns ? 8 : 4;
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        {/* Fixed shares so the columns spread across the card instead of
            bunching left. The applicant needs the most room; the rest are
            short values. */}
        <colgroup>
          {showDetailColumns ? (
            <>
              <col className="w-[26%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[7%]" />
            </>
          ) : (
            <>
              <col className="w-[40%]" />
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[22%]" />
            </>
          )}
        </colgroup>
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <th className="pl-5 py-2.5 text-left font-medium">Applicant</th>
            <th className="py-2.5 text-left font-medium">Document</th>
            <th className="py-2.5 text-left font-medium">Tier</th>
            <th className="py-2.5 text-left font-medium last:pr-5">Status</th>
            {showDetailColumns && (
              <>
                <th className="py-2.5 text-left font-medium">OCR</th>
                <th className="py-2.5 text-left font-medium">Face</th>
                <th className="py-2.5 text-left font-medium">Submitted</th>
                <th className="pr-5 py-2.5 text-left font-medium">Flags</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <KycRow
              key={r.id}
              app={r}
              onSelect={onSelect}
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
  app, onSelect, showDetailColumns,
}: {
  app: KycApplication;
  onSelect: (a: KycApplication) => void;
  showDetailColumns: boolean;
}) {
  return (
    <tr
      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onSelect(app)}
    >
      <td className="pl-5 py-3">
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
      <td className={`py-3 ${showDetailColumns ? "" : "pr-5"}`}>
        <KycStatusBadge status={app.status} />
      </td>
      {showDetailColumns && (
        <>
          <td className="py-3"><ScoreBar value={app.ocrConfidence} /></td>
          <td className="py-3"><ScoreBar value={app.faceMatchScore} /></td>
          <td className="py-3 text-[12px] text-muted-foreground whitespace-nowrap">{relativeTime(app.submittedAt)}</td>
          <td className="pr-5 py-3">
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
    <span className="text-[11px] font-medium text-foreground">
      {tier === "tier2" ? "Tier 2" : "Tier 1"}
    </span>
  );
}

function KycStatusBadge({ status }: { status: KycStatus }) {
  const map: Record<KycStatus, { cls: string; dot: string; label: string }> = {
    pending:         { cls: "text-amber",           dot: "bg-amber",            label: "Pending" },
    approved:        { cls: "text-pine",            dot: "bg-pine",             label: "Approved" },
    rejected:        { cls: "text-rose",            dot: "bg-rose",             label: "Rejected" },
    additional_docs: { cls: "text-amber",           dot: "bg-amber",            label: "Awaiting Docs" },
    manual:          { cls: "text-muted-foreground", dot: "bg-muted-foreground", label: "Manual Review" },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.cls}`}>
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



/* ─────────────────────────── request docs dialog ─────────────────────────── */

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
