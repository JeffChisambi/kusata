import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Send, CheckCircle2, AlertTriangle, Clock3, MailCheck,
  Smartphone, Mail, MessageSquare, Megaphone, Plus,
  XCircle, Loader2, ChevronLeft, ChevronRight, Inbox,
} from "lucide-react";
import { Card, useDashboardRange } from "@/components/broker-shell";
import {
  useNotificationsList, useBroadcastNotification,
  type NotificationRow,
} from "@/hooks/useNotifications";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Client Notifications — Pine Broker Admin" },
      {
        name: "description",
        content: "Delivery record of every notification sent to your investors.",
      },
    ],
  }),
  component: NotificationsPage,
});

/* ─────────────────────────── types ─────────────────────────── */

type Channel = "push" | "email" | "sms" | "broadcast";

/** One outbound delivery — a message this broker sent TO an investor. */
type Delivery = {
  id: string;
  channel: Channel;
  /** Backend category — ANNOUNCEMENT/MARKETING are broker-authored; others are system-generated. */
  category: string;
  title: string;
  message: string;
  sentAt: string;
  /** Raw backend delivery status (QUEUED / SENT / DELIVERED / READ / FAILED). */
  status: string;
  recipientId: string | null;
  recipientName: string;
};

/** Broker-authored categories vs. platform-generated ones. */
const BROKER_CATEGORIES = new Set(["ANNOUNCEMENT", "MARKETING"]);

const PAGE_SIZE = 50;

/* ─────────────────────────── helpers ─────────────────────────── */

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/* ─────────────────────────── config maps ─────────────────────────── */

const channelConfig: Record<Channel, { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }> = {
  push:      { icon: Smartphone,    label: "Push",      cls: "text-sky border border-sky/30" },
  email:     { icon: Mail,          label: "Email",     cls: "text-violet-500 border border-violet-500/30" },
  sms:       { icon: MessageSquare, label: "SMS",       cls: "text-amber border border-amber/30" },
  broadcast: { icon: Megaphone,     label: "In-app",    cls: "text-pine border border-pine/30" },
};

/**
 * Delivery states, read as "did this reach the client?" — READ is a delivery
 * fact (the client opened it), never something the dashboard may change.
 */
const STATUS_META: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  QUEUED:    { label: "Queued",    cls: "text-muted-foreground border-border",    icon: Clock3 },
  SENT:      { label: "Sent",      cls: "text-sky border-sky/30",                 icon: Send },
  DELIVERED: { label: "Delivered", cls: "text-pine border-pine/30",               icon: CheckCircle2 },
  READ:      { label: "Opened",    cls: "text-pine border-pine/30",               icon: MailCheck },
  FAILED:    { label: "Failed",    cls: "text-rose border-rose/30",               icon: AlertTriangle },
};

const STATUS_FILTERS = ["", "QUEUED", "SENT", "DELIVERED", "READ", "FAILED"] as const;
const CHANNEL_FILTERS: Array<[string, string]> = [
  ["", "All channels"],
  ["IN_APP", "In-app"],
  ["PUSH", "Push"],
  ["EMAIL", "Email"],
  ["SMS", "SMS"],
];

// Real recipient targets — map to the backend broadcast's `targetRole` filter
// (undefined = all active users). Only options the backend can actually honour.
const AUDIENCES: { label: string; targetRole?: string }[] = [
  { label: "All active users", targetRole: undefined },
  { label: "Customers", targetRole: "CUSTOMER" },
  { label: "Brokers", targetRole: "BROKER" },
];

// Compose channel → backend NotificationChannel
const CHANNEL_MAP: Record<Channel, string> = {
  push: "PUSH",
  email: "EMAIL",
  sms: "SMS",
  broadcast: "IN_APP",
};

/* ─────────────────────────── API → UI mapper ─────────────────────────── */

function mapChannel(raw: string): Channel {
  const lower = raw.toLowerCase();
  if (lower.includes("push")) return "push";
  if (lower.includes("email")) return "email";
  if (lower.includes("sms")) return "sms";
  return "broadcast";
}

function mapDelivery(n: NotificationRow): Delivery {
  const name = n.user ? `${n.user.firstName} ${n.user.lastName}`.trim() : "";
  return {
    id: String(n.id),
    channel: mapChannel(n.channel ?? "IN_APP"),
    category: n.category ?? "SYSTEM",
    title: n.title ?? "Notification",
    message: n.body ?? "",
    sentAt: n.sentAt ?? n.createdAt,
    status: (n.status ?? "SENT").toUpperCase(),
    recipientId: n.user?.id ?? n.userId ?? null,
    recipientName: name || "Unknown client",
  };
}

/* ─────────────────────────── page ─────────────────────────── */

function NotificationsPage() {
  const { days, dateFrom } = useDashboardRange();

  const [compose, setCompose] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [channel, setChannel] = useState<string>("");
  // Category separation: broker-authored announcements vs system-generated.
  const [categoryTab, setCategoryTab] = useState<"all" | "broker" | "system">("all");
  const [page, setPage] = useState(1);

  // Any filter — including the topbar time range — starts back at page 1.
  useEffect(() => { setPage(1); }, [status, channel, categoryTab, dateFrom]);

  const { data, isLoading, isFetching } = useNotificationsList({
    status: status || undefined,
    channel: channel || undefined,
    dateFrom,
    page,
    limit: PAGE_SIZE,
  });

  const items = useMemo(
    () => (data?.notifications ?? []).map(mapDelivery),
    [data],
  );

  const visible =
    categoryTab === "broker"
      ? items.filter((n) => BROKER_CATEGORIES.has(n.category))
      : categoryTab === "system"
        ? items.filter((n) => !BROKER_CATEGORIES.has(n.category))
        : items;

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Delivery health for the messages currently loaded.
  const delivered = items.filter((n) => n.status === "DELIVERED" || n.status === "READ").length;
  const failed = items.filter((n) => n.status === "FAILED").length;

  return (
    <>
      <div className="pt-6 space-y-5">

        {/* Framing — these are the CLIENTS' messages, not the broker's inbox. */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-[3px] bg-pine/10 text-pine flex items-center justify-center shrink-0">
            <Send className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Client Notifications</h1>
            <p className="text-xs text-muted-foreground">
              A delivery record of every message sent <span className="font-medium text-foreground">to your investors</span> —
              announcements, receipts and alerts as they landed in each client's app. Use it to answer
              “did the client actually receive it?”. Nothing here is an inbox: reading state belongs to
              the client.
            </p>
          </div>
          {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0 mt-1" />}
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard icon={Send} label="Messages sent" value={total} sub={`last ${days} days`} />
          <SummaryCard icon={CheckCircle2} label="Reached the client" value={delivered} sub="on this page" />
          <SummaryCard icon={AlertTriangle} label="Failed" value={failed} sub="on this page" accent={failed > 0} />
        </div>

        {/* Delivery log */}
        <Card
          title="Delivery log"
          subtitle={`Newest first · last ${days} days`}
          action={
            <button
              onClick={() => setCompose(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-[3px] bg-pine text-primary-foreground text-[12px] font-medium hover:bg-pine/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Send
            </button>
          }
        >
          {/* Category separation — broker-authored vs system-generated */}
          <div className="mb-3 flex items-center gap-1 border-b border-border -mx-5 px-5">
            {([
              ["all", "All"],
              ["broker", "Broker announcements"],
              ["system", "System notifications"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCategoryTab(key)}
                className={`relative py-2 px-3 text-xs font-medium transition-colors ${
                  categoryTab === key ? "text-pine" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {categoryTab === key && (
                  <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Delivery diagnostics filters */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((s) => {
              const active = status === s;
              return (
                <button
                  key={s || "all"}
                  onClick={() => setStatus(s)}
                  className={`h-7 rounded-[3px] border px-2.5 text-[11px] transition-colors ${
                    active ? "border-pine bg-pine/10 text-pine font-medium" : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {s ? STATUS_META[s]?.label ?? s : "All statuses"}
                </button>
              );
            })}
            <div className="flex-1" />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              aria-label="Channel"
              className="h-7 rounded-[3px] border border-border bg-card px-2 text-[11px] text-muted-foreground focus:outline-none focus:border-pine/40"
            >
              {CHANNEL_FILTERS.map(([v, label]) => (
                <option key={v || "all"} value={v}>{label}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium">Nothing sent in this window</p>
              <p className="text-xs text-muted-foreground mt-1">
                No client notifications match these filters over the last {days} days.
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border -mx-5">
                {visible.map((n) => <DeliveryItem key={n.id} delivery={n} />)}
              </ul>

              {/* Pagination — a delivery log must never silently truncate. */}
              <div className="flex items-center justify-between pt-3 -mb-1">
                <span className="text-[11px] text-muted-foreground">
                  Page {page} of {totalPages} · {total.toLocaleString()} message{total === 1 ? "" : "s"} in range
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

      {compose && <ComposeModal onClose={() => setCompose(false)} />}
    </>
  );
}

/* ─────────────────────────── summary card ─────────────────────────── */

function SummaryCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; sub: string; accent?: boolean;
}) {
  return (
    <div className="flex-1 rounded-[3px] bg-card border border-border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 flex items-center justify-center">
          <Icon className={`w-4.5 h-4.5 ${accent ? "text-rose" : "text-muted-foreground"}`} />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">{sub}</span>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold leading-tight mt-0.5">{value.toLocaleString()}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────── log row ─────────────────────────── */

function DeliveryItem({ delivery: n }: { delivery: Delivery }) {
  const cc = channelConfig[n.channel] ?? channelConfig.push;
  const ChanIcon = cc.icon;
  const sm = STATUS_META[n.status] ?? { label: n.status, cls: "text-muted-foreground border-border", icon: Send };
  const StatusIcon = sm.icon;

  return (
    <li className="flex items-start gap-4 px-5 py-4">
      {/* Recipient leads the row — this is somebody else's message. */}
      <div className="w-[190px] shrink-0 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">To</div>
        {n.recipientId ? (
          <Link
            to="/users/$userId"
            params={{ userId: n.recipientId }}
            className="text-[13px] font-medium text-foreground truncate block hover:text-pine transition-colors"
          >
            {n.recipientName}
          </Link>
        ) : (
          <span className="text-[13px] font-medium text-muted-foreground truncate block">{n.recipientName}</span>
        )}
        <div className="text-[11px] text-muted-foreground mt-0.5" title={fmtTime(n.sentAt)}>
          {relativeTime(n.sentAt)}
        </div>
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium leading-snug truncate">{n.title}</div>
        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{n.message}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[3px] ${cc.cls}`}>
            <ChanIcon className="w-3 h-3" /> {cc.label}
          </span>
          <span className="text-[11px] text-muted-foreground capitalize">
            {n.category.toLowerCase().replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Delivery outcome */}
      <div className="shrink-0">
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[3px] border ${sm.cls}`}>
          <StatusIcon className="w-3 h-3" /> {sm.label}
        </span>
      </div>
    </li>
  );
}

/* ─────────────────────────── compose modal ─────────────────────────── */

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<Channel>("push");
  const [audienceIdx, setAudienceIdx] = useState(0);
  const [category, setCategory] = useState<"ANNOUNCEMENT" | "SYSTEM" | "MARKETING">("ANNOUNCEMENT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const broadcast = useBroadcastNotification();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // SMS has no title; every other channel needs one.
  const effectiveTitle = channel === "sms" ? (title.trim() || "Pine") : title.trim();
  const canSend = body.trim().length > 0 && (channel === "sms" || title.trim().length > 0) && !broadcast.isPending;

  const handleSend = () => {
    if (!canSend) return;
    setError(null);
    broadcast.mutate(
      {
        title: effectiveTitle,
        body: body.trim(),
        channel: CHANNEL_MAP[channel],
        targetRole: AUDIENCES[audienceIdx]?.targetRole,
        category,
      },
      {
        onSuccess: () => onClose(),
        onError: (e: any) => setError(e?.message ?? "Failed to send. Please try again."),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background rounded-[3px] shadow-2xl border border-border flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="font-semibold text-[15px]">Send Notification</div>
          <button onClick={onClose} className="w-8 h-8 rounded-[3px] hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* Channel */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Channel</label>
            <div className="grid grid-cols-4 gap-2">
              {(["push", "email", "sms", "broadcast"] as Channel[]).map((ch) => {
                const cfg = channelConfig[ch];
                const Icon = cfg.icon;
                return (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-[3px] border text-[11px] font-medium transition-colors ${
                      channel === ch
                        ? "border-pine/50 bg-pine/5 text-pine"
                        : "border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Segment */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Recipients</label>
            <select
              value={audienceIdx}
              onChange={(e) => setAudienceIdx(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-[3px] border border-border bg-background text-sm focus:outline-none focus:border-pine/40"
            >
              {AUDIENCES.map((a, i) => <option key={a.label} value={i}>{a.label}</option>)}
            </select>
          </div>

          {/* Category — keeps broker announcements separate from system notices */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full h-9 px-3 rounded-[3px] border border-border bg-background text-sm focus:outline-none focus:border-pine/40"
            >
              <option value="ANNOUNCEMENT">Broker announcement</option>
              <option value="SYSTEM">System notice</option>
              <option value="MARKETING">Marketing</option>
            </select>
          </div>

          {/* Title — not needed for SMS */}
          {channel !== "sms" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                {channel === "email" ? "Subject" : "Title"}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={channel === "email" ? "Email subject…" : "Notification title…"}
                className="w-full h-9 px-3 rounded-[3px] border border-border bg-background text-sm focus:outline-none focus:border-pine/40"
              />
            </div>
          )}

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Message</label>
              {channel === "sms" && (
                <span className={`text-[11px] ${body.length > 140 ? "text-rose" : "text-muted-foreground"}`}>
                  {body.length}/160
                </span>
              )}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={channel === "email" ? 5 : 3}
              maxLength={channel === "sms" ? 160 : undefined}
              placeholder="Write your message…"
              className="w-full px-3 py-2.5 rounded-[3px] border border-border bg-background text-sm focus:outline-none focus:border-pine/40 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          {error && <p className="text-xs text-rose mb-2">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40"
            >
              Cancel
            </button>
            <button
              disabled={!canSend}
              onClick={handleSend}
              className="h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {broadcast.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                : <><Send className="w-3.5 h-3.5" /> Send Now</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
