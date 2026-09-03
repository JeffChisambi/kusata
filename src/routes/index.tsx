import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useState } from "react";
import {
  Headphones, TrendingUp, Clock, ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle, AlertTriangle, Loader2, X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, useDashboardRange } from "@/components/broker-shell";
import { ActiveUserIcon, KycIcon, VolumeIcon, CashIcon } from "@/components/pine-icons";
import { useDashboardStats, useDashboardCharts, useDashboardFinancials } from "@/hooks/useDashboard";
import { useKycQueue } from "@/hooks/useKyc";
import { useOrders, type Order } from "@/hooks/useOrders";
import { useSupportTickets, useSupportStats } from "@/hooks/useSupport";
import {
  usePendingWithdrawals, useApproveWithdrawal, useRejectWithdrawal, type PendingWithdrawal,
} from "@/hooks/useWithdrawals";
import { useCurrentUser, isSuperAdmin } from "@/lib/auth";
import { noSearchParams } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pine — Broker Dashboard" },
      {
        name: "description",
        content: "Pine broker portal: clients, KYC, trading, payments and support.",
      },
    ],
  }),
  validateSearch: noSearchParams,
  component: BrokerDashboard,
});

// ─── Theme colours for recharts ───────────────────────────────────────────────
// recharts needs concrete colour strings, so read the theme's CSS variables
// once per dashboard render and re-read when the `dark` class toggles. One
// observer for the whole page — the charts receive the resolved palette.

const CHART_VARS = ["--pine", "--border", "--muted-foreground", "--card", "--foreground", "--amber", "--sky"] as const;

type ChartColors = {
  pine: string; border: string; mutedFg: string; card: string; fg: string; amber: string; sky: string;
};

function readChartColors(): ChartColors {
  const style = getComputedStyle(document.documentElement);
  const [pine, border, mutedFg, card, fg, amber, sky] = CHART_VARS.map((v) => style.getPropertyValue(v).trim());
  return { pine, border, mutedFg, card, fg, amber, sky };
}

const EMPTY_COLORS: ChartColors = { pine: "", border: "", mutedFg: "", card: "", fg: "", amber: "", sky: "" };

function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(() =>
    typeof document !== "undefined" ? readChartColors() : EMPTY_COLORS,
  );
  useEffect(() => {
    setColors(readChartColors());
    const obs = new MutationObserver(() => setColors(readChartColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmtMoney = (n: number) => {
  if (n >= 1_000_000_000) return `MK ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `MK ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `MK ${(n / 1_000).toFixed(1)}K`;
  return `MK ${n}`;
};

/** Exact unrounded figure, for hover tooltips on abbreviated amounts. */
const fmtExact = (n: number) =>
  `MWK ${n.toLocaleString("en-MW", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

/**
 * Abbreviated amount that reveals the TRUE full value on hover — both as a
 * native tooltip and a styled popover, so brokers can always verify the
 * exact figure behind a rounded display.
 */
function Money({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={className}>—</span>;
  return (
    <span className={`relative group/money cursor-help ${className}`} title={fmtExact(value)}>
      {fmtMoney(value)}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 hidden group-hover/money:block whitespace-nowrap rounded-[4px] border border-border bg-card px-2.5 py-1.5 text-[11px] font-mono font-medium text-foreground shadow-lg">
        {fmtExact(value)}
      </span>
    </span>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
}

/** Axis label for a daily bucket — weekday for a week, "d MMM" for longer. */
function dayLabel(iso: string, days: number) {
  const d = new Date(iso);
  return days <= 7
    ? d.toLocaleDateString("en-US", { weekday: "short" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}


// ─── KPI cards ────────────────────────────────────────────────────────────────
// Only real figures are shown: a badge appears when the API provides a delta
// (new sign-ups today, orders today); nothing is fabricated for the rest.

function KpiGrid() {
  const { data: stats, isLoading } = useDashboardStats();

  const kpis: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: React.ReactNode;
    /** Real delta badge; `trend` adds the arrow only when it is a movement. */
    delta?: string;
    trend?: "up";
    sub: string;
  }> = [
    {
      icon: ActiveUserIcon,
      label: "Active Clients",
      value: isLoading ? "—" : (stats?.activeUsers ?? 0).toLocaleString(),
      delta: isLoading || !stats?.todayNewUsers ? undefined : `+${stats.todayNewUsers} today`,
      trend: "up",
      sub: isLoading ? "" : `out of ${(stats?.totalUsers ?? 0).toLocaleString()} registered`,
    },
    {
      icon: KycIcon,
      label: "Pending KYC",
      value: isLoading ? "—" : (stats?.pendingKyc ?? 0).toString(),
      sub: "applications awaiting a decision",
    },
    {
      icon: VolumeIcon,
      label: "Trade Volume (today)",
      value: isLoading ? "—" : <Money value={Number(stats?.todayVolume ?? 0)} />,
      delta: isLoading ? undefined : `${stats?.todayOrders ?? 0} orders`,
      sub: "orders executed today",
    },
    {
      icon: CashIcon,
      label: "Client Cash",
      value: isLoading ? "—" : <Money value={Number(stats?.totalWalletBalance ?? 0)} />,
      sub: "uninvested wallet balances only",
    },
  ];

  return (
    <div className="flex gap-4">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.label}
            className="flex-1 rounded-[3px] bg-card border border-border p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 flex items-center justify-center text-muted-foreground">
                <Icon className="w-4.5 h-4.5" />
              </div>
              {k.delta && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  {k.trend === "up" && <TrendingUp className="w-3 h-3 text-pine" />}
                  {k.delta}
                </span>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="text-xl font-bold leading-tight mt-0.5">{k.value}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-1">{k.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Financial overview ───────────────────────────────────────────────────────
// Client money, broker revenue, and payment costs are DIFFERENT kinds of
// money — grouped visually so they are never read as one number.

function FinancialOverview() {
  const { data: fin, isLoading } = useDashboardFinancials();
  // Abbreviated on screen; the exact unrounded figure appears on hover.
  const money = (n?: number) => (isLoading || n == null ? <>—</> : <Money value={n} />);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* Client Assets — client money the broker administers */}
      <Card
        title="Client Assets"
        subtitle="Money you hold and administer for clients"
        className="xl:col-span-1"
      >
        <div className="space-y-3">
          <div
            className="flex items-baseline justify-between"
            title="Sum of all investors' uninvested wallet balances. Cash only — excludes stock positions."
          >
            <span className="text-xs text-muted-foreground">Client Cash</span>
            <span className="text-sm font-bold font-mono">{money(fin?.clientAssets?.clientCash)}</span>
          </div>
          <div
            className="flex items-baseline justify-between"
            title="Market value of all client stock holdings at the latest close. Not cash."
          >
            <span className="text-xs text-muted-foreground">Portfolio Value</span>
            <span className="text-sm font-bold font-mono">{money(fin?.clientAssets?.portfolioValue)}</span>
          </div>
          <div
            className="flex items-baseline justify-between pt-2.5 border-t border-border"
            title="Client Cash + Portfolio Value. Assets under administration — still client money."
          >
            <span className="text-xs font-medium text-foreground">Total Investor Assets</span>
            <span className="text-base font-bold font-mono text-pine">
              {money(fin?.clientAssets?.totalInvestorAssets)}
            </span>
          </div>
        </div>
      </Card>

      {/* Broker Revenue — the broker's own earnings */}
      <Card
        title="Broker Revenue"
        subtitle="Your earnings — separate from client money"
      >
        <div className="space-y-3">
          <div
            className="flex items-baseline justify-between"
            title="Sum of commissions recorded on every executed trade, under your configured tier schedule (Settings → Fees & Charges)."
          >
            <span className="text-xs text-muted-foreground">Trading Commissions</span>
            <span className="text-base font-bold font-mono text-pine">
              {money(fin?.brokerRevenue?.tradingCommissions)}
            </span>
          </div>
          <div
            className="flex items-baseline justify-between"
            title="SEC + MSE levies collected on trades — statutory pass-through, not your revenue."
          >
            <span className="text-xs text-muted-foreground">Statutory Levies (pass-through)</span>
            <span className="text-sm font-medium font-mono text-muted-foreground">
              {money(fin?.statutory?.leviesCollected)}
            </span>
          </div>
          <div
            className="flex items-baseline justify-between pt-2.5 border-t border-border"
            title={`Pine's platform commission: ${fin?.platformFees?.ratePct ?? 0}% of each commission you earn, frozen per trade. Settled monthly.`}
          >
            <span className="text-xs text-muted-foreground">
              Owed to Pine (this month{fin ? ` · ${fin.platformFees?.ratePct}%` : ""})
            </span>
            <span className="text-sm font-bold font-mono text-amber">
              {money(fin?.platformFees?.owedThisMonth)}
            </span>
          </div>
          <div className="flex items-baseline justify-between" title="Based on your commissions this month; last month's figure for comparison.">
            <span className="text-[11px] text-muted-foreground/70">
              on {money(fin?.platformFees?.commissionsThisMonth)} earned this month · last month owed {money(fin?.platformFees?.owedLastMonth)}
            </span>
          </div>
        </div>
      </Card>

      {/* Payment Costs + withdrawals awaiting action */}
      <Card
        title="Payment Costs"
        subtitle="Deposit processing fees collected"
      >
        <div className="space-y-3">
          <div
            className="flex items-baseline justify-between"
            title="Deposit processing fees recorded on completed deposits, under Settings → Fees & Charges. Reported separately from trading commissions."
          >
            <span className="text-xs text-muted-foreground">Processing Fees</span>
            <span className="text-base font-bold font-mono">{money(fin?.paymentCosts?.processingFees)}</span>
          </div>
          <div
            className="flex items-baseline justify-between pt-2.5 border-t border-border"
            title="Withdrawal requests waiting for your approval. Funds stay in the client's wallet (held) until you approve."
          >
            <span className="text-xs text-muted-foreground">
              Pending Withdrawals{isLoading ? "" : ` (${fin?.pendingWithdrawals?.count ?? 0})`}
            </span>
            <span className={`text-sm font-bold font-mono ${(fin?.pendingWithdrawals?.count ?? 0) > 0 ? "text-amber" : ""}`}>
              {money(fin?.pendingWithdrawals?.amount)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
// One fetch (per selected range) feeds every chart; each chart is memoised so
// the theme observer / poll ticks only re-render when its inputs change.

type ChartPoint = {
  day: string;
  clients: number;
  volume: number;
  deposits: number;
  withdrawals: number;
  revenue: number;
};

type ChartProps = { data: ChartPoint[]; loading: boolean; days: number; colors: ChartColors };

function ChartState({ loading, empty }: { loading: boolean; empty: boolean }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
      {loading ? "Loading…" : empty ? "No data available" : null}
    </div>
  );
}

const tooltipStyle = (c: ChartColors) => ({
  background: c.card,
  border: `1px solid ${c.border}`,
  borderRadius: 10,
  fontSize: 12,
});

const ClientGrowthChart = memo(function ClientGrowthChart({ data, loading, days, colors: c }: ChartProps) {
  return (
    <Card
      title="Client Activity"
      subtitle={`Active client count — last ${days} days`}
      className="xl:col-span-2"
    >
      {loading || data.length === 0 ? (
        <ChartState loading={loading} empty={data.length === 0} />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="brokerClientGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.pine} stopOpacity={0.25} />
                <stop offset="100%" stopColor={c.pine} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={c.border} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: c.mutedFg }} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={{ fontSize: 11, fill: c.mutedFg }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle(c)} labelStyle={{ color: c.fg }} />
            <Area type="monotone" dataKey="clients" name="Active clients" stroke={c.pine} strokeWidth={2} fill="url(#brokerClientGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
});

const TradeVolumeChart = memo(function TradeVolumeChart({ data, loading, days, colors: c }: ChartProps) {
  return (
    <Card title="Trade Volume" subtitle={`Daily MWK volume — last ${days} days`}>
      {loading || data.length === 0 ? (
        <ChartState loading={loading} empty={data.length === 0} />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.border} strokeWidth={1} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: c.mutedFg }} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={{ fontSize: 11, fill: c.mutedFg }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoney(v).replace("MK ", "")} />
            <Tooltip contentStyle={tooltipStyle(c)} formatter={(v: number) => [fmtMoney(v), "Volume"]} />
            <Bar dataKey="volume" fill={c.pine} radius={[4, 4, 0, 0]} activeBar={{ fill: c.pine, fillOpacity: 0.75 }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
});

const DepositsWithdrawalsChart = memo(function DepositsWithdrawalsChart({ data, loading, days, colors: c }: ChartProps) {
  return (
    <Card title="Deposits vs Withdrawals" subtitle={`Completed client cash movements — last ${days} days`}>
      {loading || data.length === 0 ? (
        <ChartState loading={loading} empty={data.length === 0} />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.border} strokeWidth={1} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: c.mutedFg }} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={{ fontSize: 11, fill: c.mutedFg }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoney(v).replace("MK ", "")} />
            <Tooltip contentStyle={tooltipStyle(c)} formatter={(v: number, name: string) => [fmtMoney(v), name]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: c.mutedFg }} />
            <Bar dataKey="deposits" name="Deposits" fill={c.pine} radius={[4, 4, 0, 0]} activeBar={{ fill: c.pine, fillOpacity: 0.75 }} />
            <Bar dataKey="withdrawals" name="Withdrawals" fill={c.amber} radius={[4, 4, 0, 0]} activeBar={{ fill: c.amber, fillOpacity: 0.75 }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
});

const RevenueChart = memo(function RevenueChart({ data, loading, days, colors: c, label }: ChartProps & { label: string }) {
  return (
    <Card title={label} subtitle={`Daily MWK earned on executed trades — last ${days} days`}>
      {loading || data.length === 0 ? (
        <ChartState loading={loading} empty={data.length === 0} />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="brokerRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.sky} stopOpacity={0.25} />
                <stop offset="100%" stopColor={c.sky} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={c.border} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: c.mutedFg }} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={{ fontSize: 11, fill: c.mutedFg }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoney(v).replace("MK ", "")} />
            <Tooltip contentStyle={tooltipStyle(c)} labelStyle={{ color: c.fg }} formatter={(v: number) => [fmtMoney(v), label]} />
            <Area type="monotone" dataKey="revenue" name={label} stroke={c.sky} strokeWidth={2} fill="url(#brokerRevenueGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
});

function DashboardCharts() {
  const { days } = useDashboardRange();
  const colors = useChartColors();
  const { data: charts, isLoading } = useDashboardCharts(days);
  // Platform staff see Pine's cut of every commission; brokers see their own.
  const superAdmin = isSuperAdmin(useCurrentUser());
  const revenueLabel = superAdmin ? "Platform fees" : "Commissions";

  const data = useMemo<ChartPoint[]>(
    () => (charts ?? []).map((d) => ({
      day: dayLabel(d.date, days),
      clients: d.activeUsers,
      volume: parseFloat(d.volume) || 0,
      deposits: parseFloat(d.deposits) || 0,
      withdrawals: parseFloat(d.withdrawals) || 0,
      revenue: parseFloat(d.revenue) || 0,
    })),
    [charts, days],
  );

  const common = { data, loading: isLoading, days, colors };
  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ClientGrowthChart {...common} />
        <TradeVolumeChart {...common} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DepositsWithdrawalsChart {...common} />
        <RevenueChart {...common} label={revenueLabel} />
      </div>
    </>
  );
}

// ─── KYC queue ────────────────────────────────────────────────────────────────

function KycQueue() {
  const { data, isLoading } = useKycQueue({ limit: 5 });
  const items = data?.applications ?? [];

  const iconColor = (status: string) => {
    if (status === "PENDING") return "text-amber";
    if (status === "APPROVED") return "text-pine";
    return "text-rose";
  };
  const StatusIcon = (status: string) => {
    if (status === "PENDING") return <Clock className={`w-3.5 h-3.5 ${iconColor(status)}`} />;
    if (status === "APPROVED")
      return <CheckCircle2 className={`w-3.5 h-3.5 ${iconColor(status)}`} />;
    return <XCircle className={`w-3.5 h-3.5 ${iconColor(status)}`} />;
  };

  return (
    <Card
      title="KYC Queue"
      subtitle="Recent applications"
      action={
        <Link to="/kyc" className="text-[12px] text-pine hover:underline flex items-center gap-1">
          View all <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      }
    >
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No pending applications</div>
      ) : (
        <div className="space-y-1">
          {items.map((row) => (
            <Link
              key={row.id}
              to="/kyc/$applicationId"
              params={{ applicationId: row.id }}
              className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 -mx-2 px-2 rounded-[3px] hover:bg-muted/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {row.userName
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{row.userName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {relativeTime(row.submittedAt)}
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground w-24 shrink-0">
                {StatusIcon(row.status)} {row.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Recent orders (snapshot of the latest 5) ─────────────────────────────────

const ORDER_STATUS_CLS: Record<Order["status"], string> = {
  READY: "bg-amber/10 text-amber",
  PARTIAL: "bg-amber/10 text-amber",
  PENDING: "bg-muted text-muted-foreground",
  EXECUTED: "bg-pine/10 text-pine",
  SETTLED: "bg-pine/10 text-pine",
  REJECTED: "bg-rose/10 text-rose",
  CANCELLED: "bg-muted text-muted-foreground",
};

function RecentOrders() {
  const { data, isLoading } = useOrders({ limit: 5 });
  const orders = (data?.orders ?? []).slice(0, 5);

  return (
    <Card
      title="Orders"
      subtitle="Latest client trade instructions"
      action={
        <Link
          data-testid="link-view-all-orders"
          to="/orders"
          className="text-[12px] text-pine hover:underline flex items-center gap-1"
        >
          View all{typeof data?.total === "number" ? ` (${data.total.toLocaleString()})` : ""} <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      }
    >
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No orders yet.</div>
      ) : (
        <div className="space-y-1">
          {orders.map((o) => {
            const SideIcon = o.side === "BUY" ? ArrowUpRight : ArrowDownRight;
            return (
              <Link
                key={o.id}
                to="/orders/$orderId"
                params={{ orderId: o.id }}
                className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 -mx-2 px-2 rounded-[3px] hover:bg-muted/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <SideIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground truncate">
                    {o.side} {o.quantity.toLocaleString("en-MW")} × {o.ticker}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {o.client} · {relativeTime(o.received)}
                  </div>
                </div>
                <span className="font-mono text-xs font-semibold shrink-0"><Money value={o.value} /></span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${ORDER_STATUS_CLS[o.status]}`}>
                  {o.status === "READY" && o.backendStatus === "SUBMITTED" ? "AWAITING" : o.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Pending withdrawals ──────────────────────────────────────────────────────

type WithdrawalDecision =
  | { kind: "approve"; w: PendingWithdrawal }
  | { kind: "reject"; w: PendingWithdrawal };

function ConfirmDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md rounded-[4px] bg-card border border-border p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-[3px] hover:bg-muted/60 flex items-center justify-center text-muted-foreground" aria-label="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PendingWithdrawalsCard() {
  const { data, isLoading } = usePendingWithdrawals();
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();
  const [decision, setDecision] = useState<WithdrawalDecision | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);
  const allRows = data?.withdrawals ?? [];
  const SNAPSHOT = 5;
  const rows = allRows.slice(0, SNAPSHOT);
  const overflow = allRows.length - rows.length;
  const busy = approve.isPending || reject.isPending;

  const showToast = (msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };
  const open = (d: WithdrawalDecision) => { setDecision(d); setReason(""); setError(null); };
  const close = () => { if (!busy) setDecision(null); };

  const confirm = async () => {
    if (!decision) return;
    setError(null);
    try {
      if (decision.kind === "approve") {
        await approve.mutateAsync(decision.w.transactionId);
        showToast(`Approved ${fmtMoney(decision.w.amount)} for ${decision.w.user.name}`);
      } else {
        await reject.mutateAsync({ transactionId: decision.w.transactionId, reason: reason.trim() || undefined });
        showToast(`Rejected ${decision.w.user.name}'s withdrawal`);
      }
      setDecision(null);
    } catch (e: any) {
      setError(e?.message ?? (decision.kind === "approve" ? "Approval failed" : "Rejection failed"));
    }
  };

  return (
    <Card
      title="Withdrawal Requests"
      subtitle="Client withdrawals awaiting your decision — funds stay held until approved"
      action={
        allRows.length > 0 ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            {allRows.length} pending{overflow > 0 ? ` · showing ${SNAPSHOT}` : ""}
          </span>
        ) : undefined
      }
    >
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] rounded-[4px] px-3.5 py-2 text-xs font-medium border shadow-lg ${
          toast.tone === "ok" ? "bg-pine/10 text-pine border-pine/30" : "bg-rose/10 text-rose border-rose/30"
        }`}>{toast.msg}</div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No pending withdrawals</div>
      ) : (
        <div className="space-y-1">
          {rows.map((w) => (
            <div key={w.transactionId} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <Link
                  to="/users/$userId"
                  params={{ userId: w.user.id }}
                  className="text-[13px] font-medium text-foreground truncate block hover:text-pine transition-colors"
                >
                  {w.user.name}
                </Link>
                <div className="text-[11px] text-muted-foreground">
                  {relativeTime(w.requestedAt)} · wallet <Money value={w.walletBalance} />
                </div>
              </div>
              <span className="font-mono text-sm font-semibold shrink-0"><Money value={w.amount} /></span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => open({ kind: "approve", w })}
                  disabled={busy}
                  className="h-7 px-2.5 rounded-[3px] bg-pine text-primary-foreground text-[11px] font-medium hover:bg-pine/90 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => open({ kind: "reject", w })}
                  disabled={busy}
                  className="h-7 px-2.5 rounded-[3px] border border-border text-[11px] font-medium text-muted-foreground hover:bg-rose/10 hover:text-rose disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
          {overflow > 0 && (
            <div className="pt-2.5 text-[11px] text-muted-foreground text-center">
              +{overflow} more request{overflow === 1 ? "" : "s"} — approve these first; the list refreshes as you go.
            </div>
          )}
        </div>
      )}

      {decision && (
        <ConfirmDialog
          title={decision.kind === "approve" ? "Approve withdrawal" : "Reject withdrawal"}
          onClose={close}
        >
          <p className="text-xs text-muted-foreground mb-3">
            {decision.kind === "approve" ? (
              <>
                Approve the withdrawal of <strong className="text-foreground">{fmtExact(decision.w.amount)}</strong> for{" "}
                <strong className="text-foreground">{decision.w.user.name}</strong>? This debits their wallet and completes the payout.
              </>
            ) : (
              <>
                Reject <strong className="text-foreground">{decision.w.user.name}</strong>'s withdrawal of{" "}
                <strong className="text-foreground">{fmtExact(decision.w.amount)}</strong>? The held funds return to their available balance.
              </>
            )}
          </p>
          {decision.kind === "reject" && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Reason (optional — shown to the client)"
              className="w-full px-3 py-2.5 rounded-[3px] border border-border bg-transparent text-sm resize-none focus:outline-none focus:border-pine/40 mb-3"
            />
          )}
          {error && <p className="text-xs text-rose mb-3">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={close} disabled={busy} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={busy}
              className={`h-8 px-4 rounded-[3px] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 ${
                decision.kind === "approve" ? "bg-pine text-primary-foreground hover:bg-pine/90" : "bg-rose text-white hover:bg-rose/90"
              }`}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : decision.kind === "approve" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {decision.kind === "approve" ? "Confirm approve" : "Confirm reject"}
            </button>
          </div>
        </ConfirmDialog>
      )}
    </Card>
  );
}

// ─── Support tickets (open, snapshot of 5) ────────────────────────────────────

function SupportTickets() {
  const { data, isLoading } = useSupportTickets({ status: "OPEN" });
  const { data: stats } = useSupportStats();
  const tickets = (data?.tickets ?? []).slice(0, 5);
  const awaiting = stats?.awaitingAdmin ?? 0;

  return (
    <Card
      title="Support Tickets"
      subtitle="Open cases"
      action={
        <div className="flex items-center gap-3">
          {stats && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${awaiting > 0 ? "text-amber" : "text-muted-foreground"}`}>
              {awaiting > 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {awaiting > 0 ? `${awaiting} awaiting reply` : "No replies due"}
            </span>
          )}
          <Link to="/support" className="text-[12px] text-pine hover:underline flex items-center gap-1">
            View all{typeof data?.total === "number" ? ` (${data.total.toLocaleString()})` : ""} <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
          <Headphones className="w-6 h-6 text-muted-foreground/40" />
          <div className="text-sm text-muted-foreground">No open tickets</div>
        </div>
      ) : (
        <div className="space-y-1">
          {tickets.map((t) => (
            <Link
              key={t.ticketId}
              to="/support/$ticketId"
              params={{ ticketId: t.ticketId }}
              className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 -mx-2 px-2 rounded-[3px] hover:bg-muted/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Headphones className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{t.subject}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {t.user?.name ?? "Unknown user"} · {t.reference} · {relativeTime(t.lastMessageAt)}
                </div>
              </div>
              {t.awaitingAdmin ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber/10 text-amber shrink-0">Reply due</span>
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{t.statusLabel}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function BrokerDashboard() {
  return (
    <>
      {/* KPI row */}
      <KpiGrid />

      {/* Financial overview: client assets vs broker revenue vs payment costs */}
      <FinancialOverview />

      {/* Charts — all driven by the dashboard time range */}
      <DashboardCharts />

      {/* KYC + withdrawals row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <KycQueue />
        <PendingWithdrawalsCard />
      </div>

      {/* Orders + support row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <RecentOrders />
        <SupportTickets />
      </div>
    </>
  );
}
