import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Users, CandlestickChart, Headphones, Scale,
  TrendingUp, TrendingDown, ArrowLeftRight, Clock,
  XCircle, Server, Cpu, HardDrive, Wifi, Coins,
  Landmark, ShieldAlert, Activity, DatabaseBackup,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Line,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { AdminShell, Card } from "@/components/admin-shell";
import { RevenueIcon } from "@/components/icons/revenue-icon";
import { VolumeIcon } from "@/components/icons/volume-icon";
import { useDashboardStats, useDashboardCharts, useSystemHealth } from "@/hooks/useDashboard";

export const Route = createFileRoute("/")(  {
  head: () => ({
    meta: [
      { title: "Pine — Broker Admin Dashboard" },
      { name: "description", content: "Pine broker admin: executive overview, users, KYC, trading, wallets, ledger, compliance, and system operations." },
      { property: "og:title", content: "Pine — Broker Admin Dashboard" },
      { property: "og:description", content: "Executive control tower for brokerage operations." },
    ],
  }),
  validateSearch: () => ({}),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AdminShell activeLabel="Executive Dashboard" eyebrow="Control Tower" title="Overview">
      <div className="pt-6" />
      <KpiGrid />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <VolumeCard />
        <RevenueCard />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SystemHealthCard />
        <OperationsStrip />
      </div>
    </AdminShell>
  );
}

/* ─── Formatting ─── */

const fmtMoney = (n: number | string | undefined) => {
  if (n === undefined) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return 'MWK 0';
  if (num >= 1_000_000_000) return `MWK ${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `MWK ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `MWK ${(num / 1_000).toFixed(1)}K`;
  return `MWK ${num}`;
};

const fmtNum = (n: number | string | undefined) => {
  if (n === undefined) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  return num.toLocaleString();
};

/* ─── KPI Grid (already wired to API) ─── */

function KpiGrid() {
  const { data: stats, isLoading } = useDashboardStats();

  const s = stats ?? {
    totalUsers: 0, activeUsers: 0, todayNewUsers: 0,
    totalWalletBalance: '0', todayVolume: '0', todayOrders: 0,
    pendingKyc: 0, pendingPayments: 0, activeSessions: 0,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <KpiDouble
        icon={Users}
        left={{ label: "Registered users", value: fmtNum(s.totalUsers), delta: isLoading ? '…' : 'live', trend: "up", sub: `${s.activeUsers} active` }}
        right={{ label: "New signups (24h)", value: fmtNum(s.todayNewUsers), delta: isLoading ? '…' : 'live', trend: "up", sub: `${s.activeSessions} sessions` }}
      />
      <Kpi icon={Coins} label="Total cash held" value={fmtMoney(s.totalWalletBalance)} delta={isLoading ? '…' : 'live'} trend="up" sub={`${s.pendingPayments} pending`} />
      <Kpi icon={VolumeIcon} label="Volume (today)" value={fmtMoney(s.todayVolume)} delta={isLoading ? '…' : 'live'} trend="up" sub={`${s.todayOrders} trades`} />
      <Kpi icon={RevenueIcon} label="Revenue (today)" value="—" delta="—" trend="flat" sub="Pending integration" />
      <KpiDouble
        icon={ArrowLeftRight}
        left={{ label: "Pending KYC", value: fmtNum(s.pendingKyc), delta: s.pendingKyc > 0 ? 'urgent' : 'clear', trend: "flat", sub: "Awaiting review" }}
        right={{ label: "Pending payments", value: fmtNum(s.pendingPayments), delta: s.pendingPayments > 0 ? 'review' : 'clear', trend: "flat", sub: "Awaiting processing" }}
      />
      <Kpi icon={Landmark} label="Active sessions" value={fmtNum(s.activeSessions)} delta={isLoading ? '…' : 'live'} trend="up" sub="Currently online" />
      <KpiDouble
        icon={ShieldAlert}
        left={{ label: "Pending KYC", value: fmtNum(s.pendingKyc), delta: s.pendingKyc > 5 ? 'urgent' : 'ok', trend: "flat", sub: "Compliance queue" }}
        right={{ label: "Pending Payments", value: fmtNum(s.pendingPayments), delta: s.pendingPayments > 0 ? 'review' : 'ok', trend: "flat", sub: "Finance queue" }}
      />
    </div>
  );
}

/* ─── Kpi Components ─── */

function Kpi({
  icon: Icon, label, value, delta, trend, sub, tone = "pine",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; delta: string;
  trend: "up" | "down" | "flat"; sub: string;
  tone?: "pine" | "amber" | "rose";
}) {
  const toneMap = {
    pine: "text-pine bg-pine/10",
    amber: "text-amber bg-amber/10",
    rose: "text-rose bg-rose/10",
  }[tone];
  const trendMap = {
    up: "text-pine",
    down: "text-rose",
    flat: "text-amber",
  }[trend];
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Clock;
  return (
    <div className="rounded-[3px] bg-card border border-border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 flex items-center justify-center text-muted-foreground">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${trendMap}`}>
          <TrendIcon className="w-3 h-3" /> {delta}
        </span>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold leading-tight mt-0.5">{value}</div>
        <div className="text-[11px] text-muted-foreground/60 mt-1">{sub}</div>
      </div>
    </div>
  );
}

function KpiDouble({
  icon: Icon, left, right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  left: { label: string; value: string; delta: string; trend: "up" | "down" | "flat"; sub: string };
  right: { label: string; value: string; delta: string; trend: "up" | "down" | "flat"; sub: string };
}) {
  const Side = ({ stat }: { stat: typeof left }) => {
    const trendMap = { up: "text-pine", down: "text-rose", flat: "text-amber" }[stat.trend];
    const TrendIcon = stat.trend === "up" ? TrendingUp : stat.trend === "down" ? TrendingDown : Clock;
    return (
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-muted-foreground truncate">{stat.label}</span>
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${trendMap}`}>
            <TrendIcon className="w-2.5 h-2.5" /> {stat.delta}
          </span>
        </div>
        <div className="text-lg font-bold leading-tight">{stat.value}</div>
        <div className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</div>
      </div>
    );
  };
  return (
    <div className="rounded-[3px] bg-card border border-border p-4 flex items-start gap-3">
      <div className="w-9 h-9 flex items-center justify-center text-muted-foreground shrink-0">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <Side stat={left} />
      <div className="w-px self-stretch bg-border shrink-0" />
      <Side stat={right} />
    </div>
  );
}

/* ─── Volume Chart (wired to API) ─── */

function VolumeCard() {
  const { data: chartData, isLoading } = useDashboardCharts(1);

  const volumeData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      // Show empty 24h skeleton when no data
      return Array.from({ length: 24 }, (_, i) => ({
        h: `${String(i).padStart(2, "0")}:00`,
        volume: 0,
        trades: 0,
      }));
    }
    // If we have daily data, show it as-is
    return chartData.map((d, i) => ({
      h: d.date ? new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : `Day ${i + 1}`,
      volume: parseFloat(d.volume || '0'),
      trades: d.trades || 0,
    }));
  }, [chartData]);

  return (
    <Card title="Trading volume" subtitle={isLoading ? "Loading…" : "Volume and executed trades"} className="xl:col-span-2">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#45B369" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#45B369" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="oklch(0.92 0.008 150)" vertical={false} />
            <XAxis dataKey="h" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "oklch(0.5 0.02 160)" }} interval={2} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "oklch(0.5 0.02 160)" }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.92 0.008 150)", fontSize: 12 }} />
            <Area type="monotone" dataKey="volume" stroke="#45B369" strokeWidth={2} fill="url(#gv)" />
            <Line type="monotone" dataKey="trades" stroke="oklch(0.72 0.15 75)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ─── Flow Breakdown (wired to API) ─── */

function RevenueCard() {
  const { data: chartData, isLoading } = useDashboardCharts(14);

  const { totalDeposits, totalWithdrawals, radialFlowData } = useMemo(() => {
    const deposits = (chartData ?? []).reduce((s, d) => s + parseFloat(d.deposits || '0'), 0);
    const withdrawals = (chartData ?? []).reduce((s, d) => s + parseFloat(d.withdrawals || '0'), 0);
    const total = deposits + withdrawals || 1; // avoid division by zero

    return {
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      radialFlowData: [
        { name: "Withdrawals", raw: withdrawals, value: Math.round((withdrawals / total) * 100), fill: "#F87171" },
        { name: "Deposits", raw: deposits, value: Math.round((deposits / total) * 100), fill: "#45B369" },
      ],
    };
  }, [chartData]);

  const fmtFlow = (n: number) => {
    if (n >= 1_000_000_000) return `MWK ${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `MWK ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `MWK ${(n / 1_000).toFixed(1)}K`;
    return `MWK ${n}`;
  };

  return (
    <Card title="Flow breakdown" subtitle={isLoading ? "Loading…" : "Last 14 days"}>
      <div className="flex flex-col gap-3">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%" cy="50%"
              innerRadius="25%" outerRadius="95%"
              barSize={10} data={radialFlowData}
              startAngle={90} endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                dataKey="value"
                cornerRadius={6}
                background={{ fill: "oklch(0.94 0.005 150)" }}
              />
              <Tooltip
                formatter={(_: number, __: string, props: { payload?: { name: string; raw: number } }) =>
                  [fmtFlow(props.payload?.raw ?? 0), props.payload?.name ?? ""]
                }
                contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.92 0.008 150)", fontSize: 12 }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2">
          {[...radialFlowData].reverse().map((entry) => (
            <div key={entry.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.fill }} />
                <span className="text-xs text-muted-foreground">{entry.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{fmtFlow(entry.raw)}</span>
                <span className="text-xs text-muted-foreground w-8 text-right">{entry.value}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ─── System Health (wired to API) ─── */

function SystemHealthCard() {
  const { data: healthData, isLoading } = useSystemHealth();

  const healthItems = useMemo(() => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      database: DatabaseBackup,
      redis: Server,
      api: Wifi,
      memory: Cpu,
      disk: HardDrive,
      queue: Activity,
    };

    if (!healthData?.checks) {
      return [
        { icon: Server, label: "API", value: isLoading ? "…" : "Unknown", tone: "amber" as const },
        { icon: DatabaseBackup, label: "Database", value: isLoading ? "…" : "Unknown", tone: "amber" as const },
        { icon: Cpu, label: "CPU", value: isLoading ? "…" : "Unknown", tone: "amber" as const },
        { icon: HardDrive, label: "Storage", value: isLoading ? "…" : "Unknown", tone: "amber" as const },
        { icon: Wifi, label: "Network", value: isLoading ? "…" : "Unknown", tone: "amber" as const },
        { icon: Activity, label: "Queues", value: isLoading ? "…" : "Unknown", tone: "amber" as const },
      ];
    }

    return Object.entries(healthData.checks).map(([key, check]) => ({
      icon: iconMap[key] ?? Server,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: check.status === 'up' ? (check.latencyMs ? `${check.latencyMs}ms` : 'Healthy') : check.status,
      tone: (check.status === 'up' ? 'pine' : check.status === 'degraded' ? 'amber' : 'rose') as "pine" | "amber" | "rose",
    }));
  }, [healthData, isLoading]);

  const overallStatus = healthData?.status ?? 'unknown';

  return (
    <Card title="System health" subtitle="Core services & infrastructure">
      <div className="grid grid-cols-2 gap-3">
        {healthItems.map((h) => {
          const Icon = h.icon;
          const tone =
            h.tone === "pine" ? "text-pine bg-pine/10" :
            h.tone === "amber" ? "text-amber bg-amber/10" : "text-rose bg-rose/10";
          return (
            <div key={h.label} className="rounded-[3px] border border-border p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{h.label}</div>
                <div className="text-sm font-semibold truncate">{h.value}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Overall status</span>
          <span className={`font-semibold ${overallStatus === 'ok' || overallStatus === 'up' ? 'text-pine' : 'text-amber'}`}>
            {overallStatus === 'ok' || overallStatus === 'up' ? 'All systems operational' : overallStatus}
          </span>
        </div>
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${overallStatus === 'ok' || overallStatus === 'up' ? 'bg-pine' : 'bg-amber'}`}
            style={{ width: overallStatus === 'ok' || overallStatus === 'up' ? "100%" : "50%" }}
          />
        </div>
      </div>
    </Card>
  );
}

/* ─── Operations Strip (wired to API) ─── */

function OperationsStrip() {
  const { data: stats } = useDashboardStats();

  const s = stats ?? {
    totalUsers: 0, activeUsers: 0, todayOrders: 0,
    pendingKyc: 0, pendingPayments: 0, activeSessions: 0,
  };

  const ops = [
    { label: "Total orders (today)", value: fmtNum(s.todayOrders), icon: CandlestickChart },
    { label: "Pending KYC", value: fmtNum(s.pendingKyc), icon: Clock },
    { label: "Pending payments", value: fmtNum(s.pendingPayments), icon: XCircle },
    { label: "Active sessions", value: fmtNum(s.activeSessions), icon: Users },
    { label: "Active users", value: fmtNum(s.activeUsers), icon: Headphones },
    { label: "Total users", value: fmtNum(s.totalUsers), icon: Scale },
  ];

  return (
    <Card title="Operations" subtitle="Key operational metrics">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {ops.map((o) => {
          const Icon = o.icon;
          return (
            <div key={o.label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted/70 flex items-center justify-center">
                <Icon className="w-4 h-4 text-pine" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{o.label}</div>
                <div className="text-base font-semibold">{o.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
