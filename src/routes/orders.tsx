import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  ClipboardList, ArrowUpRight, ArrowDownRight, CheckCircle2,
  XCircle, Clock, Search, Filter, Download, ChevronDown,
  ChevronRight, TrendingUp, CandlestickChart, AlertTriangle,
  MoreHorizontal, RefreshCw,
} from "lucide-react";
import { BrokerShell, BrokerCard } from "@/components/broker-shell";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Pine Broker Portal" },
      { name: "description", content: "View and manage all client trade orders." },
    ],
  }),
  validateSearch: () => ({}),
  component: OrdersPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "FILLED" | "PENDING" | "CANCELLED" | "REJECTED" | "PARTIAL";
type OrderType   = "BUY" | "SELL";

type Order = {
  id:        string;
  client:    string;
  clientId:  string;
  ticker:    string;
  company:   string;
  type:      OrderType;
  shares:    number;
  price:     number;
  value:     number;
  status:    OrderStatus;
  placed:    string;
  executed?: string;
  exchange:  string;
  notes?:    string;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const ORDERS: Order[] = [
  { id: "ORD-5041", client: "Chisomo Banda",     clientId: "U-0041", ticker: "AIRTEL", company: "Airtel Malawi Ltd",        type: "BUY",  shares: 500,  price: 21.00, value: 10_500,  status: "FILLED",    placed: "2025-07-26 09:14", executed: "2025-07-26 09:18", exchange: "MSE" },
  { id: "ORD-5040", client: "Grace Mwale",       clientId: "U-0082", ticker: "NBM",    company: "National Bank of Malawi",  type: "SELL", shares: 100,  price: 185.0, value: 18_500,  status: "FILLED",    placed: "2025-07-26 09:02", executed: "2025-07-26 09:07", exchange: "MSE" },
  { id: "ORD-5039", client: "Tadala Phiri",      clientId: "U-0017", ticker: "FDH",    company: "FDH Financial Holdings",   type: "BUY",  shares: 200,  price: 46.00, value: 9_200,   status: "PENDING",   placed: "2025-07-26 08:55", exchange: "MSE", notes: "Awaiting market open fill" },
  { id: "ORD-5038", client: "Peter Gondwe",      clientId: "U-0055", ticker: "ILLOVO", company: "Illovo Sugar Malawi",      type: "BUY",  shares: 30,   price: 1_060, value: 31_800,  status: "CANCELLED", placed: "2025-07-26 08:40", exchange: "MSE", notes: "Client cancelled before fill" },
  { id: "ORD-5037", client: "Mercy Chirwa",      clientId: "U-0093", ticker: "STANDARD", company: "Standard Bank Malawi",  type: "SELL", shares: 80,   price: 280.0, value: 22_400,  status: "FILLED",    placed: "2025-07-26 08:22", executed: "2025-07-26 08:28", exchange: "MSE" },
  { id: "ORD-5036", client: "Roy Nkhonjera",     clientId: "U-0031", ticker: "TNM",    company: "Telekom Networks Malawi",  type: "BUY",  shares: 1_000,price: 18.20, value: 18_200,  status: "PARTIAL",   placed: "2025-07-26 08:10", exchange: "MSE", notes: "240 shares filled, 760 pending" },
  { id: "ORD-5035", client: "Lina Kachingwe",    clientId: "U-0076", ticker: "PRESS",  company: "Press Corporation",        type: "SELL", shares: 50,   price: 3_100, value: 155_000, status: "FILLED",    placed: "2025-07-25 15:48", executed: "2025-07-25 15:52", exchange: "MSE" },
  { id: "ORD-5034", client: "Benson Mbewe",      clientId: "U-0009", ticker: "MPICO",  company: "MPICO Ltd",                type: "BUY",  shares: 400,  price: 32.50, value: 13_000,  status: "REJECTED",  placed: "2025-07-25 14:30", exchange: "MSE", notes: "Insufficient funds in wallet" },
  { id: "ORD-5033", client: "Stella Tembo",      clientId: "U-0064", ticker: "AIRTEL", company: "Airtel Malawi Ltd",        type: "SELL", shares: 300,  price: 21.40, value: 6_420,   status: "FILLED",    placed: "2025-07-25 12:01", executed: "2025-07-25 12:06", exchange: "MSE" },
  { id: "ORD-5032", client: "James Nkosi",       clientId: "U-0028", ticker: "NBM",    company: "National Bank of Malawi",  type: "BUY",  shares: 60,   price: 183.0, value: 10_980,  status: "FILLED",    placed: "2025-07-25 10:44", executed: "2025-07-25 10:49", exchange: "MSE" },
  { id: "ORD-5031", client: "Alinafe Chirwa",    clientId: "U-0051", ticker: "STANDARD", company: "Standard Bank Malawi",  type: "BUY",  shares: 120,  price: 279.0, value: 33_480,  status: "PENDING",   placed: "2025-07-26 09:30", exchange: "MSE" },
  { id: "ORD-5030", client: "Kondwani Banda",    clientId: "U-0039", ticker: "ILLOVO", company: "Illovo Sugar Malawi",      type: "SELL", shares: 15,   price: 1_055, value: 15_825,  status: "FILLED",    placed: "2025-07-24 11:22", executed: "2025-07-24 11:27", exchange: "MSE" },
];

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `MK ${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000     ? `MK ${(n / 1_000).toFixed(1)}K`     :
  `MK ${n}`;

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusBadge(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    FILLED:    "bg-pine/10 text-pine",
    PENDING:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    PARTIAL:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    CANCELLED: "bg-muted text-muted-foreground",
    REJECTED:  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

function statusIcon(status: OrderStatus) {
  if (status === "FILLED")    return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (status === "PENDING")   return <Clock className="w-3.5 h-3.5" />;
  if (status === "PARTIAL")   return <RefreshCw className="w-3.5 h-3.5" />;
  if (status === "CANCELLED") return <XCircle className="w-3.5 h-3.5" />;
  if (status === "REJECTED")  return <AlertTriangle className="w-3.5 h-3.5" />;
  return null;
}

// ─── KPI row ──────────────────────────────────────────────────────────────────

function OrderKpis({ orders }: { orders: Order[] }) {
  const total     = orders.length;
  const filled    = orders.filter((o) => o.status === "FILLED").length;
  const pending   = orders.filter((o) => o.status === "PENDING" || o.status === "PARTIAL").length;
  const cancelled = orders.filter((o) => o.status === "CANCELLED" || o.status === "REJECTED").length;
  const volume    = orders.filter((o) => o.status === "FILLED").reduce((s, o) => s + o.value, 0);

  const kpis = [
    { icon: ClipboardList,   label: "Total Orders",    value: total,          sub: "all time shown",          color: "text-foreground" },
    { icon: CheckCircle2,    label: "Filled",           value: filled,         sub: `${Math.round(total ? (filled/total)*100 : 0)}% fill rate`, color: "text-pine" },
    { icon: Clock,           label: "Pending / Partial",value: pending,        sub: "awaiting execution",      color: "text-amber-600 dark:text-amber-400" },
    { icon: XCircle,         label: "Cancelled / Rejected", value: cancelled,  sub: "not executed",            color: "text-rose-500" },
    { icon: CandlestickChart,label: "Executed Volume",  value: fmtMoney(volume), sub: "filled orders only",   color: "text-pine" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 pt-6">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div key={k.label} className="rounded-[3px] bg-card border border-border p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </div>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-muted-foreground">{k.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Order detail panel ───────────────────────────────────────────────────────

function OrderDetailPanel({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="bg-card border border-border rounded-[3px] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm font-mono">{order.id}</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(order.status)}`}>
              {statusIcon(order.status)} {order.status}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{order.client} · {order.clientId}</div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-[3px] hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin-gray p-5 space-y-4">
        {/* Trade info */}
        <div>
          <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground mb-2">TRADE DETAILS</div>
          <div className="space-y-0">
            <DetailRow label="Stock" value={<span className="font-semibold">{order.ticker} <span className="font-normal text-muted-foreground">· {order.company}</span></span>} />
            <DetailRow label="Direction" value={
              <span className={`inline-flex items-center gap-1 font-semibold ${order.type === "BUY" ? "text-pine" : "text-rose-500"}`}>
                {order.type === "BUY" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {order.type}
              </span>
            } />
            <DetailRow label="Shares"   value={order.shares.toLocaleString()} />
            <DetailRow label="Price"    value={`MK ${order.price.toLocaleString()}`} />
            <DetailRow label="Total Value" value={<span className="font-semibold">{fmtMoney(order.value)}</span>} />
            <DetailRow label="Exchange" value={order.exchange} />
          </div>
        </div>

        {/* Timing */}
        <div>
          <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground mb-2">TIMING</div>
          <div className="space-y-0">
            <DetailRow label="Placed"   value={order.placed} />
            <DetailRow label="Executed" value={order.executed ?? "—"} />
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div>
            <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground mb-2">NOTES</div>
            <div className="rounded-[3px] bg-muted/40 border border-border px-3 py-2.5 text-sm text-muted-foreground">
              {order.notes}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex flex-col gap-2">
          {order.status === "PENDING" && (
            <>
              <button className="w-full h-9 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 transition-colors">
                Force Execute
              </button>
              <button className="w-full h-9 rounded-[3px] border border-rose/30 text-rose-500 text-sm hover:bg-rose/5 transition-colors">
                Cancel Order
              </button>
            </>
          )}
          {order.status === "FILLED" && (
            <button className="w-full h-9 rounded-[3px] border border-border text-muted-foreground text-sm hover:bg-muted/40 transition-colors">
              Download Confirmation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm text-right flex-1">{value}</span>
    </div>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

const STATUS_TABS: { key: string; label: string; filter: (o: Order) => boolean }[] = [
  { key: "all",       label: "All",              filter: () => true },
  { key: "pending",   label: "Pending",          filter: (o) => o.status === "PENDING" || o.status === "PARTIAL" },
  { key: "filled",    label: "Filled",           filter: (o) => o.status === "FILLED" },
  { key: "cancelled", label: "Cancelled / Rejected", filter: (o) => o.status === "CANCELLED" || o.status === "REJECTED" },
];

// ─── Orders table ─────────────────────────────────────────────────────────────

function OrdersTable({
  orders,
  selected,
  onSelect,
}: {
  orders: Order[];
  selected: Order | null;
  onSelect: (o: Order | null) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {["Order ID", "Client", "Stock", "Type", "Shares", "Value", "Placed", "Status", ""].map((h) => (
              <th key={h} className="text-left py-2.5 pr-4 text-[11px] font-semibold text-muted-foreground tracking-wide first:pl-4 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">No orders found</td>
            </tr>
          )}
          {orders.map((o) => {
            const isSelected = selected?.id === o.id;
            return (
              <tr
                key={o.id}
                onClick={() => onSelect(isSelected ? null : o)}
                className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                  isSelected ? "bg-pine/5" : "hover:bg-muted/30"
                }`}
              >
                <td className="py-3 pr-4 pl-4 font-mono text-[12px] text-muted-foreground">{o.id}</td>
                <td className="py-3 pr-4 font-medium truncate max-w-[120px]">{o.client}</td>
                <td className="py-3 pr-4">
                  <div className="font-semibold">{o.ticker}</div>
                  <div className="text-[11px] text-muted-foreground truncate max-w-[100px]">{o.company.split(" ").slice(0,2).join(" ")}</div>
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center gap-0.5 font-semibold ${o.type === "BUY" ? "text-pine" : "text-rose-500"}`}>
                    {o.type === "BUY" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {o.type}
                  </span>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{o.shares.toLocaleString()}</td>
                <td className="py-3 pr-4 font-medium">{fmtMoney(o.value)}</td>
                <td className="py-3 pr-4 text-muted-foreground text-[12px] whitespace-nowrap">{o.placed.slice(11)}</td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadge(o.status)}`}>
                    {statusIcon(o.status)} {o.status}
                  </span>
                </td>
                <td className="py-3 pr-2">
                  <ChevronRight className={`w-4 h-4 transition-transform text-muted-foreground ${isSelected ? "rotate-90 text-pine" : ""}`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function OrdersPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);

  const tab = STATUS_TABS.find((t) => t.key === activeTab)!;

  const filtered = useMemo(() => {
    return ORDERS.filter((o) =>
      tab.filter(o) &&
      (!q || (o.client + o.ticker + o.id + o.company).toLowerCase().includes(q.toLowerCase()))
    );
  }, [activeTab, q]);

  return (
    <BrokerShell activeLabel="Orders" title="Orders">
      <OrderKpis orders={ORDERS} />

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by client, ticker, order ID…"
            className="w-full h-9 pl-9 pr-4 rounded-[3px] bg-muted/60 border border-transparent focus:outline-none focus:border-pine/40 text-sm"
          />
        </div>
        <button className="flex items-center gap-1.5 h-9 px-3 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40">
          <Filter className="w-3.5 h-3.5" /> Filter
        </button>
        <button className="flex items-center gap-1.5 h-9 px-3 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border -mx-8 px-8">
        {STATUS_TABS.map((t) => {
          const count = ORDERS.filter(t.filter).length;
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13px] font-medium transition-colors shrink-0 ${
                isActive ? "text-pine" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isActive ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
              {isActive && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Main content: table + detail panel */}
      <div className={`flex gap-4 items-start ${selected ? "" : ""}`}>
        {/* Table */}
        <div className="flex-1 min-w-0">
          <BrokerCard>
            <OrdersTable orders={filtered} selected={selected} onSelect={setSelected} />
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing <span className="text-foreground font-medium">{filtered.length}</span> orders</span>
              <div className="flex items-center gap-1">
                <button className="h-7 px-3 rounded-[3px] border border-border hover:bg-muted/40">Prev</button>
                <button className="h-7 w-7 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium">1</button>
                <button className="h-7 px-3 rounded-[3px] border border-border hover:bg-muted/40">Next</button>
              </div>
            </div>
          </BrokerCard>
        </div>

        {/* Inline detail panel */}
        {selected && (
          <div className="w-80 xl:w-96 shrink-0 sticky top-4">
            <OrderDetailPanel order={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </BrokerShell>
  );
}
