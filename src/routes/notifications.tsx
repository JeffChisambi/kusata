import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bell, Send, Clock, CheckCircle2, AlertTriangle,
  Smartphone, Mail, MessageSquare, Megaphone, Plus,
  XCircle, Circle,
} from "lucide-react";
import { AdminShell, Card } from "@/components/admin-shell";

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
  title: string;
  message: string;
  sentAt: string;
  read: boolean;
  recipients: number;
};

/* ─────────────────────────── mock data ─────────────────────────── */

const notifications: Notif[] = [
  { id: "1",  type: "alert",   channel: "broadcast", title: "Trading suspended: MCB",              message: "Trading for Malawi Commercial Bank has been temporarily suspended pending regulatory review.",    sentAt: "2026-06-06T10:42:00Z", read: false, recipients: 184203 },
  { id: "2",  type: "warning", channel: "push",      title: "Withdrawal limit approaching",         message: "15 users have reached 90% of their daily withdrawal limit. Review may be required.",             sentAt: "2026-06-06T09:15:00Z", read: false, recipients: 15 },
  { id: "3",  type: "success", channel: "push",      title: "KYC batch approved",                  message: "12 KYC submissions were approved automatically after passing all verification checks.",           sentAt: "2026-06-06T08:30:00Z", read: false, recipients: 12 },
  { id: "4",  type: "info",    channel: "email",     title: "Monthly statements dispatched",        message: "June 2026 account statements have been emailed to all 184,203 active users successfully.",       sentAt: "2026-06-06T07:00:00Z", read: false, recipients: 184203 },
  { id: "5",  type: "alert",   channel: "sms",       title: "Failed OTP deliveries",               message: "38 OTP SMS messages failed delivery in the last hour. Provider: Airtel. Retrying automatically.", sentAt: "2026-06-06T06:50:00Z", read: false, recipients: 38 },
  { id: "6",  type: "success", channel: "broadcast", title: "System maintenance complete",          message: "Scheduled maintenance completed successfully. All services restored and operating normally.",      sentAt: "2026-06-05T23:10:00Z", read: true,  recipients: 184203 },
  { id: "7",  type: "info",    channel: "push",      title: "Market opens in 15 minutes",           message: "Malawi Stock Exchange opens at 09:00 WAT. 14,208 active traders have been notified.",            sentAt: "2026-06-05T08:45:00Z", read: true,  recipients: 14208 },
  { id: "8",  type: "warning", channel: "email",     title: "Unverified accounts reminder",         message: "892 accounts registered over 30 days ago have not completed KYC. Reminder emails dispatched.",   sentAt: "2026-06-05T08:00:00Z", read: true,  recipients: 892 },
  { id: "9",  type: "success", channel: "push",      title: "Dividend payments processed",          message: "NICO Holdings dividend of MWK 2.40 per share credited to 3,402 eligible portfolios.",            sentAt: "2026-06-04T14:22:00Z", read: true,  recipients: 3402 },
  { id: "10", type: "info",    channel: "broadcast", title: "New trading hours effective Monday",   message: "MSE trading hours will change from 09:00–12:00 to 09:00–13:00 effective 9 June 2026.",           sentAt: "2026-06-04T09:00:00Z", read: true,  recipients: 184203 },
  { id: "11", type: "alert",   channel: "email",     title: "AML flag: large transaction",         message: "A transaction of MWK 42M was flagged by AML rules. User U-90137 has been placed under review.",   sentAt: "2026-06-03T16:05:00Z", read: true,  recipients: 1 },
  { id: "12", type: "success", channel: "sms",       title: "Bulk withdrawal batch settled",        message: "1,984 withdrawal transactions totalling MWK 942M settled successfully via RTGS.",                sentAt: "2026-06-03T15:30:00Z", read: true,  recipients: 1984 },
];

/* ─────────────────────────── helpers ─────────────────────────── */

const NOW_UTC = Date.UTC(2026, 5, 6, 12, 0, 0);

function relativeTime(iso: string) {
  const diff = NOW_UTC - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* ─────────────────────────── config maps ─────────────────────────── */

const typeConfig: Record<NotifType, { icon: React.ComponentType<{ className?: string }>; iconCls: string; dotCls: string }> = {
  alert:   { icon: AlertTriangle, iconCls: "text-muted-foreground", dotCls: "bg-rose" },
  warning: { icon: AlertTriangle, iconCls: "text-muted-foreground", dotCls: "bg-amber" },
  success: { icon: CheckCircle2,  iconCls: "text-muted-foreground", dotCls: "bg-pine" },
  info:    { icon: Bell,          iconCls: "text-muted-foreground", dotCls: "bg-blue-500" },
};

const channelConfig: Record<Channel, { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }> = {
  push:      { icon: Smartphone,    label: "Push",      cls: "bg-blue-500/10 text-blue-500" },
  email:     { icon: Mail,          label: "Email",     cls: "bg-violet-500/10 text-violet-500" },
  sms:       { icon: MessageSquare, label: "SMS",       cls: "bg-amber/10 text-amber" },
  broadcast: { icon: Megaphone,     label: "Broadcast", cls: "bg-pine/10 text-pine" },
};

const segments = ["All Users", "Active Traders", "Tier 1 Users", "Tier 2 Users", "Inactive 30d", "New Signups", "KYC Pending"];

/* ─────────────────────────── page ─────────────────────────── */

function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>(notifications);
  const [compose, setCompose] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unread = items.filter((n) => !n.read).length;
  const visible = filter === "unread" ? items.filter((n) => !n.read) : items;

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  return (
    <AdminShell activeLabel="Notifications" eyebrow="Engagement" title="Notifications">
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
            value={items.filter((n) => relativeTime(n.sentAt).endsWith("h ago") || relativeTime(n.sentAt).endsWith("m ago")).length}
            sub="notifications dispatched"
          />
          <SummaryCard
            icon={Clock}
            label="Scheduled"
            value={12}
            sub="pending delivery"
          />
        </div>

        {/* Feed */}
        <Card
          title="Notification Feed"
          action={
            <div className="flex items-center gap-2">
              {/* Filter toggle */}
              <div className="flex items-center rounded-lg border border-border overflow-hidden text-[12px]">
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
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-pine text-primary-foreground text-[12px] font-medium hover:bg-pine/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Send
              </button>
            </div>
          }
        >
          {visible.length === 0 ? (
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
    </AdminShell>
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
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? "bg-rose/10" : "bg-muted"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-rose" : "text-muted-foreground"}`} />
        </div>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

/* ─────────────────────────── feed item ─────────────────────────── */

function NotifItem({ notif: n, onRead }: { notif: Notif; onRead: (id: string) => void }) {
  const tc = typeConfig[n.type];
  const cc = channelConfig[n.channel];
  const TypeIcon = tc.icon;
  const ChanIcon = cc.icon;

  return (
    <li
      className={`flex items-start gap-4 px-5 py-4 transition-colors cursor-pointer hover:bg-muted/30 ${!n.read ? "bg-muted/10" : ""}`}
      onClick={() => onRead(n.id)}
    >
      {/* Type icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${!n.read ? "bg-muted" : "bg-muted/40"}`}>
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
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cc.cls}`}>
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
  const [segment, setSegment] = useState("All Users");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const canSend = body.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="font-semibold text-[15px]">Send Notification</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
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
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[11px] font-medium transition-colors ${
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
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-pine/40"
            >
              {segments.map((s) => <option key={s}>{s}</option>)}
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
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-pine/40"
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
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-pine/40 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/40"
          >
            Cancel
          </button>
          <button
            disabled={!canSend}
            onClick={onClose}
            className="h-9 px-4 rounded-lg bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Send Now
          </button>
        </div>
      </div>
    </div>
  );
}
