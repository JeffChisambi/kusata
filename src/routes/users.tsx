import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo, useState, useEffect, useRef } from "react";
import { z } from "zod";
import {
  Search, Filter, Download, UserPlus, MoreHorizontal, Shield, ShieldAlert,
  ShieldCheck, CircleUser, Mail, Phone, MapPin, Calendar, Fingerprint,
  Smartphone, Wallet, Landmark, Activity, Ban, Snowflake, CheckCircle2,
  XCircle, Clock, ArrowUpRight, ArrowDownRight, KeyRound, LogOut, RefreshCw,
  FileText, ChevronRight, ChevronDown, Building2, CreditCard, Users, UserCheck, UserX,
  Eye, Copy, ExternalLink, TrendingUp, TrendingDown, Trash2,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import {
  useUsersList, useUpdateUserStatus, useRevokeUserSessions, useDeleteUser, useUpdateUserKycStatus,
  useUserWorkspace, useNotifyUser, useRevokeDevice, useUntrustDevice,
  type UserWorkspace,
} from "@/hooks/useUsers";

const searchSchema = z.object({
  tab: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "User Management — Pine Broker Admin" },
      { name: "description", content: "Search, filter and manage all brokerage users, KYC, devices, banks and activity." },
      { property: "og:title", content: "User Management — Pine" },
      { property: "og:description", content: "Broker admin user directory, filters, and full user 360°." },
    ],
  }),
  validateSearch: searchSchema,
  component: UsersPage,
});

/* -------------------- types -------------------- */

type Status = "active" | "frozen" | "suspended" | "closed" | "pending";
type Kyc = "verified" | "pending" | "rejected" | "tier1" | "tier2";
type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  status: Status;
  kyc: Kyc;
  /** Total assets = cash + portfolio market value (server-computed) */
  aum: number;
  /** Market value of stock holdings (server-computed) */
  portfolio: number;
  cash: number;
  joined: string;
  lastLogin: string;
  trades30d: number;
  devices: number;
  banks: number;
  mfa: boolean;
};

// Map backend kycStatus → UI kyc display
function mapKyc(kycStatus: string): Kyc {
  switch (kycStatus) {
    case 'APPROVED': return 'verified';
    case 'PENDING': return 'pending';
    case 'REJECTED': return 'rejected';
    case 'NOT_SUBMITTED': return 'pending';
    default: return 'pending';
  }
}

// Map backend user → UserRow
function mapUserRow(u: any): UserRow {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email || '',
    phone: u.phone || '',
    city: '', // Backend doesn't have city
    status: u.walletFrozen ? 'frozen' : u.isActive ? 'active' : 'closed',
    kyc: mapKyc(u.kycStatus),
    aum: Number(u.totalAssets ?? 0),
    portfolio: Number(u.portfolioValue ?? 0),
    cash: parseFloat(u.walletBalance || '0'),
    joined: u.createdAt?.slice(0, 10) ?? '',
    lastLogin: '',
    trades30d: u.orderCount || 0,
    devices: u.deviceCount || 0,
    banks: 0,
    mfa: false,
  };
}

const tabs: { key: string; label: string; filter: (u: UserRow) => boolean }[] = [
  { key: "all", label: "All Users", filter: () => true },
  { key: "active", label: "Active", filter: (u) => u.status === "active" },
  { key: "frozen", label: "Frozen", filter: (u) => u.status === "frozen" },
  { key: "suspended", label: "Suspended", filter: (u) => u.status === "suspended" },
  { key: "closed", label: "Closed", filter: (u) => u.status === "closed" },
];

const MWKexact = (n: number) =>
  `MWK ${n.toLocaleString("en-MW", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const MWK = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}B` :
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toString();

/* -------------------- page -------------------- */

function UsersPage() {
  const search = useSearch({ from: "/users" });
  const navigate = useNavigate();
  const initialTab = tabs.find((t) => t.key === search.tab)?.key ?? "all";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [q] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Fetch real users from API
  const { data: apiData, isLoading } = useUsersList({ limit: 100 });
  const users: UserRow[] = useMemo(
    () => (apiData?.users ?? []).map(mapUserRow),
    [apiData],
  );

  const filtered = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab)!;
    return users.filter((u) =>
      tab.filter(u) &&
      (!q || (u.name + u.email + u.id + u.phone).toLowerCase().includes(q.toLowerCase()))
    );
  }, [activeTab, q, users]);

  const toggle = (id: string) => {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
  };

  return (
    <>
      <UserStats users={users} />

      <div className="flex gap-4 items-start">
        {/* Main table */}
        <div className="flex-1 min-w-0">
          <Card>
            <Toolbar selectedCount={checked.size} />
            <UsersTable
              rows={filtered}
              checked={checked}
              onCheck={toggle}
              onSelectAll={() => setChecked(new Set(filtered.map((r) => r.id)))}
              onClear={() => setChecked(new Set())}
              onOpenDrawer={(u) => navigate({ to: "/users/$userId", params: { userId: u.id } })}
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              tabCounts={tabs.map((t) => users.filter(t.filter).length)}
            />
            <TableFooter total={filtered.length} />
          </Card>
        </div>
      </div>
    </>
  );
}

/* -------------------- pieces -------------------- */

function UserStats({ users }: { users: UserRow[] }) {
  const totalUsers = users.length;
  const active = users.filter((u) => u.status === "active").length;
  const verified = users.filter((u) => u.kyc === "verified").length;
  const pending = users.filter((u) => u.kyc === "pending").length;
  const frozen = users.filter((u) => u.status === "frozen").length;

  const combined = [
    { label: "Total users", value: totalUsers.toLocaleString(), sub: `${totalUsers} loaded`, trend: "live", up: true },
    { label: "Active", value: active.toLocaleString(), sub: `${Math.round(totalUsers ? (active / totalUsers) * 100 : 0)}% of total`, trend: totalUsers ? `${Math.round((active / totalUsers) * 100)}%` : "—", up: true },
    { label: "Verified", value: verified.toLocaleString(), sub: `${Math.round(totalUsers ? (verified / totalUsers) * 100 : 0)}% verified`, trend: totalUsers ? `${Math.round((verified / totalUsers) * 100)}%` : "—", up: true },
  ] as const;

  const items = [
    { icon: Clock, label: "Pending KYC", value: pending.toLocaleString(), sub: pending > 0 ? "Awaiting review" : "None pending", tone: pending > 0 ? "amber" : "pine", trend: pending > 0 ? "queue" : "clear", up: false },
  ] as const;

  return (
    <div className="flex gap-4 pt-6">
      {combined.map((it) => (
        <div key={it.label} className="flex-1 min-w-0 rounded-[3px] bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 flex items-center justify-center text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pine">
              <TrendingUp className="w-3 h-3" /> {it.trend}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xs text-muted-foreground">{it.label}</div>
            <div className="text-xl font-bold mt-0.5">{it.value}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{it.sub}</div>
          </div>
        </div>
      ))}
      {items.map((it) => {
        const Icon = it.icon;
        const toneMap = { pine: "text-pine bg-pine/10", amber: "text-amber bg-amber/10", rose: "text-rose bg-rose/10" }[it.tone];
        const Trend = it.up ? TrendingUp : TrendingDown;
        return (
          <div key={it.label} className="flex-1 min-w-0 rounded-[3px] bg-card border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 flex items-center justify-center text-muted-foreground">
                <Icon className="w-4 h-4" />
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${it.up ? "text-pine" : "text-amber"}`}>
                <Trend className="w-3 h-3" /> {it.trend}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <div className="text-xl font-bold mt-0.5">{it.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{it.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabDropdown({
  tabs, active, onChange, counts,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
  counts: number[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeIdx = tabs.findIndex((t) => t.key === active);
  const activeTab = tabs[activeIdx];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-pine transition-colors"
      >
        {activeTab?.label}
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pine/10 text-pine leading-none">
          {counts[activeIdx] ?? 0}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[11rem] rounded-[3px] border border-border bg-card shadow-lg overflow-hidden py-1">
          {tabs.map((t, i) => (
            <button
              key={t.key}
              onClick={() => { onChange(t.key); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-4 transition-colors ${
                t.key === active ? "bg-pine/10 text-pine font-medium" : "text-foreground hover:bg-muted/50"
              }`}
            >
              {t.label}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none ${
                t.key === active ? "bg-pine/20 text-pine" : "bg-muted text-muted-foreground"
              }`}>
                {counts[i]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toolbar({ selectedCount }: { selectedCount: number }) {
  if (selectedCount === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="ml-auto flex items-center gap-2">
        <BulkActions count={selectedCount} />
      </div>
    </div>
  );
}

function SelectPill({
  icon: Icon, value, onChange, options,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = options.find(([v]) => v === value)?.[1];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-[3px] border text-sm transition-colors cursor-pointer ${
          open ? "border-pine/40 bg-pine/5 text-pine" : "border-border hover:bg-muted/40 text-foreground"
        }`}
      >
        <Icon className={`w-4 h-4 ${open ? "text-pine" : "text-muted-foreground"}`} />
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180 text-pine" : "text-muted-foreground"}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[9rem] rounded-[3px] border border-border bg-card shadow-lg overflow-hidden py-1">
          {options.map(([v, l]) => (
            <button
              key={v}
              onClick={() => { onChange(v); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                v === value
                  ? "bg-pine/10 text-pine font-medium"
                  : "text-foreground hover:bg-muted/50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BulkActions({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1 pr-2 mr-1 border-r border-border">
      <span className="text-xs text-muted-foreground mr-2">{count} selected</span>
      <BulkBtn icon={Mail} label="Message" />
      <BulkBtn icon={Snowflake} label="Freeze" tone="amber" />
      <BulkBtn icon={Ban} label="Suspend" tone="rose" />
      <BulkBtn icon={Download} label="Export" />
    </div>
  );
}
function BulkBtn({
  icon: Icon, label, tone,
}: { icon: React.ComponentType<{ className?: string }>; label: string; tone?: "amber" | "rose" }) {
  const cls = tone === "rose" ? "hover:bg-rose/10 hover:text-rose"
    : tone === "amber" ? "hover:bg-amber/10 hover:text-amber"
    : "hover:bg-muted/50";
  return (
    <button className={`h-8 px-2 rounded-[3px] text-xs flex items-center gap-1.5 text-muted-foreground ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

/* -------------------- table -------------------- */

function UsersTable({
  rows, checked, onCheck, onSelectAll, onClear, onOpenDrawer,
  tabs, activeTab, onTabChange, tabCounts,
}: {
  rows: UserRow[];
  checked: Set<string>;
  onCheck: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onOpenDrawer: (u: UserRow) => void;
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (k: string) => void;
  tabCounts: number[];
}) {
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  return (
    <div className="-mt-5 -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-border bg-muted/30">
            <th className="pl-5 py-2.5 text-left">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={() => (allChecked ? onClear() : onSelectAll())}
                className="accent-pine"
              />
            </th>
            <th className="py-2.5 text-left font-normal">
              <TabDropdown tabs={tabs} active={activeTab} onChange={onTabChange} counts={tabCounts} />
            </th>
            <th className="py-2.5 text-left font-medium text-[11px] uppercase tracking-wider text-muted-foreground">Status</th>
            <th className="py-2.5 text-left font-medium text-[11px] uppercase tracking-wider text-muted-foreground">KYC</th>
            <th className="py-2.5 text-right font-medium text-[11px] uppercase tracking-wider text-muted-foreground" title="Market value of stock holdings at the latest close">Portfolio</th>
            <th className="py-2.5 text-right font-medium text-[11px] uppercase tracking-wider text-muted-foreground" title="Uninvested wallet cash held for the client">Cash</th>
            <th className="py-2.5 text-right font-medium text-[11px] uppercase tracking-wider text-muted-foreground" title="Total assets = cash + portfolio market value">Total</th>
            <th className="pr-5 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
              <td className="pl-5 py-3">
                <input
                  type="checkbox"
                  checked={checked.has(r.id)}
                  onChange={() => onCheck(r.id)}
                  className="accent-pine"
                />
              </td>
              <td className="py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={r.name} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                  </div>
                </div>
              </td>
              <td className="py-3"><StatusBadge status={r.status} /></td>
              <td className="py-3"><KycBadge kyc={r.kyc} /></td>
              <td className="py-3 text-right font-mono cursor-help" title={MWKexact(r.portfolio)}>MWK {MWK(r.portfolio)}</td>
              <td className="py-3 text-right font-mono text-muted-foreground cursor-help" title={MWKexact(r.cash)}>MWK {MWK(r.cash)}</td>
              <td className="py-3 text-right font-mono font-medium cursor-help" title={MWKexact(r.aum)}>MWK {MWK(r.aum)}</td>
              <td className="pr-5 py-3 text-right">
                <RowMenu onViewMore={() => onOpenDrawer(r)} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">No users match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((s) => s[0]).join("");
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 bg-gray-400"
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { cls: string; label: string; dot: string }> = {
    active: { cls: "bg-pine/10 text-pine", label: "Active", dot: "bg-pine" },
    pending: { cls: "bg-amber/10 text-amber", label: "Pending", dot: "bg-amber" },
    frozen: { cls: "bg-amber/10 text-amber", label: "Frozen", dot: "bg-amber" },
    suspended: { cls: "bg-rose/10 text-rose", label: "Suspended", dot: "bg-rose" },
    closed: { cls: "bg-muted text-muted-foreground", label: "Closed", dot: "bg-muted-foreground" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
}

function KycBadge({ kyc }: { kyc: Kyc }) {
  const map: Record<Kyc, { cls: string; label: string }> = {
    verified: { cls: "bg-pine/10 text-pine", label: "Verified" },
    tier2: { cls: "bg-pine/10 text-pine", label: "Tier 2" },
    tier1: { cls: "bg-muted text-foreground", label: "Tier 1" },
    pending: { cls: "bg-amber/10 text-amber", label: "Pending" },
    rejected: { cls: "bg-rose/10 text-rose", label: "Rejected" },
  };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${map[kyc].cls}`}>{map[kyc].label}</span>;
}

function TableFooter({ total }: { total: number }) {
  return (
    <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
      <div>Showing <span className="text-foreground font-medium">1–{Math.min(total, 25)}</span> of {total.toLocaleString()}</div>
      <div className="flex items-center gap-1">
        <button className="h-8 px-3 rounded-[3px] border border-border hover:bg-muted/40">Previous</button>
        <button className="h-8 w-8 rounded-[3px] bg-pine text-primary-foreground">1</button>
        <button className="h-8 w-8 rounded-[3px] hover:bg-muted/40">2</button>
        <button className="h-8 w-8 rounded-[3px] hover:bg-muted/40">3</button>
        <span className="px-1">…</span>
        <button className="h-8 px-3 rounded-[3px] border border-border hover:bg-muted/40">Next</button>
      </div>
    </div>
  );
}

/* -------------------- row context menu -------------------- */

function RowMenu({ onViewMore }: { onViewMore: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-md hover:bg-muted/60 inline-flex items-center justify-center"
      >
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-[3px] border border-border bg-card shadow-lg py-1 overflow-hidden">
          <button
            onClick={() => { onViewMore(); setOpen(false); }}
            className="w-full text-left px-3.5 py-2 text-sm text-foreground hover:bg-muted/60 flex items-center gap-2.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View more
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------- user modal -------------------- */

function UserModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background rounded-[3px] shadow-2xl border border-border overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <UserDetails user={user} onClose={onClose} />
      </div>
    </div>
  );
}

/* -------------------- user 360 panel -------------------- */

function UserDetails({ user: initialUser, onClose }: { user: UserRow; onClose?: () => void }) {
  const [tab, setTab] = useState<"profile" | "kyc" | "devices" | "banks" | "activity">("profile");
  const [user, setUser] = useState(initialUser);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);

  const updateStatus   = useUpdateUserStatus();
  const revokeSessions = useRevokeUserSessions();
  const deleteUser     = useDeleteUser();
  const notifyUser     = useNotifyUser();
  const navigate       = useNavigate();

  // Hydrate the drawer with real, aggregated data (portfolio, wallet, MFA,
  // devices, banks, activity) instead of the list row's partial fields.
  const { data: ws, isLoading: wsLoading } = useUserWorkspace(user.id);

  const [showMessage, setShowMessage] = useState(false);

  // Derived real stats from the workspace payload.
  const portfolioValue = (ws?.holdings ?? []).reduce(
    (sum, h) => sum + Number(h.quantity) * Number(h.averageCost), 0,
  );
  const cashValue    = ws?.wallet ? Number(ws.wallet.balance) : user.cash;
  const tradeCount   = ws?._count?.orders ?? user.trades30d;
  const mfaEnabled   = ws?.mfaConfig?.isEnabled ?? false;
  const latestKycId  = ws?.kycApplications?.[0]?.id ?? null;

  const showToast = (msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const handleView = () => {
    if (latestKycId) navigate({ to: "/kyc/$applicationId", params: { applicationId: latestKycId } });
    else showToast("No KYC application to view", "err");
  };

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); }
    catch (e: any) { showToast(e?.message ?? "Error", "err"); }
    finally { setBusy(null); }
  };

  const handleFreeze = () => act("freeze", async () => {
    const wasFrozen = user.status === "frozen";
    await updateStatus.mutateAsync({ userId: user.id, status: wasFrozen ? "active" : "frozen" });
    setUser(u => ({ ...u, status: wasFrozen ? "active" : "frozen" }));
    showToast(wasFrozen ? "Wallet unfrozen" : "Wallet frozen");
  });

  const handleSuspend = () => {
    if (!confirm(`Suspend ${user.name}? They will be unable to log in.`)) return;
    act("suspend", async () => {
      await updateStatus.mutateAsync({ userId: user.id, status: "deactivated" });
      setUser(u => ({ ...u, status: "suspended" }));
      showToast("User suspended");
    });
  };

  const handleRevoke = () => act("revoke", async () => {
    await revokeSessions.mutateAsync(user.id);
    showToast("All sessions revoked — user will be logged out");
  });

  const handleDelete = () => {
    if (!confirm(`PERMANENTLY DELETE ${user.name}?\n\nThis cannot be undone. All data will be erased.`)) return;
    act("delete", async () => {
      await deleteUser.mutateAsync(user.id);
      showToast("User deleted");
      onClose?.();
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin-pine relative">
      {/* Toast */}
      {toast && (
        <div className={`absolute top-3 left-3 right-3 z-50 rounded-[3px] px-3 py-2 text-xs font-medium border ${
          toast.tone === "ok" ? "bg-pine/10 text-pine border-pine/30" : "bg-rose/10 text-rose border-rose/30"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="p-5 border-b border-border shrink-0">
        <div className="flex items-start gap-3">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold truncate">{user.name}</div>
              <StatusBadge status={user.status} />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <span className="font-mono">{user.id.slice(0, 8)}…</span>
              <button onClick={() => navigator.clipboard.writeText(user.id)} className="hover:text-foreground" title="Copy ID">
                <Copy className="w-3 h-3" />
              </button>
              <span>·</span>
              <span>Joined {user.joined}</span>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-muted/60 inline-flex items-center justify-center text-muted-foreground">
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action grid */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <QuickAction icon={Eye}       label="View"            onClick={handleView} />
          <QuickAction icon={Mail}      label="Message"         onClick={() => setShowMessage(true)} />
          <QuickAction icon={LogOut}    label="Revoke Sessions" tone="amber" busy={busy === "revoke"}  onClick={handleRevoke}  />
          <QuickAction icon={Snowflake} label={user.status === "frozen" ? "Unfreeze" : "Freeze"} tone="amber" busy={busy === "freeze"}  onClick={handleFreeze}  />
          <QuickAction icon={Ban}       label="Suspend"         tone="rose"  busy={busy === "suspend"} onClick={handleSuspend} />
          <QuickAction icon={Trash2}    label="Delete User"     tone="rose"  busy={busy === "delete"}  onClick={handleDelete}  />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <MiniStat icon={Wallet}   label="Portfolio"  value={wsLoading ? "…" : `MWK ${MWK(portfolioValue)}`} />
          <MiniStat icon={Landmark} label="Cash"       value={`MWK ${MWK(cashValue)}`} />
          <MiniStat icon={Activity} label="Trades"     value={wsLoading ? "…" : String(tradeCount)} />
          <MiniStat icon={Shield}   label="MFA"        value={wsLoading ? "…" : (mfaEnabled ? "Enabled" : "Off")} tone={mfaEnabled ? "pine" : "amber"} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex items-center gap-1 px-5 overflow-x-auto shrink-0">
        {(["profile", "kyc", "devices", "banks", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative py-2.5 text-xs font-medium capitalize px-2 ${
              tab === t ? "text-pine" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "kyc" ? "KYC" : t}
            {tab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5 flex-1">
        {tab === "profile"  && <ProfileTab user={user} ws={ws} />}
        {tab === "kyc"      && <KycTab user={user} onStatusChange={(s) => setUser(u => ({ ...u, kyc: s as any }))} />}
        {tab === "devices"  && <DevicesTab userId={user.id} ws={ws} loading={wsLoading} onToast={showToast} />}
        {tab === "banks"    && <BanksTab ws={ws} loading={wsLoading} />}
        {tab === "activity" && <ActivityTab ws={ws} loading={wsLoading} />}
      </div>

      {showMessage && (
        <MessageDialog
          userName={user.name}
          onClose={() => setShowMessage(false)}
          onSend={async (title, message, channel) => {
            await notifyUser.mutateAsync({ userId: user.id, title, message, channel });
            showToast("Message sent to user");
            setShowMessage(false);
          }}
          sending={notifyUser.isPending}
        />
      )}
    </div>
  );
}

/* -------------------- message dialog -------------------- */
function MessageDialog({
  userName, onClose, onSend, sending,
}: {
  userName: string;
  onClose: () => void;
  onSend: (title: string, message: string, channel: string) => Promise<void>;
  sending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("IN_APP");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-[4px] bg-card border border-border p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-1">Message {userName}</h3>
        <p className="text-xs text-muted-foreground mb-4">Sends a direct notification to this user.</p>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Channel</label>
            <div className="grid grid-cols-2 gap-2">
              {[["IN_APP", "In-app"], ["PUSH", "Push"]].map(([v, l]) => (
                <button key={v} onClick={() => setChannel(v)}
                  className={`h-9 rounded-[3px] border text-xs font-medium ${channel === v ? "border-pine/50 bg-pine/5 text-pine" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)"
            className="w-full h-9 px-3 rounded-[3px] border border-border bg-transparent text-sm focus:outline-none focus:border-pine/40" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Message…"
            className="w-full px-3 py-2.5 rounded-[3px] border border-border bg-transparent text-sm resize-none focus:outline-none focus:border-pine/40" />
          {err && <p className="text-xs text-rose">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40">Cancel</button>
          <button
            disabled={!message.trim() || sending}
            onClick={async () => {
              setErr(null);
              try { await onSend(title.trim(), message.trim(), channel); }
              catch (e: any) { setErr(e?.message ?? "Failed to send."); }
            }}
            className="h-8 px-4 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Send
          </button>
        </div>
      </div>
    </div>
  );
}


function QuickAction({
  icon: Icon, label, tone, onClick, busy,
}: { icon: React.ComponentType<{ className?: string }>; label: string; tone?: "amber" | "rose"; onClick?: () => void; busy?: boolean }) {
  const cls =
    tone === "amber" ? "hover:bg-amber/10 hover:text-amber hover:border-amber/30" :
    tone === "rose" ? "hover:bg-rose/10 hover:text-rose hover:border-rose/30" :
    "hover:bg-muted/40";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex flex-col items-center gap-1 py-2.5 rounded-[3px] border border-border text-[11px] text-muted-foreground transition-colors disabled:opacity-50 ${cls}`}
    >
      {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

function MiniStat({
  icon: Icon, label, value, tone = "pine",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; tone?: "pine" | "amber" | "rose";
}) {
  const toneMap = { pine: "text-pine bg-pine/10", amber: "text-amber bg-amber/10", rose: "text-rose bg-rose/10" }[tone];
  return (
    <div className="rounded-[3px] border border-border p-2.5 flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${toneMap}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-xs font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon, label, value, action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-sm truncate">{value}</div>
      </div>
      {action}
    </div>
  );
}

function ProfileTab({ user, ws }: { user: UserRow; ws?: UserWorkspace }) {
  const walletState = ws?.wallet ? (ws.wallet.isFrozen ? "Frozen" : "Active") : "—";
  const holdingsCount = ws?.holdings?.length ?? 0;
  return (
    <div>
      <Row icon={Mail} label="Email" value={ws?.email ?? user.email} action={<Copy className="w-3.5 h-3.5 text-muted-foreground" />} />
      <Row icon={Phone} label="Phone" value={ws?.phone ?? user.phone} />
      <Row icon={Calendar} label="Joined" value={ws?.createdAt ? fmtJoined(ws.createdAt) : user.joined} />
      <Row icon={Shield} label="Account" value={ws ? (ws.isActive ? "Active" : "Deactivated") : "—"} />
      <Row icon={Wallet} label="Wallet" value={walletState} />
      <Row icon={Activity} label="Holdings" value={`${holdingsCount} position${holdingsCount === 1 ? "" : "s"}`} />
      <Row icon={CircleUser} label="User ID" value={<span className="font-mono text-xs">{user.id}</span>} />
    </div>
  );
}

function fmtJoined(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtWhen(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function KycTab({ user, onStatusChange }: { user: UserRow; onStatusChange?: (s: string) => void }) {
  const updateKyc = useUpdateUserKycStatus();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const doKyc = async (status: string, label: string) => {
    setBusy(status);
    try {
      await updateKyc.mutateAsync({ userId: user.id, status });
      const mapped = status === "APPROVED" ? "verified" : status === "REJECTED" ? "rejected" : "pending";
      onStatusChange?.(mapped);
      setToast(`${label} ✓`);
      setTimeout(() => setToast(null), 2500);
    } catch (e: any) {
      setToast(e?.message ?? "Error");
      setTimeout(() => setToast(null), 3000);
    } finally { setBusy(null); }
  };

  const steps = [
    { label: "Email verified", ok: true },
    { label: "Phone verified", ok: true },
    { label: "ID document", ok: user.kyc !== "pending" },
    { label: "Face verification", ok: user.kyc === "verified" || user.kyc === "tier2" },
    { label: "Proof of address", ok: user.kyc === "tier2" },
    { label: "Source of funds", ok: user.kyc === "tier2" },
  ];

  return (
    <div>
      {toast && (
        <div className="mb-3 rounded-[3px] px-3 py-2 text-xs font-medium bg-pine/10 text-pine border border-pine/20">{toast}</div>
      )}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-muted-foreground">Current tier</div>
          <div className="text-sm font-semibold flex items-center gap-2 mt-0.5">
            <KycBadge kyc={user.kyc} />
            {user.kyc === "pending" && <span className="text-amber text-xs">awaiting review</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs h-8 px-3 rounded-md border border-border hover:bg-muted/40 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Documents
          </button>
          <button
            onClick={() => doKyc("APPROVED", "KYC approved")}
            disabled={!!busy || user.kyc === "verified"}
            className="text-xs h-8 px-3 rounded-md bg-pine text-primary-foreground flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy === "APPROVED" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Approve
          </button>
        </div>
      </div>
      <ul className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm py-1">
            {s.ok
              ? <CheckCircle2 className="w-4 h-4 text-pine" />
              : <XCircle className="w-4 h-4 text-muted-foreground" />}
            <span className={s.ok ? "" : "text-muted-foreground"}>{s.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2">
        <button
          onClick={() => doKyc("PENDING", "Additional docs requested")}
          disabled={!!busy}
          className="text-xs h-8 rounded-md border border-border hover:bg-muted/40 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {busy === "PENDING" && <RefreshCw className="w-3 h-3 animate-spin" />}
          Request additional docs
        </button>
        <button
          onClick={() => { if (confirm("Reject this KYC application?")) doKyc("REJECTED", "KYC rejected"); }}
          disabled={!!busy || user.kyc === "rejected"}
          className="text-xs h-8 rounded-md border border-rose/30 text-rose hover:bg-rose/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {busy === "REJECTED" && <RefreshCw className="w-3 h-3 animate-spin" />}
          Reject
        </button>
      </div>
    </div>
  );
}

function DevicesTab({
  userId, ws, loading, onToast,
}: {
  userId: string; ws?: UserWorkspace; loading: boolean;
  onToast: (msg: string, tone?: "ok" | "err") => void;
}) {
  const revokeDevice = useRevokeDevice();
  const untrustDevice = useUntrustDevice();
  const [busy, setBusy] = useState<string | null>(null);

  const devices = (ws?.devices ?? []).filter((d) => !d.isRevoked);

  if (loading) return <TabLoading />;
  if (devices.length === 0) return <TabEmpty icon={Smartphone} text="No active devices." />;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); onToast(ok); }
    catch (e: any) { onToast(e?.message ?? "Error", "err"); }
    finally { setBusy(null); }
  };

  return (
    <ul className="space-y-2">
      {devices.map((d) => {
        const name = [d.platform, d.osVersion].filter(Boolean).join(" · ") || "Unknown device";
        const trusted = d.trustLevel === "TRUSTED";
        const meta = [d.lastSeenIp, d.lastSeenCountry, fmtWhen(d.lastSeenAt)].filter(Boolean).join(" · ");
        return (
          <li key={d.id} className="rounded-[3px] border border-border p-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{meta}</div>
              </div>
              {trusted
                ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-pine/10 text-pine">Trusted</span>
                : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber/10 text-amber">Untrusted</span>}
            </div>
            <div className="mt-2 flex items-center gap-1">
              <button
                onClick={() => run(`so-${d.id}`, () => revokeDevice.mutateAsync({ userId, deviceId: d.id }), "Device signed out")}
                disabled={busy === `so-${d.id}`}
                className="text-xs h-7 px-2 rounded-[3px] border border-border hover:bg-muted/40 flex items-center gap-1 disabled:opacity-50"
              >
                {busy === `so-${d.id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />} Sign out
              </button>
              {trusted && (
                <button
                  onClick={() => run(`ut-${d.id}`, () => untrustDevice.mutateAsync({ userId, deviceId: d.id }), "Trust removed")}
                  disabled={busy === `ut-${d.id}`}
                  className="text-xs h-7 px-2 rounded-[3px] border border-border hover:bg-muted/40 disabled:opacity-50 flex items-center gap-1"
                >
                  {busy === `ut-${d.id}` && <RefreshCw className="w-3 h-3 animate-spin" />} Remove trust
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BanksTab({ ws, loading }: { ws?: UserWorkspace; loading: boolean }) {
  if (loading) return <TabLoading />;
  const banks = ws?.linkedBanks ?? [];
  if (banks.length === 0) return <TabEmpty icon={Landmark} text="No linked bank accounts." />;
  return (
    <ul className="space-y-2">
      {banks.map((b) => {
        const isMobileMoney = /airtel|mpamba|money|tnm/i.test(b.bankName);
        const Icon = isMobileMoney ? CreditCard : Building2;
        return (
          <li key={b.id} className="rounded-[3px] border border-border p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {b.bankName}
                {b.isPrimary && <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">Primary</span>}
              </div>
              <div className="text-xs text-muted-foreground truncate">{b.accountName} · <span className="font-mono">{b.accountNumberMasked}</span></div>
            </div>
            {b.isVerified
              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-pine/10 text-pine flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</span>
              : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber/10 text-amber">Unverified</span>}
          </li>
        );
      })}
    </ul>
  );
}

function ActivityTab({ ws, loading }: { ws?: UserWorkspace; loading: boolean }) {
  if (loading) return <TabLoading />;
  const txns = ws?.wallet?.transactions ?? [];
  if (txns.length === 0) return <TabEmpty icon={Activity} text="No recent wallet activity." />;

  const iconFor = (type: string) => {
    if (/DEPOSIT|CREDIT|DIVIDEND/.test(type)) return { Icon: ArrowUpRight, tone: "bg-pine/10 text-pine" };
    if (/WITHDRAW|DEBIT|FEE/.test(type)) return { Icon: ArrowDownRight, tone: "bg-amber/10 text-amber" };
    return { Icon: Activity, tone: "bg-muted text-muted-foreground" };
  };
  const label = (t: string) => t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <ol className="space-y-3">
      {txns.map((t) => {
        const { Icon, tone } = iconFor(t.type);
        return (
          <li key={t.id} className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-tight">{label(t.type)}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                MWK {MWK(Number(t.amount))}{t.description ? ` · ${t.description}` : ""} · {t.status.toLowerCase()}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground shrink-0">{fmtWhen(t.createdAt)}</div>
          </li>
        );
      })}
    </ol>
  );
}

function TabLoading() {
  return <div className="py-10 flex justify-center"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
}
function TabEmpty({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="py-10 flex flex-col items-center gap-2 text-center">
      <Icon className="w-7 h-7 text-muted-foreground/30" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
