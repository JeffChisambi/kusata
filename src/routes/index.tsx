import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";

function useCssVar(...vars: string[]) {
  const read = () =>
    vars.map((v) =>
      getComputedStyle(document.documentElement).getPropertyValue(v).trim()
    );
  const [values, setValues] = useState<string[]>(() =>
    typeof document !== "undefined" ? read() : vars.map(() => "")
  );
  useEffect(() => {
    setValues(read());
    const obs = new MutationObserver(() => setValues(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return values;
}

import {
  Users,
  FileCheck2,
  Wallet,
  Headphones,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
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
} from "recharts";
import { Card } from "@/components/broker-shell";
import { useDashboardStats, useDashboardCharts } from "@/hooks/useDashboard";
import { useKycQueue } from "@/hooks/useKyc";

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
  validateSearch: () => ({}),
  component: BrokerDashboard,
});

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmtMoney = (n: number) => {
  if (n >= 1_000_000_000) return `MK ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `MK ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `MK ${(n / 1_000).toFixed(1)}K`;
  return `MK ${n}`;
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
}

// ─── Custom icons ─────────────────────────────────────────────────────────────

function TradeVolumeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* Axes */}
      <path d="M4 2H2v19a1 1 0 0 0 1 1h19v-2H4V2z" />
      {/* Bars — thinner widths, rounded tops */}
      <rect x="6.5" y="12" width="2" height="6" rx="1" />
      <rect x="9.5" y="7" width="2" height="11" rx="1" />
      <rect x="13" y="4" width="2" height="14" rx="1" />
      <rect x="16.5" y="9" width="2" height="9" rx="1" />
    </svg>
  );
}

// ─── KPI cards ────────────────────────────────────────────────────────────────

function KpiGrid() {
  const { data: stats, isLoading } = useDashboardStats();

  const kpis = [
    {
      icon: Users,
      label: "Active Clients",
      value: isLoading ? "—" : (stats?.activeUsers ?? 0).toLocaleString(),
      delta: isLoading ? "" : `+${stats?.todayNewUsers ?? 0} today`,
      trend: "up" as const,
      sub: isLoading ? "" : `out of ${(stats?.totalUsers ?? 0).toLocaleString()} registered`,
    },
    {
      icon: FileCheck2,
      label: "Pending KYC",
      value: isLoading ? "—" : (stats?.pendingKyc ?? 0).toString(),
      delta: "needs review",
      trend: "flat" as const,
      sub: "avg. 4h to resolve",
    },
    {
      icon: TradeVolumeIcon,
      label: "Trade Volume (today)",
      value: isLoading ? "—" : fmtMoney(Number(stats?.todayVolume ?? 0)),
      delta: isLoading ? "" : `${stats?.todayOrders ?? 0} orders`,
      trend: "up" as const,
      sub: "orders executed today",
    },
    {
      icon: Wallet,
      label: "Total Client Funds",
      value: isLoading ? "—" : fmtMoney(Number(stats?.totalWalletBalance ?? 0)),
      delta: "live",
      trend: "up" as const,
      sub: "across all wallets",
    },
  ];

  return (
    <div className="flex gap-4">
      {kpis.map((k) => {
        const Icon = k.icon;
        const trendColor = "text-muted-foreground";
        const trendIconColor =
          k.trend === "up" ? "text-pine" : k.trend === "down" ? "text-rose" : "text-amber";
        const TrendIcon = k.trend === "up" ? TrendingUp : k.trend === "down" ? TrendingDown : Clock;
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
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium ${trendColor}`}
                >
                  <TrendIcon className={`w-3 h-3 ${trendIconColor}`} /> {k.delta}
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

function ClientGrowthChart() {
  const [pine, border, mutedFg, card, fg] = useCssVar(
    "--pine", "--border", "--muted-foreground", "--card", "--foreground"
  );
  const { data: charts, isLoading } = useDashboardCharts(7);

  const data = (charts ?? []).map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    clients: d.activeUsers,
  }));

  return (
    <Card
      title="Client Activity"
      subtitle="Active client count — last 7 days"
      className="xl:col-span-2"
    >
      {isLoading ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="brokerClientGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={pine} stopOpacity={0.25} />
                <stop offset="100%" stopColor={pine} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={border} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: mutedFg }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: mutedFg }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: card,
                border: `1px solid ${border}`,
                borderRadius: 10,
                fontSize: 12,
              }}
              labelStyle={{ color: fg }}
            />
            <Area
              type="monotone"
              dataKey="clients"
              stroke={pine}
              strokeWidth={2}
              fill="url(#brokerClientGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function TradeVolumeChart() {
  const [pine, border, mutedFg, card] = useCssVar(
    "--pine", "--border", "--muted-foreground", "--card"
  );
  const { data: charts, isLoading } = useDashboardCharts(7);

  const data = (charts ?? []).map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    volume: parseFloat(d.volume),
  }));

  return (
    <Card title="Trade Volume" subtitle="Daily MWK volume — last 7 days">
      {isLoading ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={border} strokeWidth={1} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: mutedFg }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: mutedFg }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtMoney(v).replace("MK ", "")}
            />
            <Tooltip
              contentStyle={{
                background: card,
                border: `1px solid ${border}`,
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(v: number) => [fmtMoney(v), "Volume"]}
            />
            <Bar
              dataKey="volume"
              fill={pine}
              barCategoryGap="0%"
              barGap={0}
              radius={[4, 4, 0, 0]}
              activeBar={{ fill: pine, fillOpacity: 0.75 }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

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
        <button className="text-[12px] text-pine hover:underline flex items-center gap-1">
          View all <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No pending applications</div>
      ) : (
        <div className="space-y-1">
          {items.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
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
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentOrders() {
  const navigate = useNavigate();

  return (
    <Card
      title="Orders"
      subtitle="Client order activity and trade instructions"
      action={
        <Link
          data-testid="link-view-all-orders"
          to="/orders"
          className="text-[12px] text-pine hover:underline flex items-center gap-1"
        >
          View all <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      }
    >
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="text-sm text-muted-foreground">No recent orders to display.</div>
        <button
          onClick={() => navigate({ to: "/orders" })}
          className="inline-flex items-center gap-1.5 text-[12px] text-pine hover:underline"
        >
          Go to order blotter <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
}

function SupportTickets() {
  return (
    <Card
      title="Support Tickets"
      subtitle="Open & escalated cases"
      action={
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <AlertTriangle className="w-3.5 h-3.5" /> No escalations
        </span>
      }
    >
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <Headphones className="w-6 h-6 text-muted-foreground/40" />
        <div className="text-sm text-muted-foreground">No open tickets</div>
      </div>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function BrokerDashboard() {
  return (
    <>
      <div className="pt-6" />

      {/* KPI row */}
      <KpiGrid />

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ClientGrowthChart />
        <TradeVolumeChart />
      </div>

      {/* KYC row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <KycQueue />
        <SupportTickets />
      </div>
    </>
  );
}
