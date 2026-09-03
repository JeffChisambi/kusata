import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
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
import { Money, fmtMoney } from "@/components/money";
import { ActivityDrawer } from "@/components/activity-drawer";
import { ActiveUserIcon, KycIcon, VolumeIcon, CashIcon } from "@/components/pine-icons";
import { useDashboardStats, useDashboardCharts, useDashboardFinancials } from "@/hooks/useDashboard";
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
  const superAdmin = isSuperAdmin(useCurrentUser());
  // Abbreviated on screen; the exact unrounded figure appears on hover.
  const money = (n?: number) => (isLoading || n == null ? <>—</> : <Money value={n} />);

  return (
    <div className={`grid grid-cols-1 gap-5 ${superAdmin ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
      {/* Client Portfolio — holdings only. Uninvested cash is not a portfolio:
          counting it here made a fresh deposit look like investment growth.
          The Client Cash KPI above still reports the wallet side. */}
      <Card
        title="Client Portfolio"
        subtitle="Market value of the shares your clients hold"
      >
        <div className="space-y-3">
          <div
            className="flex items-baseline justify-between"
            title="Market value of every client stock holding at the latest close. Cash is excluded — see the Client Cash card above."
          >
            <span className="text-xs font-medium text-foreground">Total Portfolio Value</span>
            <span className="text-base font-bold font-mono text-pine">
              {money(fin?.clientAssets?.portfolioValue)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            Holdings at the latest close, valued across every client account.
          </p>
        </div>
      </Card>

      {/* Broker Earnings — what the broker keeps */}
      <Card
        title="Broker Earnings"
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
            className="flex items-baseline justify-between pt-2.5 border-t border-border"
            title="Levies collected on trades at the rates you set in Settings → Fees & Charges. Statutory pass-through — you remit these, they are not your revenue."
          >
            <span className="text-xs text-muted-foreground">Statutory Levies (pass-through)</span>
            <span className="text-sm font-medium font-mono text-muted-foreground">
              {money(fin?.statutory?.leviesCollected)}
            </span>
          </div>
        </div>
      </Card>

      {/* Pine Earnings — the platform's cut of the broker's commissions */}
      <Card
        title="Pine Earnings"
        subtitle={`Pine's share of your commissions${fin ? ` · ${fin.platformFees?.ratePct ?? 0}%` : ""}`}
      >
        <div className="space-y-3">
          <div
            className="flex items-baseline justify-between"
            title={`Pine's platform commission: ${fin?.platformFees?.ratePct ?? 0}% of each commission you earn, frozen per trade. Settled monthly.`}
          >
            <span className="text-xs text-muted-foreground">Owed this month</span>
            <span className="text-base font-bold font-mono text-amber">
              {money(fin?.platformFees?.owedThisMonth)}
            </span>
          </div>
          <div
            className="flex items-baseline justify-between"
            title="What the same charge came to last month, for comparison."
          >
            <span className="text-xs text-muted-foreground">Owed last month</span>
            <span className="text-sm font-medium font-mono">{money(fin?.platformFees?.owedLastMonth)}</span>
          </div>
          <div
            className="flex items-baseline justify-between pt-2.5 border-t border-border"
            title="Commissions you have earned this month — the base this month's charge is calculated on."
          >
            <span className="text-xs text-muted-foreground">Commissions this month</span>
            <span className="text-sm font-bold font-mono">{money(fin?.platformFees?.commissionsThisMonth)}</span>
          </div>
        </div>
      </Card>

      {/* Withdrawals awaiting action — platform admins only; brokers act on
          these from the Pending Withdrawals queue lower down the page. */}
      {superAdmin && (
        <Card title="Payment Costs" subtitle="Deposit processing fees collected">
          <div className="space-y-3">
            <div
              className="flex items-baseline justify-between"
              title="Deposit processing fees recorded on completed deposits across every broker."
            >
              <span className="text-xs text-muted-foreground">Processing Fees</span>
              <span className="text-base font-bold font-mono">{money(fin?.paymentCosts?.processingFees)}</span>
            </div>
            <div
              className="flex items-baseline justify-between pt-2.5 border-t border-border"
              title="Withdrawal requests waiting for approval. Funds stay in the client's wallet (held) until approved."
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
      )}
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

      {/* Orders, KYC, withdrawals and support used to sit here as four cards.
          They are a feed, not figures, so they live in the activity drawer —
          the overview keeps to what the broker came here to read. */}
      <ActivityDrawer />
    </>
  );
}
