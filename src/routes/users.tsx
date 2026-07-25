import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Fragment, useMemo, useState, useEffect, useRef } from "react";
import { z } from "zod";
import {
  Search, Filter, Download, UserPlus, MoreHorizontal, Shield, ShieldAlert,
  ShieldCheck, CircleUser, Mail, Phone, MapPin, Calendar, Fingerprint,
  Smartphone, Wallet, Landmark, Activity, Ban, Snowflake, CheckCircle2,
  XCircle, Clock, ArrowUpRight, ArrowDownRight, KeyRound, LogOut, RefreshCw,
  FileText, ChevronRight, ChevronDown, Building2, CreditCard, Users, UserCheck, UserX,
  Eye, Copy, ExternalLink, TrendingUp, TrendingDown,
} from "lucide-react";
import { AdminShell, Card } from "@/components/admin-shell";
import { RoleShell } from "@/components/role-shell";
import { useUsersList } from "@/hooks/useUsers";

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
type Risk = "low" | "medium" | "high";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  status: Status;
  kyc: Kyc;
  risk: Risk;
  aum: number;
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
    risk: 'low', // Default — risk scoring not implemented yet
    aum: 0,
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
  { key: "risk", label: "High risk", filter: (u) => u.risk === "high" },
];

const MWK = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}B` :
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toString();

/* -------------------- page -------------------- */

function UsersPage() {
  const search = useSearch({ from: "/users" });
  const initialTab = tabs.find((t) => t.key === search.tab)?.key ?? "all";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [q] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | Risk>("all");
  const [drawerUser, setDrawerUser] = useState<UserRow | null>(null);
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
      (riskFilter === "all" || u.risk === riskFilter) &&
      (!q || (u.name + u.email + u.id + u.phone).toLowerCase().includes(q.toLowerCase()))
    );
  }, [activeTab, riskFilter, q, users]);

  const toggle = (id: string) => {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
  };

  return (
    <RoleShell activeLabel="User Management" eyebrow="Clients" title="User Management">
      <UserStats users={users} />

      <Card>
        <Tabs
          tabs={tabs} active={activeTab} onChange={setActiveTab}
          counts={tabs.map((t) => users.filter(t.filter).length)}
        />
        <Toolbar
          riskFilter={riskFilter} setRiskFilter={setRiskFilter}
          selectedCount={checked.size}
        />
        <UsersTable
          rows={filtered}
          checked={checked}
          onCheck={toggle}
          onSelectAll={() => setChecked(new Set(filtered.map((r) => r.id)))}
          onClear={() => setChecked(new Set())}
          onOpenDrawer={setDrawerUser}
        />
        <TableFooter total={filtered.length} />
      </Card>

      {drawerUser && <UserModal user={drawerUser} onClose={() => setDrawerUser(null)} />}
    </RoleShell>
  );
}

/* -------------------- pieces -------------------- */

function UserStats({ users }: { users: UserRow[] }) {
  const totalUsers = users.length;
  const active = users.filter((u) => u.status === "active").length;
  const verified = users.filter((u) => u.kyc === "verified").length;
  const pending = users.filter((u) => u.kyc === "pending").length;
  const frozen = users.filter((u) => u.status === "frozen").length;
  const highRisk = users.filter((u) => u.risk === "high").length;

  const combined = [
    { label: "Total users", value: totalUsers.toLocaleString(), sub: `${totalUsers} loaded`, trend: "live", up: true },
    { label: "Active", value: active.toLocaleString(), sub: `${Math.round(totalUsers ? (active / totalUsers) * 100 : 0)}% of total`, trend: totalUsers ? `${Math.round((active / totalUsers) * 100)}%` : "—", up: true },
    { label: "Verified", value: verified.toLocaleString(), sub: `${Math.round(totalUsers ? (verified / totalUsers) * 100 : 0)}% verified`, trend: totalUsers ? `${Math.round((verified / totalUsers) * 100)}%` : "—", up: true },
  ] as const;

  const items = [
    { icon: Clock, label: "Pending KYC", value: pending.toLocaleString(), sub: pending > 0 ? "Awaiting review" : "None pending", tone: pending > 0 ? "amber" : "pine", trend: pending > 0 ? "queue" : "clear", up: false },
    { icon: Snowflake, label: "Frozen", value: frozen.toLocaleString(), sub: frozen > 0 ? "Accounts on hold" : "None frozen", tone: frozen > 0 ? "amber" : "pine", trend: frozen > 0 ? "hold" : "clear", up: false },
    { icon: ShieldAlert, label: "High risk", value: highRisk.toLocaleString(), sub: highRisk > 0 ? "Needs review" : "All clear", tone: highRisk > 0 ? "rose" : "pine", trend: highRisk > 0 ? "review" : "clear", up: false },
  ] as const;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 pt-6">
      <div className="col-span-2 md:col-span-3 rounded-xl bg-card border border-border p-4 flex gap-4 items-start">
        <div className="w-9 h-9 flex items-center justify-center text-muted-foreground shrink-0">
          <Users className="w-4 h-4" />
        </div>
        {combined.map((it, i) => (
          <Fragment key={it.label}>
            {i > 0 && <div className="w-px self-stretch bg-border shrink-0" />}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <span className="self-end inline-flex items-center gap-1 text-[11px] font-medium text-pine">
                <TrendingUp className="w-3 h-3" /> {it.trend}
              </span>
              <div>
                <div className="text-xs text-muted-foreground">{it.label}</div>
                <div className="text-xl font-bold mt-0.5">{it.value}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{it.sub}</div>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
      {items.map((it) => {
        const Icon = it.icon;
        const toneMap = { pine: "text-pine bg-pine/10", amber: "text-amber bg-amber/10", rose: "text-rose bg-rose/10" }[it.tone];
        const Trend = it.up ? TrendingUp : TrendingDown;
        return (
          <div key={it.label} className="rounded-xl bg-card border border-border p-4">
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

function Tabs({
  tabs, active, onChange, counts,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
  counts: number[];
}) {
  const activeTab = tabs.find((t) => t.key === active);
  return (
    <>
      {/* ── Dropdown on small screens ── */}
      <div className="sm:hidden -mt-2 -mx-5 px-5 pb-3 border-b border-border flex items-center gap-2">
        <label className="relative flex items-center gap-2 h-9 pl-3 pr-8 rounded-lg border border-border text-sm bg-background cursor-pointer flex-1">
          <span className="font-medium text-foreground truncate flex-1">
            {activeTab?.label}
          </span>
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pine/10 text-pine leading-none shrink-0">
            {counts[tabs.indexOf(activeTab!)]}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 absolute right-2" />
          <select
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
            value={active}
            onChange={(e) => onChange(e.target.value)}
          >
            {tabs.map((t, i) => (
              <option key={t.key} value={t.key}>{t.label} ({counts[i]})</option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Tab strip on sm+ screens ── */}
      <div className="hidden sm:flex items-center gap-1 border-b border-border -mt-2 -mx-5 px-5 pb-0">
        {tabs.map((t, i) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors ${
                isActive ? "text-pine" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${isActive ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"}`}>
                {counts[i]}
              </span>
              {isActive && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-pine rounded-full" />}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Toolbar({
  riskFilter, setRiskFilter,
  selectedCount,
}: {
  riskFilter: "all" | Risk; setRiskFilter: (v: "all" | Risk) => void;
  selectedCount: number;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">

      <div className="ml-auto flex items-center gap-2">
        {selectedCount > 0 && <BulkActions count={selectedCount} />}
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
        className={`flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg border text-sm transition-colors cursor-pointer ${
          open ? "border-pine/40 bg-pine/5 text-pine" : "border-border hover:bg-muted/40 text-foreground"
        }`}
      >
        <Icon className={`w-4 h-4 ${open ? "text-pine" : "text-muted-foreground"}`} />
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180 text-pine" : "text-muted-foreground"}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[9rem] rounded-xl border border-border bg-card shadow-lg overflow-hidden py-1">
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
    <button className={`h-8 px-2 rounded-md text-xs flex items-center gap-1.5 text-muted-foreground ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

/* -------------------- table -------------------- */

function UsersTable({
  rows, checked, onCheck, onSelectAll, onClear, onOpenDrawer,
}: {
  rows: UserRow[];
  checked: Set<string>;
  onCheck: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onOpenDrawer: (u: UserRow) => void;
}) {
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  return (
    <div className="mt-4 -mx-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border bg-muted/30">
            <th className="pl-5 py-2 text-left">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={() => (allChecked ? onClear() : onSelectAll())}
                className="accent-pine"
              />
            </th>
            <th className="py-2 text-left font-medium">User</th>
            <th className="py-2 text-left font-medium">Status</th>
            <th className="py-2 text-left font-medium">Risk</th>
            <th className="py-2 text-right font-medium">AUM</th>
            <th className="py-2 text-right font-medium">Cash</th>
            <th className="pr-5 py-2"></th>
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
              <td className="py-3"><RiskBadge risk={r.risk} /></td>
              <td className="py-3 text-right font-mono">MWK {MWK(r.aum)}</td>
              <td className="py-3 text-right font-mono text-muted-foreground">MWK {MWK(r.cash)}</td>
              <td className="pr-5 py-3 text-right">
                <RowMenu onViewMore={() => onOpenDrawer(r)} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">No users match these filters.</td></tr>
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

function RiskBadge({ risk }: { risk: Risk }) {
  const map: Record<Risk, string> = {
    low: "bg-pine/10 text-pine",
    medium: "bg-amber/10 text-amber",
    high: "bg-rose/10 text-rose",
  };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded capitalize ${map[risk]}`}>{risk}</span>;
}

function TableFooter({ total }: { total: number }) {
  return (
    <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
      <div>Showing <span className="text-foreground font-medium">1–{Math.min(total, 25)}</span> of {total.toLocaleString()}</div>
      <div className="flex items-center gap-1">
        <button className="h-8 px-3 rounded-md border border-border hover:bg-muted/40">Previous</button>
        <button className="h-8 w-8 rounded-md bg-pine text-primary-foreground">1</button>
        <button className="h-8 w-8 rounded-md hover:bg-muted/40">2</button>
        <button className="h-8 w-8 rounded-md hover:bg-muted/40">3</button>
        <span className="px-1">…</span>
        <button className="h-8 px-3 rounded-md border border-border hover:bg-muted/40">Next</button>
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
        <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl border border-border bg-card shadow-lg py-1 overflow-hidden">
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
      <div className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <UserDetails user={user} onClose={onClose} />
      </div>
    </div>
  );
}

/* -------------------- user 360 panel -------------------- */

function UserDetails({ user, onClose }: { user: UserRow; onClose?: () => void }) {
  const [tab, setTab] = useState<"profile" | "kyc" | "devices" | "banks" | "activity">("profile");
  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin-pine">
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
              <span>{user.id}</span>
              <button className="hover:text-foreground"><Copy className="w-3 h-3" /></button>
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

        <div className="mt-4 grid grid-cols-3 gap-2">
          <QuickAction icon={Eye} label="View" />
          <QuickAction icon={Mail} label="Message" />
          <QuickAction icon={KeyRound} label="Reset PW" />
          <QuickAction icon={Fingerprint} label="Reset MFA" />
          <QuickAction icon={Snowflake} label="Freeze" tone="amber" />
          <QuickAction icon={Ban} label="Suspend" tone="rose" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <MiniStat icon={Wallet} label="Portfolio" value={`MWK ${MWK(user.aum)}`} />
          <MiniStat icon={Landmark} label="Cash" value={`MWK ${MWK(user.cash)}`} />
          <MiniStat icon={Activity} label="30d trades" value={String(user.trades30d)} />
          <MiniStat icon={Shield} label="MFA" value={user.mfa ? "Enabled" : "Off"} tone={user.mfa ? "pine" : "amber"} />
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
        {tab === "profile" && <ProfileTab user={user} />}
        {tab === "kyc" && <KycTab user={user} />}
        {tab === "devices" && <DevicesTab user={user} />}
        {tab === "banks" && <BanksTab user={user} />}
        {tab === "activity" && <ActivityTab user={user} />}
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon, label, tone,
}: { icon: React.ComponentType<{ className?: string }>; label: string; tone?: "amber" | "rose" }) {
  const cls =
    tone === "amber" ? "hover:bg-amber/10 hover:text-amber hover:border-amber/30" :
    tone === "rose" ? "hover:bg-rose/10 hover:text-rose hover:border-rose/30" :
    "hover:bg-muted/40";
  return (
    <button className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border border-border text-[11px] text-muted-foreground transition-colors ${cls}`}>
      <Icon className="w-4 h-4" />
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
    <div className="rounded-lg border border-border p-2.5 flex items-center gap-2.5">
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

function ProfileTab({ user }: { user: UserRow }) {
  return (
    <div>
      <Row icon={Mail} label="Email" value={user.email} action={<Copy className="w-3.5 h-3.5 text-muted-foreground" />} />
      <Row icon={Phone} label="Phone" value={user.phone} />
      <Row icon={MapPin} label="City" value={user.city} />
      <Row icon={Calendar} label="Joined" value={user.joined} />
      <Row icon={CircleUser} label="Trading account" value={<span className="font-mono">{user.id.replace("U-", "TA-")}</span>} />
      <Row icon={ExternalLink} label="Referred by" value="—" />
    </div>
  );
}

function KycTab({ user }: { user: UserRow }) {
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
          <button className="text-xs h-8 px-3 rounded-md bg-pine text-primary-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Approve
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
        <button className="text-xs h-8 rounded-md border border-border hover:bg-muted/40">Request additional docs</button>
        <button className="text-xs h-8 rounded-md border border-rose/30 text-rose hover:bg-rose/10">Reject</button>
      </div>
    </div>
  );
}

function DevicesTab({ user }: { user: UserRow }) {
  const devices = [
    { name: "iPhone 15 · iOS 18.2", loc: `${user.city}, MW`, ip: "196.44.128.9", last: "2h ago", trusted: true, current: true },
    { name: "Chrome · macOS", loc: `${user.city}, MW`, ip: "196.44.128.9", last: "1d ago", trusted: true, current: false },
    { name: "Samsung A54 · Android 14", loc: "Blantyre, MW", ip: "41.87.6.221", last: "12d ago", trusted: false, current: false },
  ].slice(0, user.devices);
  return (
    <ul className="space-y-2">
      {devices.map((d, i) => (
        <li key={i} className="rounded-lg border border-border p-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium truncate">{d.name}</div>
                {d.current && <span className="text-[10px] px-1.5 py-0.5 rounded bg-pine/10 text-pine">Current</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{d.loc} · {d.ip} · {d.last}</div>
            </div>
            {d.trusted
              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-pine/10 text-pine">Trusted</span>
              : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber/10 text-amber">Untrusted</span>}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <button className="text-xs h-7 px-2 rounded border border-border hover:bg-muted/40 flex items-center gap-1"><LogOut className="w-3 h-3" /> Sign out</button>
            <button className="text-xs h-7 px-2 rounded border border-border hover:bg-muted/40">Remove trust</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BanksTab({ user }: { user: UserRow }) {
  const banks = [
    { name: "National Bank of Malawi", acc: "•••• 4821", verified: true, icon: Building2 },
    { name: "Standard Bank Malawi", acc: "•••• 7104", verified: true, icon: Building2 },
    { name: "Airtel Money", acc: `+265 88• ••• 9${user.id.slice(-3)}`, verified: true, icon: CreditCard },
    { name: "TNM Mpamba", acc: `+265 88• ••• 1${user.id.slice(-3)}`, verified: false, icon: CreditCard },
  ].slice(0, user.banks + 1);
  return (
    <ul className="space-y-2">
      {banks.map((b, i) => {
        const Icon = b.icon;
        return (
          <li key={i} className="rounded-lg border border-border p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{b.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{b.acc}</div>
            </div>
            {b.verified
              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-pine/10 text-pine flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</span>
              : <button className="text-[10px] px-2 py-0.5 rounded bg-amber/10 text-amber hover:bg-amber/20">Verify</button>}
          </li>
        );
      })}
    </ul>
  );
}

function ActivityTab({ user }: { user: UserRow }) {
  const items = [
    { icon: ArrowUpRight, tone: "pine", title: "Deposit received", meta: `MWK ${MWK(user.cash / 3)} · Airtel Money`, time: "12m ago" },
    { icon: CandlestickIcon, tone: "pine", title: "Order executed", meta: "BUY 240 × TNM @ MWK 18.20", time: "1h ago" },
    { icon: KeyRound, tone: "amber", title: "Password reset requested", meta: `${user.city}, MW`, time: "3h ago" },
    { icon: ArrowDownRight, tone: "amber", title: "Withdrawal initiated", meta: `MWK ${MWK(user.cash / 5)} → NBM`, time: "5h ago" },
    { icon: ShieldCheck, tone: "pine", title: "KYC document approved", meta: "National ID", time: "1d ago" },
    { icon: RefreshCw, tone: "pine", title: "Portfolio rebalanced", meta: "3 positions adjusted", time: "2d ago" },
  ];
  return (
    <ol className="space-y-3">
      {items.map((it, i) => {
        const Icon = it.icon;
        const tone = it.tone === "pine" ? "bg-pine/10 text-pine" : it.tone === "amber" ? "bg-amber/10 text-amber" : "bg-rose/10 text-rose";
        return (
          <li key={i} className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-tight">{it.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{it.meta}</div>
            </div>
            <div className="text-[11px] text-muted-foreground shrink-0">{it.time}</div>
          </li>
        );
      })}
      <li className="pt-2">
        <button className="w-full text-xs text-pine font-medium hover:underline flex items-center justify-center gap-1">
          Full activity timeline <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </li>
    </ol>
  );
}

/* small local alias to avoid import name collision with dashboard file */
function CandlestickIcon({ className }: { className?: string }) {
  return <Activity className={className} />;
}
