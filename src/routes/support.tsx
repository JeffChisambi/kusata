import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  LifeBuoy, Loader2, AlertTriangle, MessageSquare, Clock3, CheckCircle2, CircleDot, XCircle,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import { useSupportTickets, type SupportStatus, type SupportTicketSummary } from "@/hooks/useSupport";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support — Pine Broker Admin" }] }),
  component: SupportInboxPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  DEPOSITS: "Deposits", WITHDRAWALS: "Withdrawals", TRADING: "Trading",
  TREASURY: "Treasury", ACCOUNT: "Account", OTHER: "Other",
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusPill({ status }: { status: SupportStatus }) {
  const map = {
    OPEN: { cls: "bg-amber/10 text-amber", Icon: Clock3, label: "Open" },
    IN_REVIEW: { cls: "bg-sky/10 text-sky", Icon: CircleDot, label: "In review" },
    RESOLVED: { cls: "bg-pine/10 text-pine", Icon: CheckCircle2, label: "Resolved" },
    CLOSED: { cls: "bg-muted text-muted-foreground", Icon: XCircle, label: "Closed" },
  }[status];
  const Icon = map.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${map.cls}`}>
      <Icon className="w-3 h-3" /> {map.label}
    </span>
  );
}

const FILTERS: { label: string; value: "ALL" | "AWAITING" | SupportStatus }[] = [
  { label: "All", value: "ALL" },
  { label: "Awaiting reply", value: "AWAITING" },
  { label: "Open", value: "OPEN" },
  { label: "In review", value: "IN_REVIEW" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" },
];

function SupportInboxPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("ALL");

  const queryFilters =
    filter === "ALL" ? {}
    : filter === "AWAITING" ? { awaitingAdmin: true }
    : { status: filter };

  const { data, isLoading, isError } = useSupportTickets(queryFilters);
  const tickets = data?.tickets ?? [];

  return (
    <div className="pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[3px] bg-pine/10 text-pine flex items-center justify-center">
          <LifeBuoy className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Support</h1>
          <p className="text-xs text-muted-foreground">Customer reports from the mobile app.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`h-8 px-3 rounded-[3px] text-xs font-medium border transition-colors ${
              filter === f.value
                ? "bg-pine text-primary-foreground border-pine"
                : "bg-card text-muted-foreground border-border hover:bg-muted/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-rose flex flex-col items-center gap-2">
            <AlertTriangle className="w-6 h-6" /> Failed to load support tickets.
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No tickets here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <th className="pl-5 py-2.5 text-left font-medium">Ticket</th>
                  <th className="py-2.5 text-left font-medium">Customer</th>
                  <th className="py-2.5 text-left font-medium">Status</th>
                  <th className="pr-5 py-2.5 text-right font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t: SupportTicketSummary) => (
                  <tr
                    key={t.ticketId}
                    onClick={() => navigate({ to: "/support/$ticketId", params: { ticketId: t.ticketId } })}
                    className="border-b border-border hover:bg-muted/20 cursor-pointer"
                  >
                    <td className="pl-5 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {t.awaitingAdmin && <span className="w-2 h-2 rounded-full bg-pine shrink-0" title="Awaiting reply" />}
                        <div className="min-w-0">
                          <div className="font-medium text-[13px] truncate max-w-[360px]">{t.subject}</div>
                          <div className="text-[11px] text-muted-foreground">
                            #{t.reference} · {CATEGORY_LABEL[t.category] ?? t.category}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-[12px] text-muted-foreground">
                      <div className="truncate max-w-[200px]">{t.user?.name || "—"}</div>
                      <div className="text-[11px]">{t.user?.phone}</div>
                    </td>
                    <td className="py-3"><StatusPill status={t.status} /></td>
                    <td className="pr-5 py-3 text-right text-[12px] text-muted-foreground whitespace-nowrap">
                      {relativeTime(t.lastMessageAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
