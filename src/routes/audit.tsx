import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollText, Loader2, AlertTriangle, Search, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { Card, useDashboardRange } from "@/components/broker-shell";
import { requireSuperAdmin } from "@/lib/auth";
import { useAuditLogs, type AuditLogEntry } from "@/hooks/useAudit";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Log — Pine Admin" }] }),
  beforeLoad: () => requireSuperAdmin(),
  component: AuditLogPage,
});

const PAGE_SIZE = 50;

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function AuditLogPage() {
  // The topbar time range is the default window; the explicit From/To inputs
  // below override it when the reviewer needs a specific period.
  const { days, dateFrom: rangeFrom } = useDashboardRange();

  // Draft inputs vs applied filters — the query only refires on Apply/Enter.
  const [actionDraft, setActionDraft] = useState("");
  const [resourceTypeDraft, setResourceTypeDraft] = useState("");
  const [dateFromDraft, setDateFromDraft] = useState("");
  const [dateToDraft, setDateToDraft] = useState("");
  const [applied, setApplied] = useState<{ action?: string; resourceType?: string; dateFrom?: string; dateTo?: string }>({});
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({ ...applied, dateFrom: applied.dateFrom ?? rangeFrom, page, limit: PAGE_SIZE }),
    [applied, rangeFrom, page],
  );
  const { data, isLoading, isError, isFetching } = useAuditLogs(filters);

  // Changing the topbar range restarts at the first page.
  useEffect(() => { setPage(1); }, [rangeFrom]);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setPage(1);
    setApplied({
      action: actionDraft.trim() || undefined,
      resourceType: resourceTypeDraft.trim() || undefined,
      dateFrom: dateFromDraft || undefined,
      dateTo: dateToDraft || undefined,
    });
  };

  const clear = () => {
    setActionDraft(""); setResourceTypeDraft(""); setDateFromDraft(""); setDateToDraft("");
    setApplied({});
    setPage(1);
  };

  const hasFilters = Object.values(applied).some(Boolean);
  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[3px] bg-pine/10 text-pine flex items-center justify-center">
          <ScrollText className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Audit Log</h1>
          <p className="text-xs text-muted-foreground">
            Every administrative action recorded for compliance and review
            {applied.dateFrom ? "." : ` — last ${days} days unless a date is set below.`}
          </p>
        </div>
        {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Filters */}
      <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Action</label>
          <input
            value={actionDraft}
            onChange={(e) => setActionDraft(e.target.value)}
            placeholder="e.g. broker.update"
            className="w-full h-9 px-3 rounded-[3px] border border-border bg-card text-sm focus:outline-none focus:border-pine/40"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Resource type</label>
          <input
            value={resourceTypeDraft}
            onChange={(e) => setResourceTypeDraft(e.target.value)}
            placeholder="e.g. Broker"
            className="w-full h-9 px-3 rounded-[3px] border border-border bg-card text-sm focus:outline-none focus:border-pine/40"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">From</label>
          <input
            type="date"
            value={dateFromDraft}
            onChange={(e) => setDateFromDraft(e.target.value)}
            className="h-9 px-3 rounded-[3px] border border-border bg-card text-sm focus:outline-none focus:border-pine/40"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">To</label>
          <input
            type="date"
            value={dateToDraft}
            onChange={(e) => setDateToDraft(e.target.value)}
            className="h-9 px-3 rounded-[3px] border border-border bg-card text-sm focus:outline-none focus:border-pine/40"
          />
        </div>
        <button
          type="submit"
          className="h-9 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 flex items-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" /> Apply
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clear}
            className="h-9 px-3 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </form>

      {/* Table */}
      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-rose flex flex-col items-center gap-2">
            <AlertTriangle className="w-6 h-6" /> Failed to load the audit log.
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center">
            <ScrollText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
            No audit entries{hasFilters ? " match these filters" : ` in the last ${days} days`}.
          </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                    <th className="pl-5 py-2.5 text-left font-medium">Time</th>
                    <th className="py-2.5 text-left font-medium">Actor</th>
                    <th className="py-2.5 text-left font-medium">Action</th>
                    <th className="py-2.5 text-left font-medium">Resource</th>
                    <th className="pr-5 py-2.5 text-left font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => <AuditRow key={log.id} log={log} />)}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                Page {data?.page ?? page} of {totalPages} · {data?.total.toLocaleString() ?? 0} entries
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 px-2 rounded-[3px] border border-border text-[11px] text-muted-foreground hover:bg-muted/40 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 px-2 rounded-[3px] border border-border text-[11px] text-muted-foreground hover:bg-muted/40 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function AuditRow({ log }: { log: AuditLogEntry }) {
  const actorName = log.actor
    ? `${log.actor.firstName} ${log.actor.lastName}`
    : "System";
  const roleLabel = (log.actor?.role ?? log.actorRole ?? "").replace(/_/g, " ");

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20">
      <td className="pl-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtTime(log.createdAt)}</td>
      <td className="py-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate max-w-[180px]">{actorName}</div>
          {roleLabel && <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{roleLabel}</div>}
        </div>
      </td>
      <td className="py-3">
        <code className="text-[11px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-foreground">{log.action}</code>
      </td>
      <td className="py-3">
        <div className="text-[12px]">{log.resourceType}</div>
        {log.resourceId && (
          <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]" title={log.resourceId}>
            {log.resourceId}
          </div>
        )}
      </td>
      <td className="pr-5 py-3 text-[12px] font-mono text-muted-foreground whitespace-nowrap">{log.ipAddress || "—"}</td>
    </tr>
  );
}
