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
  CreditCard,
  Headphones,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  WalletCards,
  ChevronRight,
  CircleUserRound,
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
import { BrokerShell, BrokerCard } from "@/components/broker-shell";

export const Route = createFileRoute("/broker")({
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

// ─── Mock data ────────────────────────────────────────────────────────────────

const clientGrowth = [
  { day: "Mon", clients: 420 },
  { day: "Tue", clients: 438 },
  { day: "Wed", clients: 451 },
  { day: "Thu", clients: 466 },
  { day: "Fri", clients: 480 },
  { day: "Sat", clients: 475 },
  { day: "Sun", clients: 493 },
];

const tradeVolume = [
  { day: "Mon", volume: 2_800_000 },
  { day: "Tue", volume: 3_400_000 },
  { day: "Wed", volume: 2_100_000 },
  { day: "Thu", volume: 4_200_000 },
  { day: "Fri", volume: 3_900_000 },
  { day: "Sat", volume: 1_200_000 },
  { day: "Sun", volume: 900_000 },
];

const recentKyc = [
  { name: "Chisomo Banda", id: "KYC-2841", submitted: "2 min ago", status: "PENDING" },
  { name: "Grace Mwale", id: "KYC-2840", submitted: "18 min ago", status: "PENDING" },
  { name: "Tadala Phiri", id: "KYC-2839", submitted: "34 min ago", status: "APPROVED" },
  { name: "Peter Gondwe", id: "KYC-2838", submitted: "1 hr ago", status: "REJECTED" },
  { name: "Mercy Chirwa", id: "KYC-2837", submitted: "2 hr ago", status: "APPROVED" },
];

const recentOrders = [
  {
    id: "ORD-5041",
    client: "Chisomo Banda",
    initials: "CB",
    clientId: "U-0041",
    email: "chisomo.banda@email.com",
    phone: "+265 991 204 841",
    location: "Lilongwe",
    accountType: "Individual",
    kyc: "Verified",
    wallet: 184_250,
    ticker: "AIRTEL",
    company: "Airtel Malawi Ltd",
    type: "BUY",
    shares: 20,
    price: 2_100,
    value: 42_000,
    status: "FILLED",
    placed: "Today, 09:14",
    executed: "Today, 09:18",
    channel: "Mobile app",
  },
  {
    id: "ORD-5040",
    client: "Grace Mwale",
    initials: "GM",
    clientId: "U-0082",
    email: "grace.mwale@email.com",
    phone: "+265 888 410 822",
    location: "Blantyre",
    accountType: "Individual",
    kyc: "Verified",
    wallet: 92_600,
    ticker: "NBM",
    company: "National Bank of Malawi",
    type: "SELL",
    shares: 5,
    price: 3_700,
    value: 18_500,
    status: "FILLED",
    placed: "Today, 09:02",
    executed: "Today, 09:07",
    channel: "Broker assisted",
  },
  {
    id: "ORD-5039",
    client: "Tadala Phiri",
    initials: "TP",
    clientId: "U-0017",
    email: "tadala.phiri@email.com",
    phone: "+265 999 351 017",
    location: "Mzuzu",
    accountType: "Individual",
    kyc: "Verified",
    wallet: 12_850,
    ticker: "FDH",
    company: "FDH Financial Holdings",
    type: "BUY",
    shares: 10,
    price: 920,
    value: 9_200,
    status: "PENDING",
    placed: "Today, 08:55",
    executed: "—",
    channel: "Mobile app",
  },
  {
    id: "ORD-5038",
    client: "Peter Gondwe",
    initials: "PG",
    clientId: "U-0055",
    email: "peter.gondwe@email.com",
    phone: "+265 888 602 055",
    location: "Lilongwe",
    accountType: "Joint",
    kyc: "Verified",
    wallet: 46_400,
    ticker: "ILLOVO",
    company: "Illovo Sugar Malawi",
    type: "BUY",
    shares: 3,
    price: 10_600,
    value: 31_800,
    status: "CANCELLED",
    placed: "Today, 08:40",
    executed: "—",
    channel: "Mobile app",
  },
  {
    id: "ORD-5037",
    client: "Mercy Chirwa",
    initials: "MC",
    clientId: "U-0093",
    email: "mercy.chirwa@email.com",
    phone: "+265 991 706 093",
    location: "Blantyre",
    accountType: "Individual",
    kyc: "Verified",
    wallet: 67_900,
    ticker: "STANDARD",
    company: "Standard Bank Malawi",
    type: "SELL",
    shares: 8,
    price: 2_800,
    value: 22_400,
    status: "FILLED",
    placed: "Today, 08:22",
    executed: "Today, 08:28",
    channel: "Broker assisted",
  },
];

const supportTickets = [
  {
    id: "TKT-910",
    client: "R. Nkhonjera",
    issue: "Withdrawal not received",
    priority: "HIGH",
    time: "5 min ago",
  },
  {
    id: "TKT-909",
    client: "L. Kachingwe",
    issue: "KYC re-upload request",
    priority: "MEDIUM",
    time: "22 min ago",
  },
  {
    id: "TKT-908",
    client: "B. Mbewe",
    issue: "Login locked out",
    priority: "HIGH",
    time: "1 hr ago",
  },
  {
    id: "TKT-907",
    client: "S. Tembo",
    issue: "Wrong trade executed",
    priority: "HIGH",
    time: "3 hr ago",
  },
];

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
    icon: TradeVolumeIcon,
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
    <div className="flex gap-4">
      {KPIS.map((k) => {
        const Icon = k.icon;
        const trendColor = "text-muted-foreground";
        const trendIconColor =
          k.trend === "up" ? "text-pine" : k.trend === "down" ? "text-rose-500" : "text-amber-500";
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
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${trendColor}`}
              >
                <TrendIcon className={`w-3 h-3 ${trendIconColor}`} /> {k.delta}
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
  const [pine, border, mutedFg, card, fg] = useCssVar(
    "--pine", "--border", "--muted-foreground", "--card", "--foreground"
  );
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
    </BrokerCard>
  );
}

function TradeVolumeChart() {
  const [pine, border, mutedFg, card] = useCssVar(
    "--pine", "--border", "--muted-foreground", "--card"
  );
  return (
    <BrokerCard title="Trade Volume" subtitle="Daily MWK volume — last 7 days">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={tradeVolume} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
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
    </BrokerCard>
  );
}

function KycQueue() {
  const iconColor = (status: string) => {
    if (status === "PENDING") return "text-amber-500";
    if (status === "APPROVED") return "text-green-500";
    return "text-rose-500";
  };
  const Icon = (status: string) => {
    if (status === "PENDING") return <Clock className={`w-3.5 h-3.5 ${iconColor(status)}`} />;
    if (status === "APPROVED")
      return <CheckCircle2 className={`w-3.5 h-3.5 ${iconColor(status)}`} />;
    return <XCircle className={`w-3.5 h-3.5 ${iconColor(status)}`} />;
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
          <div
            key={row.id}
            className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {row.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-foreground truncate">{row.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {row.submitted}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              {Icon(row.status)} {row.status}
            </span>
          </div>
        ))}
      </div>
    </BrokerCard>
  );
}

function RecentOrders() {
  const [selectedOrder, setSelectedOrder] = useState(recentOrders[0]);
  const navigate = useNavigate();

  return (
    <BrokerCard
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
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)] gap-5">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                {["Client", "Order", "Value", "Placed", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2 pr-4 text-[10px] font-semibold text-muted-foreground tracking-[0.08em] uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => {
                const active = selectedOrder.id === o.id;
                return (
                  <tr
                    key={o.id}
                    onClick={() => navigate({ to: "/orders/$orderId", params: { orderId: o.id } })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate({ to: "/orders/$orderId", params: { orderId: o.id } });
                      }
                    }}
                    tabIndex={0}
                    data-testid={`row-order-${o.id}`}
                    aria-label={`Open order ${o.id}`}
                    className={`border-b border-border last:border-0 cursor-pointer transition-colors ${active ? "bg-pine/5" : "hover:bg-muted/30"}`}
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5 min-w-[150px]">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${active ? "bg-pine text-white" : "bg-muted text-muted-foreground"}`}
                        >
                          {o.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{o.client}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {o.clientId} · {o.accountType}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 min-w-[140px]">
                      <div className="font-semibold flex items-center gap-1">
                        {o.type === "BUY" ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-pine" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                        )}
                        {o.type} {o.shares.toLocaleString()} {o.ticker}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{o.company}</div>
                    </td>
                    <td className="py-3 pr-4 font-semibold whitespace-nowrap">
                      {fmtMoney(o.value)}
                    </td>
                    <td className="py-3 pr-4 text-[11px] text-muted-foreground whitespace-nowrap">
                      {o.placed}
                    </td>
                    <td className="py-3 pr-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${
                          o.status === "FILLED"
                            ? "bg-pine/10 text-pine"
                            : o.status === "PENDING"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {o.status === "FILLED" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : o.status === "PENDING" ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 pr-1">
                      <ChevronRight
                        className={`w-4 h-4 text-muted-foreground transition-transform ${active ? "rotate-90 text-pine" : ""}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between pt-3 text-[11px] text-muted-foreground">
            <span>Showing {recentOrders.length} of 48 orders</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pine" /> Live updates
            </span>
          </div>
        </div>

        <OrderReview order={selectedOrder} />
      </div>
    </BrokerCard>
  );
}

function OrderReview({ order }: { order: (typeof recentOrders)[number] }) {
  return (
    <div className="rounded-[3px] border border-border bg-muted/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-pine/10 text-pine flex items-center justify-center">
            <CircleUserRound className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-sm font-semibold">{order.client}</div>
            <div className="text-[10px] text-muted-foreground">
              {order.clientId} · {order.accountType} account
            </div>
          </div>
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-1 rounded-full ${order.status === "FILLED" ? "bg-pine/10 text-pine" : order.status === "PENDING" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}
        >
          {order.status}
        </span>
      </div>
      <div className="p-4 space-y-4">
        <div className="rounded-[3px] bg-card border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[11px] font-bold tracking-[0.12em] ${order.type === "BUY" ? "text-pine" : "text-rose-500"}`}
            >
              {order.type} ORDER
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{order.id}</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-bold">{order.ticker}</div>
              <div className="text-[11px] text-muted-foreground">{order.company}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{fmtMoney(order.value)}</div>
              <div className="text-[11px] text-muted-foreground">
                {order.shares.toLocaleString()} shares @ {fmtMoney(order.price)}
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground mb-2">
            CLIENT INFORMATION
          </div>
          <div className="grid grid-cols-2 gap-y-2.5 text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="w-3 h-3" /> {order.email}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="w-3 h-3" /> {order.phone}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="w-3 h-3" /> {order.location}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <WalletCards className="w-3 h-3" /> {fmtMoney(order.wallet)} available
            </span>
          </div>
        </div>
        <div className="border-t border-border pt-3 space-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Placed</span>
            <span>{order.placed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Executed</span>
            <span>{order.executed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order source</span>
            <span>{order.channel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">KYC status</span>
            <span className="text-pine font-medium">{order.kyc}</span>
          </div>
        </div>
        <Link
          data-testid={`link-client-profile-${order.clientId}`}
          to="/users"
          className="flex items-center justify-center gap-1.5 w-full h-8 rounded-[3px] border border-border text-[11px] font-medium hover:bg-muted transition-colors"
        >
          View client profile <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

function SupportTickets() {
  const priorityColor = (p: string) =>
    p === "HIGH"
      ? "text-rose-700 dark:text-rose-400"
      : "text-amber-700 dark:text-amber-400";

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
          <div
            key={t.id}
            className="flex items-start gap-3 py-2.5 border-b border-border last:border-0"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-[10px] font-semibold ${priorityColor(t.priority)}`}
                >
                  {t.priority}
                </span>
              </div>
              <div className="text-[13px] font-medium text-foreground truncate">{t.issue}</div>
              <div className="text-[11px] text-muted-foreground">{t.time}</div>
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

      {/* KYC row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <KycQueue />
        <SupportTickets />
      </div>
    </BrokerShell>
  );
}
