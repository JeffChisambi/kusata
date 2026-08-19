import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon, AlertTriangle, AlertCircle, Info, CheckCircle2,
  Smartphone, Monitor, Server, ShieldCheck, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/errors")({
  head: () => ({ meta: [{ title: "System Errors — Pine Admin" }] }),
  component: ErrorsPage,
});

type ErrorEvent = {
  id: string;
  source: "MOBILE_APP" | "BROKER_DASHBOARD" | "ADMIN_DASHBOARD" | "BACKEND";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "RESOLVED";
  message: string;
  stack: string | null;
  location: string | null;
  context: Record<string, unknown> | null;
  userId: string | null;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

const SEVERITY_META: Record<ErrorEvent["severity"], { label: string; cls: string; icon: typeof AlertOctagon; rank: number }> = {
  CRITICAL: { label: "Critical", cls: "bg-rose/10 text-rose border-rose/30", icon: AlertOctagon, rank: 0 },
  HIGH:     { label: "High",     cls: "bg-amber/10 text-amber border-amber/30", icon: AlertTriangle, rank: 1 },
  MEDIUM:   { label: "Medium",   cls: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: AlertCircle, rank: 2 },
  LOW:      { label: "Low",      cls: "bg-muted text-muted-foreground border-border", icon: Info, rank: 3 },
};

const SOURCE_META: Record<ErrorEvent["source"], { label: string; icon: typeof Smartphone }> = {
  MOBILE_APP:       { label: "Mobile app",       icon: Smartphone },
  BROKER_DASHBOARD: { label: "Broker dashboard", icon: Monitor },
  ADMIN_DASHBOARD:  { label: "Admin dashboard",  icon: ShieldCheck },
  BACKEND:          { label: "Backend",          icon: Server },
};

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ErrorsPage() {
  const qc = useQueryClient();
  const [source, setSource] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [status, setStatus] = useState<string>("OPEN");
  const [expanded, setExpanded] = useState<string | null>(null);

  const statsQ = useQuery({
    queryKey: ["errors", "stats"],
    queryFn: () => api.get<{ open: number; bySeverity: Record<string, number>; bySource: Record<string, number> }>("/v1/admin/errors/stats"),
    refetchInterval: 30_000,
  });

  const listQ = useQuery({
    queryKey: ["errors", "list", source, severity, status],
    queryFn: () => {
      const p = new URLSearchParams();
      if (source) p.set("source", source);
      if (severity) p.set("severity", severity);
      if (status) p.set("status", status);
      p.set("limit", "100");
      return api.get<{ events: ErrorEvent[]; total: number }>(`/v1/admin/errors?${p.toString()}`);
    },
    refetchInterval: 30_000,
  });

  const resolveM = useMutation({
    mutationFn: (id: string) => api.patch(`/v1/admin/errors/${id}/resolve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["errors"] });
    },
  });

  const stats = statsQ.data;
  const events = (listQ.data?.events ?? []).slice().sort(
    (a, b) => SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank ||
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );

  return (
    <div className="max-w-[1200px] mx-auto">
      <p className="text-xs text-muted-foreground mb-4">
        Errors captured from every surface — mobile app, dashboards, and the backend — deduplicated and ranked
        by priority, so issues are visible before anyone reports them.
      </p>

      {/* Severity stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {(Object.keys(SEVERITY_META) as ErrorEvent["severity"][]).map((sev) => {
          const meta = SEVERITY_META[sev];
          const Icon = meta.icon;
          const count = stats?.bySeverity?.[sev] ?? 0;
          const active = severity === sev;
          return (
            <button
              key={sev}
              onClick={() => setSeverity(active ? "" : sev)}
              className={`rounded-[6px] border p-4 text-left transition-colors ${active ? "border-pine bg-pine/5" : "border-border bg-card hover:bg-muted/30"}`}
            >
              <div className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                <Icon className="w-3 h-3" /> {meta.label}
              </div>
              <div className="text-2xl font-bold mt-2">{count}</div>
              <div className="text-[11px] text-muted-foreground">open</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[["", "All sources"], ["MOBILE_APP", "Mobile app"], ["BROKER_DASHBOARD", "Broker dashboard"], ["ADMIN_DASHBOARD", "Admin dashboard"], ["BACKEND", "Backend"]].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setSource(v)}
            className={`h-8 rounded-[4px] border px-3 text-xs ${source === v ? "border-pine bg-pine/10 text-pine font-medium" : "border-border text-muted-foreground hover:bg-muted/30"}`}
          >
            {label}{v && stats?.bySource?.[v] ? ` (${stats.bySource[v]})` : ""}
          </button>
        ))}
        <div className="flex-1" />
        {[["OPEN", "Open"], ["RESOLVED", "Resolved"], ["", "All"]].map(([v, label]) => (
          <button
            key={label}
            onClick={() => setStatus(v)}
            className={`h-8 rounded-[4px] border px-3 text-xs ${status === v ? "border-pine bg-pine/10 text-pine font-medium" : "border-border text-muted-foreground hover:bg-muted/30"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error list */}
      {listQ.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : events.length === 0 ? (
        <div className="rounded-[6px] border border-border bg-card px-4 py-14 text-center">
          <CheckCircle2 className="w-8 h-8 text-pine mx-auto mb-3" />
          <div className="text-sm font-medium">No {status === "OPEN" ? "open " : ""}errors</div>
          <div className="text-xs text-muted-foreground mt-1">All quiet across the platform.</div>
        </div>
      ) : (
        <div className="rounded-[6px] border border-border bg-card divide-y divide-border">
          {events.map((e) => {
            const sev = SEVERITY_META[e.severity];
            const src = SOURCE_META[e.source];
            const SevIcon = sev.icon;
            const SrcIcon = src.icon;
            const isOpen = expanded === e.id;
            return (
              <div key={e.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/20 transition-colors"
                >
                  <span className={`mt-0.5 inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${sev.cls}`}>
                    <SevIcon className="w-3 h-3" /> {sev.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{e.message}</div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><SrcIcon className="w-3 h-3" /> {src.label}</span>
                      {e.location && <span className="font-mono truncate max-w-[280px]">{e.location}</span>}
                      <span>{e.occurrences > 1 ? `${e.occurrences}× · ` : ""}last {relTime(e.lastSeenAt)}</span>
                      {e.status === "RESOLVED" && <span className="text-pine">resolved</span>}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    {e.stack && (
                      <pre className="rounded-[4px] bg-muted/40 border border-border p-3 text-[11px] font-mono overflow-x-auto max-h-56 whitespace-pre-wrap">{e.stack}</pre>
                    )}
                    {e.context && Object.keys(e.context).length > 0 && (
                      <pre className="rounded-[4px] bg-muted/40 border border-border p-3 text-[11px] font-mono overflow-x-auto max-h-40">{JSON.stringify(e.context, null, 2)}</pre>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>First seen {relTime(e.firstSeenAt)}</span>
                      {e.userId && <span className="font-mono">user {e.userId.slice(0, 8)}</span>}
                      <div className="flex-1" />
                      {e.status === "OPEN" && (
                        <button
                          onClick={() => resolveM.mutate(e.id)}
                          disabled={resolveM.isPending}
                          className="h-7 rounded-[3px] bg-pine px-3 text-[11px] font-semibold text-primary-foreground hover:bg-pine/90 disabled:opacity-60"
                        >
                          Mark resolved
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
