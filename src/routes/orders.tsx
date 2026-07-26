import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  Download,
  FilePlus2,
  Filter,
  ListFilter,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { BrokerCard, BrokerShell } from "@/components/broker-shell";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Pine Broker Portal" },
      { name: "description", content: "Receive, review, and execute client trade orders." },
    ],
  }),
  validateSearch: () => ({}),
  component: OrdersPage,
});

type OrderStatus = "READY" | "PARTIAL" | "EXECUTED" | "CANCELLED" | "REJECTED" | "REVIEW";
type OrderSide = "BUY" | "SELL";
type RiskLevel = "LOW" | "REVIEW";

type Order = {
  id: string;
  client: string;
  clientId: string;
  account: string;
  ticker: string;
  company: string;
  side: OrderSide;
  quantity: number;
  filled: number;
  limitPrice: number;
  value: number;
  status: OrderStatus;
  received: string;
  executed?: string;
  exchange: string;
  tif: "DAY" | "GTC";
  channel: "Mobile app" | "Web portal" | "Broker assisted";
  risk: RiskLevel;
  instructions: string;
};

const INITIAL_ORDERS: Order[] = [
  {
    id: "ORD-5047",
    client: "Madalitso Mbewe",
    clientId: "U-0118",
    account: "Individual · 0048",
    ticker: "NBM",
    company: "National Bank of Malawi",
    side: "BUY",
    quantity: 240,
    filled: 0,
    limitPrice: 185,
    value: 44_400,
    status: "READY",
    received: "09:42",
    exchange: "MSE",
    tif: "DAY",
    channel: "Mobile app",
    risk: "LOW",
    instructions: "Execute at limit price or better. Client has sufficient buying power.",
  },
  {
    id: "ORD-5046",
    client: "Tadala Phiri",
    clientId: "U-0017",
    account: "Individual · 0112",
    ticker: "FDH",
    company: "FDH Financial Holdings",
    side: "SELL",
    quantity: 400,
    filled: 160,
    limitPrice: 46,
    value: 18_400,
    status: "PARTIAL",
    received: "09:35",
    exchange: "MSE",
    tif: "DAY",
    channel: "Web portal",
    risk: "LOW",
    instructions: "Complete the remaining balance during today's session.",
  },
  {
    id: "ORD-5045",
    client: "Chisomo Banda",
    clientId: "U-0041",
    account: "Individual · 0091",
    ticker: "AIRTEL",
    company: "Airtel Malawi Ltd",
    side: "BUY",
    quantity: 500,
    filled: 0,
    limitPrice: 21,
    value: 10_500,
    status: "READY",
    received: "09:28",
    exchange: "MSE",
    tif: "GTC",
    channel: "Mobile app",
    risk: "LOW",
    instructions: "Good till cancelled. Do not route above the stated limit.",
  },
  {
    id: "ORD-5044",
    client: "Grace Mwale",
    clientId: "U-0082",
    account: "Individual · 0063",
    ticker: "STANDARD",
    company: "Standard Bank Malawi",
    side: "SELL",
    quantity: 80,
    filled: 0,
    limitPrice: 280,
    value: 22_400,
    status: "READY",
    received: "09:17",
    exchange: "MSE",
    tif: "DAY",
    channel: "Broker assisted",
    risk: "REVIEW",
    instructions: "Confirm the client callback before routing this order.",
  },
  {
    id: "ORD-5043",
    client: "Mercy Chirwa",
    clientId: "U-0093",
    account: "Individual · 0027",
    ticker: "TNM",
    company: "Telekom Networks Malawi",
    side: "BUY",
    quantity: 1_000,
    filled: 1_000,
    limitPrice: 18.2,
    value: 18_200,
    status: "EXECUTED",
    received: "08:58",
    executed: "09:04",
    exchange: "MSE",
    tif: "DAY",
    channel: "Mobile app",
    risk: "LOW",
    instructions: "Execute at limit price or better.",
  },
  {
    id: "ORD-5042",
    client: "Peter Gondwe",
    clientId: "U-0055",
    account: "Individual · 0079",
    ticker: "ILLOVO",
    company: "Illovo Sugar Malawi",
    side: "BUY",
    quantity: 30,
    filled: 0,
    limitPrice: 1_060,
    value: 31_800,
    status: "REVIEW",
    received: "08:40",
    exchange: "MSE",
    tif: "DAY",
    channel: "Web portal",
    risk: "REVIEW",
    instructions: "Client requested a callback before execution.",
  },
  {
    id: "ORD-5041",
    client: "Stella Tembo",
    clientId: "U-0064",
    account: "Individual · 0038",
    ticker: "AIRTEL",
    company: "Airtel Malawi Ltd",
    side: "SELL",
    quantity: 300,
    filled: 300,
    limitPrice: 21.4,
    value: 6_420,
    status: "EXECUTED",
    received: "08:12",
    executed: "08:18",
    exchange: "MSE",
    tif: "DAY",
    channel: "Mobile app",
    risk: "LOW",
    instructions: "Execute at limit price or better.",
  },
];

type DisplayStatus = OrderStatus;

const fmtMoney = (n: number) =>
  `MK ${n.toLocaleString("en-MW", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const fmtShares = (n: number) => n.toLocaleString("en-MW");

function statusLabel(status: DisplayStatus) {
  return status === "READY"
    ? "Ready"
    : status === "PARTIAL"
      ? "Partial fill"
      : status === "EXECUTED"
        ? "Executed"
        : status === "REVIEW"
          ? "Review"
          : status === "REJECTED"
            ? "Rejected"
            : "Cancelled";
}

function statusClass(status: DisplayStatus) {
  const classes: Record<DisplayStatus, string> = {
    READY: "bg-pine/10 text-pine",
    PARTIAL: "bg-sky/10 text-sky",
    EXECUTED: "bg-muted text-muted-foreground",
    REVIEW: "bg-amber/15 text-amber-700 dark:text-amber-300",
    REJECTED: "bg-rose/10 text-rose-500",
    CANCELLED: "bg-muted text-muted-foreground",
  };
  return classes[status];
}

function StatusPill({ status }: { status: DisplayStatus }) {
  const Icon =
    status === "READY"
      ? Clock3
      : status === "PARTIAL"
        ? RefreshCw
        : status === "EXECUTED"
          ? CheckCircle2
          : status === "REVIEW"
            ? CircleAlert
            : XCircle;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(status)}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {statusLabel(status)}
    </span>
  );
}

function SideBadge({ side }: { side: OrderSide }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${side === "BUY" ? "text-pine" : "text-rose-500"}`}
    >
      {side === "BUY" ? (
        <ArrowUpRight className="h-3.5 w-3.5" />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" />
      )}
      {side}
    </span>
  );
}

function KpiStrip({ orders }: { orders: Order[] }) {
  const ready = orders.filter((o) => o.status === "READY" || o.status === "PARTIAL").length;
  const review = orders.filter((o) => o.risk === "REVIEW" || o.status === "REVIEW").length;
  const executed = orders.filter((o) => o.status === "EXECUTED");
  const executedValue = executed.reduce((sum, order) => sum + order.value, 0);
  const kpis = [
    {
      label: "Awaiting execution",
      value: ready,
      detail: "ready for the market",
      icon: Clock3,
      color: "text-amber-600 dark:text-amber-300",
    },
    {
      label: "Needs attention",
      value: review,
      detail: "broker checks required",
      icon: AlertTriangle,
      color: "text-rose-500",
    },
    {
      label: "Executed today",
      value: executed.length,
      detail: `${fmtMoney(executedValue)} settled`,
      icon: CheckCircle2,
      color: "text-pine",
    },
    {
      label: "Orders received",
      value: orders.length,
      detail: "in current blotter",
      icon: ClipboardList,
      color: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 pt-6 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div key={kpi.label} className="rounded-[3px] border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
              {kpi.value}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{kpi.detail}</div>
          </div>
        );
      })}
    </div>
  );
}

function OrderTable({
  orders,
  selectedId,
  onSelect,
}: {
  orders: Order[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[830px] text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {[
              "Order",
              "Client",
              "Side / security",
              "Quantity",
              "Limit",
              "Received",
              "Status",
              "",
            ].map((heading) => (
              <th
                key={heading}
                className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground first:pl-4 last:pr-4"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-14 text-center text-sm text-muted-foreground">
                No orders match this view.
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const selected = order.id === selectedId;
              const displayStatus = order.status;
              return (
                <tr
                  key={order.id}
                  onClick={() => onSelect(order.id)}
                  className={`cursor-pointer border-b border-border last:border-0 transition-colors ${selected ? "bg-pine/5" : "hover:bg-muted/30"}`}
                >
                  <td className="px-3 py-3.5 first:pl-4">
                    <div className="font-mono text-[11px] font-semibold">{order.id}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {order.tif} · {order.exchange}
                    </div>
                  </td>
                  <td className="max-w-[150px] px-3 py-3.5">
                    <div className="truncate font-medium">{order.client}</div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">
                      {order.account}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <SideBadge side={order.side} />
                    <div className="mt-1 font-semibold">{order.ticker}</div>
                    <div className="max-w-[130px] truncate text-[11px] text-muted-foreground">
                      {order.company}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="font-medium">{fmtShares(order.quantity)}</div>
                    {order.filled > 0 && order.filled < order.quantity && (
                      <div className="mt-1 text-[11px] text-sky">
                        {fmtShares(order.filled)} filled
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="font-medium">{fmtMoney(order.limitPrice)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {fmtMoney(order.value)} est.
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-muted-foreground">
                    {order.received}
                  </td>
                  <td className="px-3 py-3.5">
                    <StatusPill status={displayStatus} />
                  </td>
                  <td className="px-3 py-3.5 pr-4">
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${selected ? "rotate-90 text-pine" : ""}`}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{children}</span>
    </div>
  );
}

function OrderDetailPanel({
  order,
  onClose,
  onExecute,
  onReject,
  onCancel,
}: {
  order: Order;
  onClose: () => void;
  onExecute: (quantity: number) => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const remaining = order.quantity - order.filled;
  const [executionQty, setExecutionQty] = useState(String(remaining));
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    setExecutionQty(String(order.quantity - order.filled));
    setShowReject(false);
  }, [order.id, order.quantity, order.filled]);

  const canExecute =
    order.status === "READY" || order.status === "PARTIAL" || order.status === "REVIEW";
  const qty = Math.max(0, Math.min(remaining, Number(executionQty) || 0));

  return (
    <aside className="sticky top-4 overflow-hidden rounded-[3px] border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{order.id}</span>
            <StatusPill status={order.status} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {order.client} · {order.clientId}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close order details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[calc(100vh-150px)] space-y-5 overflow-y-auto p-5 scrollbar-thin-gray">
        <div className="rounded-[3px] border border-pine/20 bg-pine/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-pine">
            <ShieldCheck className="h-3.5 w-3.5" /> Execution-ready instruction
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{order.instructions}</p>
        </div>

        <section>
          <div className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            ORDER DETAILS
          </div>
          <DetailRow label="Direction">
            <SideBadge side={order.side} />
          </DetailRow>
          <DetailRow label="Security">
            <span className="font-semibold">{order.ticker}</span>
            <span className="ml-1 text-xs text-muted-foreground">· {order.company}</span>
          </DetailRow>
          <DetailRow label="Quantity">{fmtShares(order.quantity)} shares</DetailRow>
          <DetailRow label="Remaining">{fmtShares(remaining)} shares</DetailRow>
          <DetailRow label="Limit price">{fmtMoney(order.limitPrice)}</DetailRow>
          <DetailRow label="Estimated value">
            <span className="font-semibold">{fmtMoney(order.value)}</span>
          </DetailRow>
          <DetailRow label="Time in force">{order.tif}</DetailRow>
          <DetailRow label="Route">{order.exchange}</DetailRow>
        </section>

        <section>
          <div className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            AUDIT TRAIL
          </div>
          <DetailRow label="Received">
            {order.received} · {order.channel}
          </DetailRow>
          <DetailRow label="Executed">{order.executed ?? "Not yet executed"}</DetailRow>
          <DetailRow label="Risk check">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${order.risk === "LOW" ? "text-pine" : "text-amber-600 dark:text-amber-300"}`}
            >
              {order.risk === "LOW" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <CircleAlert className="h-3.5 w-3.5" />
              )}
              {order.risk === "LOW" ? "Passed" : "Manual review"}
            </span>
          </DetailRow>
        </section>

        {canExecute && (
          <section className="space-y-3 border-t border-border pt-4">
            <div>
              <label htmlFor="execution-quantity" className="mb-1.5 block text-xs font-medium">
                Shares executed now
              </label>
              <div className="flex gap-2">
                <input
                  id="execution-quantity"
                  type="number"
                  min={1}
                  max={remaining}
                  value={executionQty}
                  onChange={(event) => setExecutionQty(event.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-[3px] border border-input bg-background px-3 text-sm focus:border-pine/50 focus:outline-none"
                />
                <button
                  onClick={() => setExecutionQty(String(remaining))}
                  className="h-9 rounded-[3px] border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
                >
                  All
                </button>
              </div>
            </div>
            <button
              disabled={qty === 0}
              onClick={() => onExecute(qty)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-pine text-sm font-semibold text-primary-foreground transition-colors hover:bg-pine/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />{" "}
              {qty === remaining ? "Confirm execution" : "Record partial fill"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowReject((current) => !current)}
                className="h-9 rounded-[3px] border border-rose/30 text-xs font-medium text-rose-500 hover:bg-rose/5"
              >
                Reject order
              </button>
              <button
                onClick={onCancel}
                className="h-9 rounded-[3px] border border-border text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel order
              </button>
            </div>
            {showReject && (
              <div className="rounded-[3px] border border-rose/20 bg-rose/5 p-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  Reject this order and remove it from the execution queue?
                </p>
                <button
                  onClick={onReject}
                  className="mt-2 text-xs font-semibold text-rose-500 hover:underline"
                >
                  Yes, reject order
                </button>
              </div>
            )}
          </section>
        )}

        {order.status === "EXECUTED" && (
          <div className="flex items-start gap-2 rounded-[3px] bg-muted/50 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pine" />
            This order is complete. {fmtShares(order.filled)} shares were recorded as executed.
          </div>
        )}
      </div>
    </aside>
  );
}

function NewOrderPanel({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (order: Order) => void;
}) {
  const [form, setForm] = useState({
    client: "",
    clientId: "",
    ticker: "",
    company: "",
    side: "BUY" as OrderSide,
    quantity: "",
    limitPrice: "",
    tif: "DAY" as "DAY" | "GTC",
    channel: "Broker assisted" as Order["channel"],
    instructions: "",
  });

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const limitPrice = Number(form.limitPrice);
    if (!form.client || !form.ticker || !quantity || !limitPrice) return;
    const order: Order = {
      id: `ORD-${5050 + Math.floor(Math.random() * 40)}`,
      client: form.client,
      clientId: form.clientId || "NEW CLIENT",
      account: "Individual · new",
      ticker: form.ticker.toUpperCase(),
      company: form.company || `${form.ticker.toUpperCase()} security`,
      side: form.side,
      quantity,
      filled: 0,
      limitPrice,
      value: quantity * limitPrice,
      status: "READY",
      received: "Just now",
      exchange: "MSE",
      tif: form.tif,
      channel: form.channel,
      risk: "REVIEW",
      instructions: form.instructions || "Review client instructions before routing to the market.",
    };
    onCreate(order);
  };

  const inputClass =
    "h-9 w-full rounded-[3px] border border-input bg-background px-3 text-sm focus:border-pine/50 focus:outline-none";
  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-black/30 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-card shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex-1">
            <div className="text-lg font-semibold">Receive new order</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Format the client instruction before it enters the execution queue.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-muted"
            aria-label="Close new order form"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6">
          <section>
            <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
              CLIENT
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs font-medium">
                Client name
                <input
                  required
                  value={form.client}
                  onChange={(event) => update("client", event.target.value)}
                  placeholder="e.g. Chisomo Banda"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className="text-xs font-medium">
                Client ID
                <input
                  value={form.clientId}
                  onChange={(event) => update("clientId", event.target.value)}
                  placeholder="U-0041"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className="text-xs font-medium">
                Channel
                <select
                  value={form.channel}
                  onChange={(event) => update("channel", event.target.value)}
                  className={`${inputClass} mt-1.5`}
                >
                  <option>Broker assisted</option>
                  <option>Mobile app</option>
                  <option>Web portal</option>
                </select>
              </label>
            </div>
          </section>
          <section>
            <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
              TRADE INSTRUCTION
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium">
                Side
                <select
                  value={form.side}
                  onChange={(event) => update("side", event.target.value)}
                  className={`${inputClass} mt-1.5`}
                >
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                Ticker
                <input
                  required
                  value={form.ticker}
                  onChange={(event) => update("ticker", event.target.value)}
                  placeholder="AIRTEL"
                  className={`${inputClass} mt-1.5 uppercase`}
                />
              </label>
              <label className="col-span-2 text-xs font-medium">
                Security name
                <input
                  value={form.company}
                  onChange={(event) => update("company", event.target.value)}
                  placeholder="Airtel Malawi Ltd"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className="text-xs font-medium">
                Shares
                <input
                  required
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) => update("quantity", event.target.value)}
                  placeholder="500"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className="text-xs font-medium">
                Limit price
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.limitPrice}
                  onChange={(event) => update("limitPrice", event.target.value)}
                  placeholder="21.00"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className="text-xs font-medium">
                Time in force
                <select
                  value={form.tif}
                  onChange={(event) => update("tif", event.target.value)}
                  className={`${inputClass} mt-1.5`}
                >
                  <option value="DAY">Day order</option>
                  <option value="GTC">Good till cancelled</option>
                </select>
              </label>
              <div className="rounded-[3px] border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                <span className="block text-[10px] uppercase tracking-[0.1em]">
                  Estimated value
                </span>
                <span className="mt-1 block font-semibold text-foreground">
                  {form.quantity && form.limitPrice
                    ? fmtMoney(Number(form.quantity) * Number(form.limitPrice))
                    : "—"}
                </span>
              </div>
            </div>
          </section>
          <label className="block text-xs font-medium">
            Broker instructions
            <textarea
              value={form.instructions}
              onChange={(event) => update("instructions", event.target.value)}
              placeholder="Add routing notes, callback requirements, or client limits…"
              rows={4}
              className="mt-1.5 w-full resize-none rounded-[3px] border border-input bg-background px-3 py-2 text-sm focus:border-pine/50 focus:outline-none"
            />
          </label>
          <div className="flex gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 flex-1 rounded-[3px] border border-border text-sm font-medium hover:bg-muted"
            >
              Discard
            </button>
            <button
              type="submit"
              className="h-10 flex-1 rounded-[3px] bg-pine text-sm font-semibold text-primary-foreground hover:bg-pine/90"
            >
              <span className="inline-flex items-center gap-2">
                <FilePlus2 className="h-4 w-4" /> Add to queue
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function exportOrders(orders: Order[]) {
  const headers = [
    "Order ID",
    "Client",
    "Client ID",
    "Side",
    "Ticker",
    "Quantity",
    "Filled",
    "Limit Price",
    "Estimated Value",
    "Status",
    "Time in Force",
    "Received",
    "Exchange",
  ];
  const rows = orders.map((order) => [
    order.id,
    order.client,
    order.clientId,
    order.side,
    order.ticker,
    order.quantity,
    order.filled,
    order.limitPrice,
    order.value,
    statusLabel(order.status),
    order.tif,
    order.received,
    order.exchange,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `pine-order-blotter-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const TAB_FILTERS: { key: string; label: string; filter: (order: Order) => boolean }[] = [
  {
    key: "queue",
    label: "Execution queue",
    filter: (order) =>
      order.status === "READY" || order.status === "PARTIAL" || order.status === "REVIEW",
  },
  { key: "all", label: "All orders", filter: () => true },
  { key: "executed", label: "Executed", filter: (order) => order.status === "EXECUTED" },
  {
    key: "attention",
    label: "Attention",
    filter: (order) =>
      order.risk === "REVIEW" || order.status === "REJECTED" || order.status === "CANCELLED",
  },
];

function OrdersPage() {
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [activeTab, setActiveTab] = useState("queue");
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<"ALL" | OrderSide>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>("ORD-5047");
  const [showFilters, setShowFilters] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [notice, setNotice] = useState("");

  const activeFilter = TAB_FILTERS.find((tab) => tab.key === activeTab) ?? TAB_FILTERS[0];
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesTab = activeFilter.filter(order);
        const matchesSide = sideFilter === "ALL" || order.side === sideFilter;
        const normalizedSearch = search.trim().toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          `${order.id} ${order.client} ${order.clientId} ${order.ticker} ${order.company}`
            .toLowerCase()
            .includes(normalizedSearch);
        return matchesTab && matchesSide && matchesSearch;
      }),
    [activeFilter, orders, search, sideFilter],
  );
  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const updateOrder = (id: string, update: Partial<Order>, message: string) => {
    setOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, ...update } : order)),
    );
    showNotice(message);
  };

  const executeOrder = (quantity: number) => {
    if (!selectedOrder) return;
    const nextFilled = selectedOrder.filled + quantity;
    updateOrder(
      selectedOrder.id,
      {
        filled: nextFilled,
        status: nextFilled >= selectedOrder.quantity ? "EXECUTED" : "PARTIAL",
        executed: nextFilled >= selectedOrder.quantity ? "Just now" : selectedOrder.executed,
      },
      nextFilled >= selectedOrder.quantity
        ? `${selectedOrder.id} marked executed`
        : `${selectedOrder.id} recorded as a partial fill`,
    );
  };

  const addOrder = (order: Order) => {
    setOrders((current) => [order, ...current]);
    setSelectedId(order.id);
    setShowNewOrder(false);
    setActiveTab("queue");
    showNotice(`${order.id} added to the execution queue`);
  };

  return (
    <BrokerShell activeLabel="Orders" title="Orders">
      {notice && (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-[4px] bg-foreground px-4 py-3 text-sm text-background shadow-xl">
          <CheckCircle2 className="h-4 w-4 text-pine-soft" />
          {notice}
        </div>
      )}
      <KpiStrip orders={orders} />

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => showNotice("Order queue is up to date")}
          className="flex h-9 items-center gap-2 rounded-[3px] border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
        <button
          onClick={() => setShowNewOrder(true)}
          className="flex h-9 items-center gap-2 rounded-[3px] bg-pine px-3 text-xs font-semibold text-primary-foreground hover:bg-pine/90"
        >
          <FilePlus2 className="h-3.5 w-3.5" /> Receive order
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ID, client, ticker…"
            className="h-10 w-full rounded-[3px] border border-transparent bg-muted/60 pl-10 pr-3 text-sm focus:border-pine/40 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters((current) => !current)}
          className={`flex h-10 items-center gap-2 rounded-[3px] border px-3 text-sm ${showFilters || sideFilter !== "ALL" ? "border-pine/40 bg-pine/5 text-pine" : "border-border text-muted-foreground hover:bg-muted/40"}`}
        >
          <ListFilter className="h-3.5 w-3.5" /> Filters{" "}
          {sideFilter !== "ALL" && (
            <span className="rounded-full bg-pine px-1.5 text-[10px] text-primary-foreground">
              1
            </span>
          )}
        </button>
        <button
          onClick={() => exportOrders(filteredOrders)}
          className="flex h-10 items-center gap-2 rounded-[3px] border border-border px-3 text-sm text-muted-foreground hover:bg-muted/40"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
        {showFilters && (
          <div className="flex w-full items-center gap-2 rounded-[3px] border border-border bg-card p-3 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">Side</span>
            {(["ALL", "BUY", "SELL"] as const).map((side) => (
              <button
                key={side}
                onClick={() => setSideFilter(side)}
                className={`rounded-[3px] px-2.5 py-1.5 ${sideFilter === side ? "bg-pine/10 font-semibold text-pine" : "text-muted-foreground hover:bg-muted"}`}
              >
                {side === "ALL" ? "All sides" : side}
              </button>
            ))}
            <button
              onClick={() => {
                setSideFilter("ALL");
                setShowFilters(false);
              }}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TAB_FILTERS.map((tab) => {
          const count = orders.filter(tab.filter).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex shrink-0 items-center gap-2 px-3 py-3 text-[13px] font-medium ${activeTab === tab.key ? "text-pine" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${activeTab === tab.key ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"}`}
              >
                {count}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 rounded-full bg-pine" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <BrokerCard
            className="overflow-hidden"
            title={activeFilter.label}
            subtitle={`${filteredOrders.length} orders shown · click an order to review execution details`}
            action={
              <button className="rounded-[3px] p-1.5 text-muted-foreground hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          >
            <OrderTable orders={filteredOrders} selectedId={selectedId} onSelect={setSelectedId} />
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>
                Showing <span className="font-medium text-foreground">{filteredOrders.length}</span>{" "}
                of {orders.length} orders
              </span>
              <span className="hidden sm:inline">Last synced just now</span>
            </div>
          </BrokerCard>
        </div>
        {selectedOrder && (
          <div className="w-full shrink-0 xl:w-[370px]">
            <OrderDetailPanel
              order={selectedOrder}
              onClose={() => setSelectedId(null)}
              onExecute={executeOrder}
              onReject={() =>
                updateOrder(
                  selectedOrder.id,
                  { status: "REJECTED" },
                  `${selectedOrder.id} rejected`,
                )
              }
              onCancel={() =>
                updateOrder(
                  selectedOrder.id,
                  { status: "CANCELLED" },
                  `${selectedOrder.id} cancelled`,
                )
              }
            />
          </div>
        )}
      </div>

      {showNewOrder && <NewOrderPanel onClose={() => setShowNewOrder(false)} onCreate={addOrder} />}
    </BrokerShell>
  );
}
