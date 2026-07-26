import { createFileRoute } from "@tanstack/react-router";
import {
  Users, FileCheck2, CandlestickChart, Wallet,
  CreditCard, Headphones, TrendingUp, TrendingDown,
  Clock, ArrowUpRight, ArrowDownRight, CheckCircle2,
  XCircle, AlertTriangle, MoreHorizontal,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts";
import { BrokerShell, BrokerCard } from "@/components/broker-shell";

export const Route = createFileRoute("/broker")({
  head: () => ({
    meta: [
      { title: "Pine — Broker Dashboard" },
      { name: "description", content: "Pine broker portal: clients, KYC, trading, payments and support." },
    ],
  }),
  validateSearch: () => ({}),
  component: BrokerDashboard,
});

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmtMoney = (n: number) => {
  if (n >= 1_000_000_000) return `MK ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `MK ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `MK ${(n / 1_000).toFixed(1)}K`;
  return `MK ${n}`;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const clientGrowth = [
  { day: "Mon", clients: 420 }, { day: "Tue", clients: 438 },
  { day: "Wed", clients: 451 }, { day: "Thu", clients: 466 },
  { day: "Fri", clients: 480 }, { day: "Sat", clients: 475 },
  { day: "Sun", clients: 493 },
];

const tradeVolume = [
  { day: "Mon", volume: 2_800_000 }, { day: "Tue", volume: 3_400_000 },
  { day: "Wed", volume: 2_100_000 }, { day: "Thu", volume: 4_200_000 },
  { day: "Fri", volume: 3_900_000 }, { day: "Sat", volume: 1_200_000 },
  { day: "Sun", volume: 900_000  },
];

const recentKyc = [
  { name: "Chisomo Banda",   id: "KYC-2841", submitted: "2 min ago",  status: "PENDING"  },
  { name: "Grace Mwale",     id: "KYC-2840", submitted: "18 min ago", status: "PENDING"  },
  { name: "Tadala Phiri",    id: "KYC-2839", submitted: "34 min ago", status: "APPROVED" },
  { name: "Peter Gondwe",    id: "KYC-2838", submitted: "1 hr ago",   status: "REJECTED" },
  { name: "Mercy Chirwa",    id: "KYC-2837", submitted: "2 hr ago",   status: "APPROVED" },
];

const recentOrders = [
  { client: "C. Banda",   ticker: "AIRTEL", type: "BUY",  shares: 20, value: 42_000,  status: "FILLED"   },
  { client: "G. Mwale",   ticker: "NBM",    type: "SELL", shares: 5,  value: 18_500,  status: "FILLED"   },
  { client: "T. Phiri",   ticker: "FDH",    type: "BUY",  shares: 10, value: 9_200,   status: "PENDING"  },
  { client: "P. Gondwe",  ticker: "ILLOVO", type: "BUY",  shares: 3,  value: 31_800,  status: "CANCELLED"},
  { client: "M. Chirwa",  ticker: "STANDARD", type: "SELL", shares: 8, value: 22_400, status: "FILLED"  },
];

const supportTickets = [
  { id: "TKT-910", client: "R. Nkhonjera", issue: "Withdrawal not received",  priority: "HIGH",   time: "5 min ago"  },
  { id: "TKT-909", client: "L. Kachingwe", issue: "KYC re-upload request",    priority: "MEDIUM", time: "22 min ago" },
  { id: "TKT-908", client: "B. Mbewe",     issue: "Login locked out",         priority: "HIGH",   time: "1 hr ago"   },
  { id: "TKT-907", client: "S. Tembo",     issue: "Wrong trade executed",     priority: "HIGH",   time: "3 hr ago"   },
];

// ─── KPI cards ────────────────────────────────────────────────────────────────

const KPIS = [
  {
    icon: Users,
    label: "Active Clients",
    value: "493",
    delta: "+13 today",
    trend: "up" as const,
    sub: "out of 512 registered",
  },
  {
    icon: FileCheck2,
    label: "Pending KYC",
    value: "27",
    delta: "needs review",
    trend: "flat" as const,
    sub: "avg. 4h to resolve",
  },
  {
    icon: CandlestickChart,
    label: "Trade Volume (today)",
    value: fmtMoney(3_900_000),
    delta: "+18% vs yesterday",
    trend: "up" as const,
    sub: "48 orders executed",
  },
  {
    icon: Wallet,
    label: "Total Client Funds",
    value: fmtMoney(84_500_000),
    delta: "live",
    trend: "up" as const,
    sub: "across all wallets",
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function KpiGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {KPIS.map((k) => {
        const Icon = k.icon;
        const trendColor = k.trend === "up" ? "text-pine" : k.trend === "down" ? "text-rose-500" : "text-amber-500";
        const TrendIcon  = k.trend === "up" ? TrendingUp : k.trend === "down" ? TrendingDown : Clock;
        return (
          <div key={k.label} className="rounded-[3px] bg-card border border-border p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 flex items-center justify-center text-muted-foreground">
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${trendColor}`}>
                <TrendIcon className="w-3 h-3" /> {k.delta}
              </span>
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
  return (
    <BrokerCard
      title="Client Activity"
      subtitle="Active client count — last 7 days"
      className="xl:col-span-2"
    >
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={clientGrowth} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="brokerClientGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="hsl(var(--pine))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(var(--pine))" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Area type="monotone" dataKey="clients" stroke="hsl(var(--pine))" strokeWidth={2} fill="url(#brokerClientGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </BrokerCard>
  );
}

function TradeVolumeChart() {
  return (
    <BrokerCard title="Trade Volume" subtitle="Daily MWK volume — last 7 days">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={tradeVolume} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => fmtMoney(v).replace("MK ", "")}
          />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
            formatter={(v: number) => [fmtMoney(v), "Volume"]}
          />
          <Bar dataKey="volume" fill="hsl(var(--pine))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </BrokerCard>
  );
}

function KycQueue() {
  const badge = (status: string) => {
    if (status === "PENDING")  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    if (status === "APPROVED") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
  };
  const Icon = (status: string) => {
    if (status === "PENDING")  return <Clock className="w-3.5 h-3.5" />;
    if (status === "APPROVED") return <CheckCircle2 className="w-3.5 h-3.5" />;
    return <XCircle className="w-3.5 h-3.5" />;
  };

  return (
    <BrokerCard
      title="KYC Queue"
      subtitle="Recent applications"
      action={
        <button className="text-[12px] text-pine hover:underline flex items-center gap-1">
          View all <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="space-y-1">
        {recentKyc.map((row) => (
          <div key={row.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {row.name.split(" ").map((n) => n[0]).join("")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-foreground truncate">{row.name}</div>
              <div className="text-[11px] text-muted-foreground">{row.id} · {row.submitted}</div>
            </div>
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${badge(row.status)}`}>
              {Icon(row.status)} {row.status}
            </span>
          </div>
        ))}
      </div>
    </BrokerCard>
  );
}

function RecentOrders() {
  const statusColor = (s: string) => {
    if (s === "FILLED")    return "text-pine";
    if (s === "PENDING")   return "text-amber-500";
    if (s === "CANCELLED") return "text-rose-500";
    return "text-muted-foreground";
  };

  return (
    <BrokerCard
      title="Recent Orders"
      subtitle="Latest client trades"
      action={
        <button className="text-[12px] text-pine hover:underline flex items-center gap-1">
          View all <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {["Client", "Stock", "Type", "Shares", "Value", "Status"].map((h) => (
                <th key={h} className="text-left py-2 pr-4 text-[11px] font-semibold text-muted-foreground tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((o, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-2.5 pr-4 font-medium">{o.client}</td>
                <td className="py-2.5 pr-4">{o.ticker}</td>
                <td className="py-2.5 pr-4">
                  <span className={`font-semibold ${o.type === "BUY" ? "text-pine" : "text-rose-500"}`}>
                    {o.type === "BUY" ? <ArrowUpRight className="inline w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="inline w-3.5 h-3.5 mr-0.5" />}
                    {o.type}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">{o.shares}</td>
                <td className="py-2.5 pr-4">{fmtMoney(o.value)}</td>
                <td className={`py-2.5 font-medium ${statusColor(o.status)}`}>{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BrokerCard>
  );
}

function SupportTickets() {
  const priorityColor = (p: string) =>
    p === "HIGH" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                 : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";

  return (
    <BrokerCard
      title="Support Tickets"
      subtitle="Open & escalated cases"
      action={
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500">
          <AlertTriangle className="w-3.5 h-3.5" /> 3 escalated
        </span>
      }
    >
      <div className="space-y-1">
        {supportTickets.map((t) => (
          <div key={t.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] text-muted-foreground font-mono">{t.id}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${priorityColor(t.priority)}`}>{t.priority}</span>
              </div>
              <div className="text-[13px] font-medium text-foreground truncate">{t.issue}</div>
              <div className="text-[11px] text-muted-foreground">{t.client} · {t.time}</div>
            </div>
            <button className="text-muted-foreground hover:text-foreground mt-1 shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </BrokerCard>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function BrokerDashboard() {
  return (
    <BrokerShell activeLabel="Overview" title="Broker Overview">
      <div className="pt-6" />

      {/* KPI row */}
      <KpiGrid />

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ClientGrowthChart />
        <TradeVolumeChart />
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <KycQueue />
        <RecentOrders />
      </div>

      {/* Support row */}
      <SupportTickets />
    </BrokerShell>
  );
}
