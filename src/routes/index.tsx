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
import { useDashboardStats, useDashboardCharts, useDashboardFinancials } from "@/hooks/useDashboard";
import { useKycQueue } from "@/hooks/useKyc";
import {
  usePendingWithdrawals, useApproveWithdrawal, useRejectWithdrawal,
} from "@/hooks/useWithdrawals";

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
      trend: "up" as "up" | "down" | "flat",
      sub: isLoading ? "" : `out of ${(stats?.totalUsers ?? 0).toLocaleString()} registered`,
    },
    {
      icon: FileCheck2,
      label: "Pending KYC",
      value: isLoading ? "—" : (stats?.pendingKyc ?? 0).toString(),
      delta: "needs review",
      trend: "flat" as "up" | "down" | "flat",
      sub: "avg. 4h to resolve",
    },
    {
      icon: TradeVolumeIcon,
      label: "Trade Volume (today)",
      value: isLoading ? "—" : fmtMoney(Number(stats?.todayVolume ?? 0)),
      delta: isLoading ? "" : `${stats?.todayOrders ?? 0} orders`,
      trend: "up" as "up" | "down" | "flat",
      sub: "orders executed today",
    },
    {
      icon: Wallet,
      label: "Client Cash",
      value: isLoading ? "—" : fmtMoney(Number(stats?.totalWalletBalance ?? 0)),
      delta: "live",
      trend: "up" as "up" | "down" | "flat",
      sub: "uninvested wallet balances only",
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

// ─── Financial overview ───────────────────────────────────────────────────────
// Client money, broker revenue, and payment costs are DIFFERENT kinds of
// money — grouped visually so they are never read as one number.

function FinancialOverview() {
  const { data: fin, isLoading } = useDashboardFinancials();
  const money = (n?: number) => (isLoading || n == null ? "—" : fmtMoney(n));

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
            <span className="text-sm font-bold font-mono">{money(fin?.clientAssets.clientCash)}</span>
          </div>
          <div
            className="flex items-baseline justify-between"
            title="Market value of all client stock holdings at the latest close. Not cash."
          >
            <span className="text-xs text-muted-foreground">Portfolio Value</span>
            <span className="text-sm font-bold font-mono">{money(fin?.clientAssets.portfolioValue)}</span>
          </div>
          <div
            className="flex items-baseline justify-between pt-2.5 border-t border-border"
            title="Client Cash + Portfolio Value. Assets under administration — still client money."
          >
            <span className="text-xs font-medium text-foreground">Total Investor Assets</span>
            <span className="text-base font-bold font-mono text-pine">
              {money(fin?.clientAssets.totalInvestorAssets)}
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
              {money(fin?.brokerRevenue.tradingCommissions)}
            </span>
          </div>
          <div
            className="flex items-baseline justify-between"
            title="SEC + MSE levies collected on trades — statutory pass-through, not your revenue."
          >
            <span className="text-xs text-muted-foreground">Statutory Levies (pass-through)</span>
            <span className="text-sm font-medium font-mono text-muted-foreground">
              {money(fin?.statutory.leviesCollected)}
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
            <span className="text-base font-bold font-mono">{money(fin?.paymentCosts.processingFees)}</span>
          </div>
          <div
            className="flex items-baseline justify-between pt-2.5 border-t border-border"
            title="Withdrawal requests waiting for your approval. Funds stay in the client's wallet (held) until you approve."
          >
            <span className="text-xs text-muted-foreground">
              Pending Withdrawals{isLoading ? "" : ` (${fin?.pendingWithdrawals.count ?? 0})`}
            </span>
            <span className={`text-sm font-bold font-mono ${(fin?.pendingWithdrawals.count ?? 0) > 0 ? "text-amber" : ""}`}>
              {money(fin?.pendingWithdrawals.amount)}
            </span>
          </div>
        </div>
      </Card>
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

function PendingWithdrawalsCard() {
  const { data, isLoading } = usePendingWithdrawals();
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = data?.withdrawals ?? [];

  const onApprove = async (id: string, name: string, amount: number) => {
    if (!confirm(`Approve withdrawal of ${fmtMoney(amount)} for ${name}?\n\nThis debits their wallet and completes the payout.`)) return;
    setBusyId(id);
    try { await approve.mutateAsync(id); } catch (e: any) { alert(e?.message ?? "Approval failed"); }
    setBusyId(null);
  };
  const onReject = async (id: string, name: string) => {
    const reason = prompt(`Reject ${name}'s withdrawal — reason (shown to the client):`);
    if (reason === null) return;
    setBusyId(id);
    try { await reject.mutateAsync({ transactionId: id, reason: reason || undefined }); }
    catch (e: any) { alert(e?.message ?? "Rejection failed"); }
    setBusyId(null);
  };

  return (
    <Card
      title="Withdrawal Requests"
      subtitle="Client withdrawals awaiting your decision — funds stay held until approved"
    >
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No pending withdrawals</div>
      ) : (
        <div className="space-y-1">
          {rows.map((w) => (
            <div key={w.transactionId} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{w.user.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {relativeTime(w.requestedAt)} · wallet {fmtMoney(w.walletBalance)}
                </div>
              </div>
              <span className="font-mono text-sm font-semibold shrink-0">{fmtMoney(w.amount)}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onApprove(w.transactionId, w.user.name, w.amount)}
                  disabled={busyId === w.transactionId}
                  className="h-7 px-2.5 rounded-[3px] bg-pine text-primary-foreground text-[11px] font-medium hover:bg-pine/90 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject(w.transactionId, w.user.name)}
                  disabled={busyId === w.transactionId}
                  className="h-7 px-2.5 rounded-[3px] border border-border text-[11px] font-medium text-muted-foreground hover:bg-rose/10 hover:text-rose disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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

      {/* Financial overview: client assets vs broker revenue vs payment costs */}
      <FinancialOverview />

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ClientGrowthChart />
        <TradeVolumeChart />
      </div>

      {/* KYC + withdrawals row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <KycQueue />
        <PendingWithdrawalsCard />
      </div>
    </>
  );
}
