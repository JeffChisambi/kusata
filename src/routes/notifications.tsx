import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bell, Send, Clock, CheckCircle2, AlertTriangle,
  Smartphone, Mail, MessageSquare, Megaphone, Plus,
  XCircle, Circle, Loader2,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import { useNotificationsList, useNotificationStats, useBroadcastNotification } from "@/hooks/useNotifications";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Pine Broker Admin" },
      { name: "description", content: "System notifications and alerts." },
    ],
  }),
  component: NotificationsPage,
});

/* ─────────────────────────── types ─────────────────────────── */

type Channel = "push" | "email" | "sms" | "broadcast";
type NotifType = "alert" | "info" | "success" | "warning";

type Notif = {
  id: string;
  type: NotifType;
  channel: Channel;
  /** Backend category — ANNOUNCEMENT/MARKETING are broker-authored; others are system-generated. */
  category: string;
  title: string;
  message: string;
  sentAt: string;
  read: boolean;
  recipients: number;
};

/** Broker-authored categories vs. platform-generated ones. */
const BROKER_CATEGORIES = new Set(["ANNOUNCEMENT", "MARKETING"]);

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

function fmtNum(n: number | undefined | null) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* ─────────────────────────── config maps ─────────────────────────── */

const typeConfig: Record<NotifType, { icon: React.ComponentType<{ className?: string }>; iconCls: string; dotCls: string }> = {
  alert:   { icon: AlertTriangle, iconCls: "text-muted-foreground", dotCls: "bg-rose" },
  warning: { icon: AlertTriangle, iconCls: "text-muted-foreground", dotCls: "bg-amber" },
  success: { icon: CheckCircle2,  iconCls: "text-muted-foreground", dotCls: "bg-pine" },
  info:    { icon: Bell,          iconCls: "text-muted-foreground", dotCls: "bg-sky" },
};

const channelConfig: Record<Channel, { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }> = {
  push:      { icon: Smartphone,    label: "Push",      cls: "text-sky border border-sky/30" },
  email:     { icon: Mail,          label: "Email",     cls: "text-violet-500 border border-violet-500/30" },
  sms:       { icon: MessageSquare, label: "SMS",       cls: "text-amber border border-amber/30" },
  broadcast: { icon: Megaphone,     label: "Broadcast", cls: "text-pine border border-pine/30" },
};

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

/* ─────────────────────────── API → UI mappers ─────────────────────────── */

function mapNotifType(raw: string): NotifType {
  const lower = raw.toLowerCase();
  if (lower.includes("alert") || lower.includes("critical") || lower.includes("security")) return "alert";
  if (lower.includes("warn")) return "warning";
  if (lower.includes("success") || lower.includes("approved")) return "success";
  return "info";
}

function mapChannel(raw: string): Channel {
  const lower = raw.toLowerCase();
  if (lower.includes("push")) return "push";
  if (lower.includes("email")) return "email";
  if (lower.includes("sms")) return "sms";
  if (lower.includes("broadcast")) return "broadcast";
  return "push";
}

/* ─────────────────────────── page ─────────────────────────── */

function NotificationsPage() {
  const { data: rawData, isLoading } = useNotificationsList();
  const { data: stats } = useNotificationStats();

  // The API returns { notifications: [...] } where each item has backend field names.
  // Map them to the component's Notif shape.
  const serverItems: Notif[] = (() => {
    if (!rawData) return [];
    let raw: any[] = [];
    if (Array.isArray(rawData)) raw = rawData;
    else {
      const d = rawData as Record<string, unknown>;
      if (Array.isArray(d.notifications)) raw = d.notifications;
      else if (Array.isArray(d.data)) raw = d.data;
    }
    return raw.map((n: any) => ({
      id: n.id ?? crypto.randomUUID(),
      type: mapNotifType(n.type ?? n.category ?? "INFORMATIONAL"),
      channel: mapChannel(n.channel ?? "IN_APP"),
      category: (n.category ?? "SYSTEM") as string,
      title: n.title ?? "Notification",
      message: n.body ?? n.message ?? "",
      sentAt: n.sentAt ?? n.createdAt ?? new Date().toISOString(),
      read: n.status === "READ" || n.status === "DELIVERED" || !!n.readAt,
      recipients: n.recipients ?? 1,
    }));
  })();

  const [items, setItems] = useState<Notif[]>([]);
  const [compose, setCompose] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  // Category separation: broker-authored announcements vs system-generated.
  const [categoryTab, setCategoryTab] = useState<"all" | "broker" | "system">("all");

  // Sync local state when server data arrives
  useEffect(() => {
    if (serverItems.length > 0) {
      setItems(serverItems);
    }
  }, [rawData]);

  const unread = items.filter((n) => !n.read).length;
  const byCategory =
    categoryTab === "broker"
      ? items.filter((n) => BROKER_CATEGORIES.has(n.category))
      : categoryTab === "system"
        ? items.filter((n) => !BROKER_CATEGORIES.has(n.category))
        : items;
  const visible = filter === "unread" ? byCategory.filter((n) => !n.read) : byCategory;

  // Derive "sent today" from items (sentAt within last 24h)
  const sentToday = items.filter((n) => {
    const diff = Date.now() - new Date(n.sentAt).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }).length;

  // "Scheduled" count from stats if available
  const scheduled = (() => {
    if (!stats) return 0;
    const pending = stats.byStatus?.find((s) => s.status === "scheduled" || s.status === "pending");
    return pending?.count ?? 0;
  })();

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  return (
    <>
      <div className="pt-6 space-y-5">

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard
            icon={Bell}
            label="Unread"
            value={unread}
            sub="require attention"
            accent={unread > 0}
          />
          <SummaryCard
            icon={Send}
            label="Sent today"
            value={sentToday}
            sub="notifications dispatched"
          />
          <SummaryCard
            icon={Clock}
            label="Scheduled"
            value={scheduled}
            sub="pending delivery"
          />
        </div>

        {/* Feed */}
        <Card
          title="Notification Feed"
          action={
            <div className="flex items-center gap-2">
              {/* Filter toggle */}
              <div className="flex items-center rounded-[3px] border border-border overflow-hidden text-[12px]">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1.5 transition-colors ${filter === "all" ? "bg-pine text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted/40"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("unread")}
                  className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 ${filter === "unread" ? "bg-pine text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted/40"}`}
                >
                  Unread
                  {unread > 0 && (
                    <span className={`text-[10px] font-bold px-1 rounded-full ${filter === "unread" ? "bg-white/20" : "bg-rose text-white"}`}>
                      {unread}
                    </span>
                  )}
                </button>
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[12px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setCompose(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-[3px] bg-pine text-primary-foreground text-[12px] font-medium hover:bg-pine/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Send
              </button>
            </div>
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
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-8 h-8 text-pine mx-auto mb-3" />
              <p className="text-sm font-medium">All caught up</p>
              <p className="text-xs text-muted-foreground mt-1">No unread notifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-border -mx-5">
              {visible.map((n) => (
                <NotifItem key={n.id} notif={n} onRead={markRead} />
              ))}
            </ul>
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
        <div className="w-9 h-9 flex items-center justify-center text-muted-foreground">
          <Icon className={`w-4.5 h-4.5 ${accent ? "text-rose" : "text-muted-foreground"}`} />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">{sub}</span>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold leading-tight mt-0.5">{value}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────── feed item ─────────────────────────── */

function NotifItem({ notif: n, onRead }: { notif: Notif; onRead: (id: string) => void }) {
  const tc = typeConfig[n.type] ?? typeConfig.info;
  const cc = channelConfig[n.channel] ?? channelConfig.push;
  const TypeIcon = tc.icon;
  const ChanIcon = cc.icon;

  return (
    <li
      className={`flex items-start gap-4 px-5 py-4 transition-colors cursor-pointer hover:bg-muted/30 ${!n.read ? "bg-muted/10" : ""}`}
      onClick={() => onRead(n.id)}
    >
      {/* Type icon */}
      <div className="w-8 h-8 flex items-center justify-center shrink-0 mt-0.5">
        <TypeIcon className={`w-4 h-4 ${tc.iconCls}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[13px] font-medium leading-snug ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
            {n.title}
          </span>
          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-pine shrink-0" />}
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{n.message}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[3px] ${cc.cls}`}>
            <ChanIcon className="w-3 h-3" /> {cc.label}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {fmtNum(n.recipients)} {n.recipients === 1 ? "recipient" : "recipients"}
          </span>
          <span className="text-[11px] text-muted-foreground">{relativeTime(n.sentAt)}</span>
        </div>
      </div>

      {/* Unread dot / read indicator */}
      <div className="shrink-0 mt-1.5">
        {!n.read
          ? <Circle className="w-3 h-3 fill-pine text-pine" />
          : <Circle className="w-3 h-3 text-border" />}
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
