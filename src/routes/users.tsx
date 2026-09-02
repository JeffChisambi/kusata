import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { z } from "zod";
import {
  Search, Download, MoreHorizontal, Mail, Clock, Users, UserCheck, Filter,
  Ban, Snowflake, Eye, ChevronDown, RefreshCw, Loader2, X, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import { useUsersList, useUpdateUserStatus, useNotifyUser } from "@/hooks/useUsers";
import { useDashboardStats } from "@/hooks/useDashboard";

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

type Status = "active" | "frozen" | "suspended";
type Kyc = "verified" | "pending" | "rejected";
type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: Status;
  kyc: Kyc;
  /** Total assets = cash + portfolio market value (server-computed) */
  aum: number;
  /** Market value of stock holdings (server-computed) */
  portfolio: number;
  cash: number;
  joined: string;
  orders: number;
  devices: number;
};

// Map backend kycStatus → UI kyc display
function mapKyc(kycStatus: string): Kyc {
  switch (kycStatus) {
    case 'APPROVED': return 'verified';
    case 'REJECTED': return 'rejected';
    default: return 'pending';
  }
}

// Map backend user → UserRow
function mapUserRow(u: {
  id: string; firstName: string; lastName: string; email: string | null; phone: string;
  walletFrozen: boolean; isActive: boolean; kycStatus: string; totalAssets: number;
  portfolioValue: number; walletBalance: string; createdAt: string; orderCount: number; deviceCount: number;
}): UserRow {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email || '',
    phone: u.phone || '',
    status: u.walletFrozen ? 'frozen' : u.isActive ? 'active' : 'suspended',
    kyc: mapKyc(u.kycStatus),
    aum: Number(u.totalAssets ?? 0),
    portfolio: Number(u.portfolioValue ?? 0),
    cash: parseFloat(u.walletBalance || '0'),
    joined: u.createdAt?.slice(0, 10) ?? '',
    orders: u.orderCount || 0,
    devices: u.deviceCount || 0,
  };
}

// Tabs map to the backend's `status` filter so pagination counts stay exact.
const tabs: { key: string; label: string; status?: string }[] = [
  { key: "all", label: "All Users" },
  { key: "active", label: "Active", status: "active" },
  { key: "frozen", label: "Frozen", status: "frozen" },
  { key: "suspended", label: "Suspended", status: "deactivated" },
];

const PAGE_SIZE = 25;

const MWKexact = (n: number) =>
  `MWK ${n.toLocaleString("en-MW", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const MWK = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}B` :
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toString();

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/* -------------------- page -------------------- */

function UsersPage() {
  const search = useSearch({ from: "/users" });
  const navigate = useNavigate();
  const initialTab = tabs.find((t) => t.key === search.tab)?.key ?? "all";
  const [activeTab, setActiveTab] = useState(initialTab);
  // The search box is the source of truth; `?q=` (set by the topbar search)
  // seeds it and re-seeds whenever the topbar submits a new query.
  const [q, setQ] = useState(search.q ?? "");
  useEffect(() => { setQ(search.q ?? ""); }, [search.q]);
  const debouncedQ = useDebounced(q.trim(), 300);
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);

  const showToast = (msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  // Any change to the filter set starts from page 1 and drops the selection.
  useEffect(() => { setPage(1); setChecked(new Set()); }, [activeTab, debouncedQ]);

  const tab = tabs.find((t) => t.key === activeTab) ?? tabs[0];
  const { data: apiData, isLoading, isFetching, isError } = useUsersList({
    search: debouncedQ || undefined,
    status: tab.status,
    page,
    limit: PAGE_SIZE,
  });
  const users: UserRow[] = useMemo(
    () => (apiData?.users ?? []).map(mapUserRow),
    [apiData],
  );
  const total = apiData?.total ?? 0;
  const totalPages = apiData?.totalPages ?? 1;

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    navigate({ to: "/users", search: (prev) => ({ ...prev, tab: key === "all" ? undefined : key }), replace: true });
  };

  const selectedRows = users.filter((u) => checked.has(u.id));

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] rounded-[4px] px-3.5 py-2 text-xs font-medium border shadow-lg ${
          toast.tone === "ok" ? "bg-pine/10 text-pine border-pine/30" : "bg-rose/10 text-rose border-rose/30"
        }`}>{toast.msg}</div>
      )}

      <UserStats matching={apiData ? total : undefined} />

      <Card>
        <Toolbar
          q={q}
          setQ={setQ}
          fetching={isFetching && !isLoading}
          selected={selectedRows}
          onDone={(msg, tone) => { showToast(msg, tone); setChecked(new Set()); }}
        />
        {isError ? (
          <div className="py-16 text-center text-sm text-rose flex flex-col items-center gap-2">
            <AlertTriangle className="w-6 h-6" /> Failed to load users.
          </div>
        ) : (
          <UsersTable
            rows={users}
            loading={isLoading}
            checked={checked}
            onCheck={toggle}
            onSelectAll={() => setChecked(new Set(users.map((r) => r.id)))}
            onClear={() => setChecked(new Set())}
            onOpen={(u) => navigate({ to: "/users/$userId", params: { userId: u.id } })}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            activeCount={apiData ? total : undefined}
          />
        )}
        <TableFooter page={page} pageSize={PAGE_SIZE} total={total} totalPages={totalPages} onPageChange={setPage} loading={isLoading} />
      </Card>
    </>
  );
}

/* -------------------- pieces -------------------- */

function UserStats({ matching }: { matching?: number }) {
  const { data: stats, isLoading } = useDashboardStats();
  const totalUsers = stats?.totalUsers ?? 0;
  const active = stats?.activeUsers ?? 0;
  const pending = stats?.pendingKyc ?? 0;
  const fmt = (n: number) => (isLoading ? "—" : n.toLocaleString());

  const items = [
    { icon: Users, label: "Total users", value: fmt(totalUsers), sub: "registered accounts" },
    { icon: UserCheck, label: "Active", value: fmt(active), sub: totalUsers ? `${Math.round((active / totalUsers) * 100)}% of total` : "—" },
    { icon: Clock, label: "Pending KYC", value: fmt(pending), sub: pending > 0 ? "Awaiting review" : "None pending", tone: pending > 0 ? "amber" : "default" },
    { icon: Filter, label: "Matching filters", value: matching == null ? "—" : matching.toLocaleString(), sub: "in the current view" },
  ] as const;

  return (
    <div className="flex gap-4 pt-6">
      {items.map((it) => {
        const Icon = it.icon;
        const tone = "tone" in it && it.tone === "amber" ? "text-amber" : "text-muted-foreground";
        return (
          <div key={it.label} className="flex-1 min-w-0 rounded-[3px] bg-card border border-border p-4">
            <div className="w-9 h-9 flex items-center justify-center">
              <Icon className={`w-4 h-4 ${tone}`} />
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
  tabs, active, onChange, activeCount,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
  /** Server total for the active tab — other tabs are not counted up-front. */
  activeCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeTab = tabs.find((t) => t.key === active);

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
        {activeCount != null && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pine/10 text-pine leading-none">
            {activeCount.toLocaleString()}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[11rem] rounded-[3px] border border-border bg-card shadow-lg overflow-hidden py-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { onChange(t.key); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-4 transition-colors ${
                t.key === active ? "bg-pine/10 text-pine font-medium" : "text-foreground hover:bg-muted/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- toolbar + bulk actions -------------------- */

function exportUsers(rows: UserRow[]) {
  const headers = ["ID", "Name", "Email", "Phone", "Status", "KYC", "Portfolio", "Cash", "Total assets", "Orders", "Devices", "Joined"];
  const data = rows.map((u) => [u.id, u.name, u.email, u.phone, u.status, u.kyc, u.portfolio, u.cash, u.aum, u.orders, u.devices, u.joined]);
  const csv = [headers, ...data].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `pine-users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

type BulkAction = "message" | "freeze" | "suspend";

function Toolbar({
  q, setQ, fetching, selected, onDone,
}: {
  q: string;
  setQ: (v: string) => void;
  fetching: boolean;
  selected: UserRow[];
  onDone: (msg: string, tone?: "ok" | "err") => void;
}) {
  const [pending, setPending] = useState<BulkAction | null>(null);
  const [busy, setBusy] = useState(false);
  const updateStatus = useUpdateUserStatus();
  const notifyUser = useNotifyUser();
  const count = selected.length;

  // Run an action per selected user; report the partial-failure count honestly.
  const runForEach = async (label: string, fn: (u: UserRow) => Promise<unknown>) => {
    setBusy(true);
    const results = await Promise.allSettled(selected.map(fn));
    setBusy(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    setPending(null);
    if (failed === 0) onDone(`${label} ${count} user${count === 1 ? "" : "s"}`);
    else onDone(`${label} ${count - failed} of ${count} — ${failed} failed`, "err");
  };

  const freeze = () => runForEach("Froze wallets for", (u) => updateStatus.mutateAsync({ userId: u.id, status: "frozen" }));
  const suspend = () => runForEach("Suspended", (u) => updateStatus.mutateAsync({ userId: u.id, status: "deactivated" }));
  const message = (title: string, body: string, channel: string) =>
    runForEach("Messaged", (u) => notifyUser.mutateAsync({ userId: u.id, title, message: body, channel }));

  return (
    <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email or phone…"
          aria-label="Search users"
          className="w-full h-9 pl-9 pr-8 rounded-[3px] bg-muted/60 border border-transparent focus:outline-none focus:border-pine/40 text-sm"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {fetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}

      {count > 0 && (
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">{count} selected</span>
          <BulkBtn icon={Mail} label="Message" onClick={() => setPending("message")} disabled={busy} />
          <BulkBtn icon={Snowflake} label="Freeze" tone="amber" onClick={() => setPending("freeze")} disabled={busy} />
          <BulkBtn icon={Ban} label="Suspend" tone="rose" onClick={() => setPending("suspend")} disabled={busy} />
          <BulkBtn icon={Download} label="Export" onClick={() => { exportUsers(selected); onDone(`Exported ${count} user${count === 1 ? "" : "s"}`); }} disabled={busy} />
        </div>
      )}

      {pending === "message" && (
        <MessageDialog
          recipientLabel={count === 1 ? selected[0].name : `${count} users`}
          sending={busy}
          onClose={() => !busy && setPending(null)}
          onSend={message}
        />
      )}
      {(pending === "freeze" || pending === "suspend") && (
        <ConfirmDialog
          title={pending === "freeze" ? "Freeze wallets" : "Suspend users"}
          body={pending === "freeze"
            ? `Freeze the wallets of ${count} selected user${count === 1 ? "" : "s"}? They will be unable to deposit, withdraw or trade until unfrozen.`
            : `Suspend ${count} selected user${count === 1 ? "" : "s"}? They will be unable to sign in until reactivated.`}
          confirmLabel={pending === "freeze" ? "Freeze" : "Suspend"}
          tone={pending === "freeze" ? "amber" : "rose"}
          busy={busy}
          onClose={() => !busy && setPending(null)}
          onConfirm={pending === "freeze" ? freeze : suspend}
        />
      )}
    </div>
  );
}

function BulkBtn({
  icon: Icon, label, tone, onClick, disabled,
}: { icon: React.ComponentType<{ className?: string }>; label: string; tone?: "amber" | "rose"; onClick: () => void; disabled?: boolean }) {
  const cls = tone === "rose" ? "hover:bg-rose/10 hover:text-rose"
    : tone === "amber" ? "hover:bg-amber/10 hover:text-amber"
    : "hover:bg-muted/50";
  return (
    <button onClick={onClick} disabled={disabled} className={`h-8 px-2 rounded-[3px] text-xs flex items-center gap-1.5 text-muted-foreground disabled:opacity-50 ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

/* -------------------- table -------------------- */

function UsersTable({
  rows, loading, checked, onCheck, onSelectAll, onClear, onOpen,
  tabs, activeTab, onTabChange, activeCount,
}: {
  rows: UserRow[];
  loading: boolean;
  checked: Set<string>;
  onCheck: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onOpen: (u: UserRow) => void;
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (k: string) => void;
  activeCount?: number;
}) {
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-border bg-muted/30">
            <th className="pl-5 py-2.5 text-left">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={() => (allChecked ? onClear() : onSelectAll())}
                className="accent-pine"
                aria-label="Select all on this page"
              />
            </th>
            <th className="py-2.5 text-left font-normal">
              <TabDropdown tabs={tabs} active={activeTab} onChange={onTabChange} activeCount={activeCount} />
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
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border animate-pulse">
                <td className="pl-5 py-3"><div className="w-3.5 h-3.5 rounded bg-muted" /></td>
                <td className="py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-muted" /><div className="w-32 h-3 rounded bg-muted" /></div></td>
                <td className="py-3"><div className="w-16 h-5 rounded-full bg-muted" /></td>
                <td className="py-3"><div className="w-14 h-5 rounded bg-muted" /></td>
                <td className="py-3"><div className="ml-auto w-20 h-3 rounded bg-muted" /></td>
                <td className="py-3"><div className="ml-auto w-20 h-3 rounded bg-muted" /></td>
                <td className="py-3"><div className="ml-auto w-20 h-3 rounded bg-muted" /></td>
                <td className="pr-5 py-3"><div className="ml-auto w-6 h-6 rounded bg-muted" /></td>
              </tr>
            ))
          ) : rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen(r)}
              className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <td className="pl-5 py-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={checked.has(r.id)}
                  onChange={() => onCheck(r.id)}
                  className="accent-pine"
                  aria-label={`Select ${r.name}`}
                />
              </td>
              <td className="py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={r.name} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.email || r.phone || "—"}</div>
                  </div>
                </div>
              </td>
              <td className="py-3"><StatusBadge status={r.status} /></td>
              <td className="py-3"><KycBadge kyc={r.kyc} /></td>
              <td className="py-3 text-right font-mono cursor-help" title={MWKexact(r.portfolio)}>MWK {MWK(r.portfolio)}</td>
              <td className="py-3 text-right font-mono text-muted-foreground cursor-help" title={MWKexact(r.cash)}>MWK {MWK(r.cash)}</td>
              <td className="py-3 text-right font-mono font-medium cursor-help" title={MWKexact(r.aum)}>MWK {MWK(r.aum)}</td>
              <td className="pr-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <RowMenu onViewMore={() => onOpen(r)} />
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
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
    frozen: { cls: "bg-amber/10 text-amber", label: "Frozen", dot: "bg-amber" },
    suspended: { cls: "bg-rose/10 text-rose", label: "Suspended", dot: "bg-rose" },
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
    pending: { cls: "bg-amber/10 text-amber", label: "Pending" },
    rejected: { cls: "bg-rose/10 text-rose", label: "Rejected" },
  };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${map[kyc].cls}`}>{map[kyc].label}</span>;
}

/* -------------------- pagination -------------------- */

function TableFooter({
  page, pageSize, total, totalPages, onPageChange, loading,
}: {
  page: number; pageSize: number; total: number; totalPages: number;
  onPageChange: (p: number) => void; loading: boolean;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
      <div>
        {loading ? (
          <span className="animate-pulse">Loading…</span>
        ) : total === 0 ? (
          "No results"
        ) : (
          <>Showing <span className="text-foreground font-medium">{start}–{end}</span> of {total.toLocaleString()}</>
        )}
      </div>
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />}
    </div>
  );
}

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
        aria-label="Row actions"
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

/* -------------------- dialogs -------------------- */

function ConfirmDialog({
  title, body, confirmLabel, tone, busy, onClose, onConfirm,
}: {
  title: string; body: string; confirmLabel: string; tone: "amber" | "rose";
  busy: boolean; onClose: () => void; onConfirm: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-[4px] bg-card border border-border p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground mb-4">{body}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`h-8 px-4 rounded-[3px] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 ${
              tone === "rose" ? "bg-rose text-white hover:bg-rose/90" : "bg-amber text-white hover:bg-amber/90"
            }`}
          >
            {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageDialog({
  recipientLabel, onClose, onSend, sending,
}: {
  recipientLabel: string;
  onClose: () => void;
  onSend: (title: string, message: string, channel: string) => Promise<void>;
  sending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("IN_APP");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-[4px] bg-card border border-border p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-1">Message {recipientLabel}</h3>
        <p className="text-xs text-muted-foreground mb-4">Sends a direct notification to each selected user.</p>
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
          <button onClick={onClose} disabled={sending} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50">Cancel</button>
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
