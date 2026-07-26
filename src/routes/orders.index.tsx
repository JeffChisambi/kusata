import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
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
  X,
  XCircle,
} from "lucide-react";
import { BrokerCard, BrokerShell } from "@/components/broker-shell";
import { ordersStore, type Order, type OrderStatus, type OrderSide } from "@/lib/orders-store";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — Pine Broker Portal" },
      { name: "description", content: "Receive, review, and execute client trade orders." },
    ],
  }),
  component: OrdersPage,
});

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
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {statusLabel(status)}
    </span>
  );
}

function SideBadge({ side }: { side: OrderSide }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
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
    { label: "Awaiting execution", value: ready, detail: "ready for the market", icon: Clock3 },
    { label: "Needs attention", value: review, detail: "broker checks required", icon: AlertTriangle },
    { label: "Executed today", value: executed.length, detail: `${fmtMoney(executedValue)} settled`, icon: CheckCircle2 },
    { label: "Orders received", value: orders.length, detail: "in current blotter", icon: ClipboardList },
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
            <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">{kpi.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{kpi.detail}</div>
          </div>
        );
      })}
    </div>
  );
}

function OrderTable({ orders }: { orders: Order[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {["Client", "Side / security", "Quantity", "Limit", "Status", ""].map((heading) => (
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
              <td colSpan={6} className="px-4 py-14 text-center text-sm text-muted-foreground">
                No orders match this view.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr
                key={order.id}
                onClick={() => navigate({ to: "/orders/$orderId", params: { orderId: order.id } })}
                className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/30"
              >
                <td className="max-w-[150px] px-3 py-3.5 first:pl-4">
                  <div className="truncate font-medium">{order.client}</div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">{order.account}</div>
                </td>
                <td className="px-3 py-3.5">
                  <SideBadge side={order.side} />
                  <div className="mt-1 font-semibold">{order.ticker}</div>
                  <div className="max-w-[130px] truncate text-[11px] text-muted-foreground">{order.company}</div>
                </td>
                <td className="px-3 py-3.5">
                  <div className="font-medium">{fmtShares(order.quantity)}</div>
                  {order.filled > 0 && order.filled < order.quantity && (
                    <div className="mt-1 text-[11px] text-muted-foreground">{fmtShares(order.filled)} filled</div>
                  )}
                </td>
                <td className="px-3 py-3.5">
                  <div className="font-medium">{fmtMoney(order.limitPrice)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{fmtMoney(order.value)} est.</div>
                </td>
                <td className="px-3 py-3.5">
                  <StatusPill status={order.status} />
                </td>
                <td className="px-3 py-3.5 pr-4">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function NewOrderPanel({ onClose, onCreate }: { onClose: () => void; onCreate: (order: Order) => void }) {
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
    onCreate({
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
    });
  };

  const inputClass = "h-9 w-full rounded-[3px] border border-input bg-background px-3 text-sm focus:border-border focus:outline-none";
  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/30 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex-1">
            <div className="text-lg font-semibold">Receive new order</div>
            <p className="mt-1 text-xs text-muted-foreground">Format the client instruction before it enters the execution queue.</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6">
          <section>
            <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">CLIENT</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs font-medium">
                Client name
                <input required value={form.client} onChange={(e) => update("client", e.target.value)} placeholder="e.g. Chisomo Banda" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="text-xs font-medium">
                Client ID
                <input value={form.clientId} onChange={(e) => update("clientId", e.target.value)} placeholder="U-0041" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="text-xs font-medium">
                Channel
                <select value={form.channel} onChange={(e) => update("channel", e.target.value)} className={`${inputClass} mt-1.5`}>
                  <option>Broker assisted</option>
                  <option>Mobile app</option>
                  <option>Web portal</option>
                </select>
              </label>
            </div>
          </section>
          <section>
            <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">TRADE INSTRUCTION</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium">
                Side
                <select value={form.side} onChange={(e) => update("side", e.target.value)} className={`${inputClass} mt-1.5`}>
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                Ticker
                <input required value={form.ticker} onChange={(e) => update("ticker", e.target.value)} placeholder="AIRTEL" className={`${inputClass} mt-1.5 uppercase`} />
              </label>
              <label className="col-span-2 text-xs font-medium">
                Security name
                <input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Airtel Malawi Ltd" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="text-xs font-medium">
                Shares
                <input required type="number" min="1" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} placeholder="500" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="text-xs font-medium">
                Limit price
                <input required type="number" min="0.01" step="0.01" value={form.limitPrice} onChange={(e) => update("limitPrice", e.target.value)} placeholder="21.00" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="text-xs font-medium">
                Time in force
                <select value={form.tif} onChange={(e) => update("tif", e.target.value)} className={`${inputClass} mt-1.5`}>
                  <option value="DAY">Day order</option>
                  <option value="GTC">Good till cancelled</option>
                </select>
              </label>
              <div className="rounded-[3px] border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                <span className="block text-[10px] uppercase tracking-[0.1em]">Estimated value</span>
                <span className="mt-1 block font-semibold text-foreground">
                  {form.quantity && form.limitPrice ? fmtMoney(Number(form.quantity) * Number(form.limitPrice)) : "—"}
                </span>
              </div>
            </div>
          </section>
          <label className="block text-xs font-medium">
            Broker instructions
            <textarea value={form.instructions} onChange={(e) => update("instructions", e.target.value)} placeholder="Add routing notes, callback requirements, or client limits…" rows={4} className="mt-1.5 w-full resize-none rounded-[3px] border border-input bg-background px-3 py-2 text-sm focus:border-border focus:outline-none" />
          </label>
          <div className="flex gap-3 border-t border-border pt-5">
            <button type="button" onClick={onClose} className="h-10 flex-1 rounded-[3px] border border-border text-sm font-medium hover:bg-muted">Discard</button>
            <button type="submit" className="h-10 flex-1 rounded-[3px] bg-pine text-sm font-semibold text-primary-foreground hover:bg-pine/90">
              <span className="inline-flex items-center gap-2"><FilePlus2 className="h-4 w-4" /> Add to queue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function exportOrders(orders: Order[]) {
  const headers = ["Order ID", "Client", "Client ID", "Side", "Ticker", "Quantity", "Filled", "Limit Price", "Estimated Value", "Status", "Time in Force", "Received", "Exchange"];
  const rows = orders.map((o) => [o.id, o.client, o.clientId, o.side, o.ticker, o.quantity, o.filled, o.limitPrice, o.value, statusLabel(o.status), o.tif, o.received, o.exchange]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `pine-order-blotter-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const TAB_FILTERS: { key: string; label: string; filter: (order: Order) => boolean }[] = [
  { key: "queue", label: "Execution queue", filter: (o) => o.status === "READY" || o.status === "PARTIAL" || o.status === "REVIEW" },
  { key: "all", label: "All orders", filter: () => true },
  { key: "executed", label: "Executed", filter: (o) => o.status === "EXECUTED" },
  { key: "attention", label: "Attention", filter: (o) => o.risk === "REVIEW" || o.status === "REJECTED" || o.status === "CANCELLED" },
];

function OrdersPage() {
  const [orders, setOrders] = useState(() => ordersStore.getAll());
  const [activeTab, setActiveTab] = useState("queue");
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<"ALL" | OrderSide>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => ordersStore.subscribe(() => setOrders(ordersStore.getAll())), []);

  const activeFilter = TAB_FILTERS.find((t) => t.key === activeTab) ?? TAB_FILTERS[0];
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesTab = activeFilter.filter(order);
        const matchesSide = sideFilter === "ALL" || order.side === sideFilter;
        const normalizedSearch = search.trim().toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          `${order.id} ${order.client} ${order.clientId} ${order.ticker} ${order.company}`.toLowerCase().includes(normalizedSearch);
        return matchesTab && matchesSide && matchesSearch;
      }),
    [activeFilter, orders, search, sideFilter],
  );

  const showNotice = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(""), 2800); };
  const addOrder = (order: Order) => { ordersStore.add(order); setActiveTab("queue"); showNotice(`${order.id} added to the execution queue`); };

  return (
    <BrokerShell activeLabel="Orders" title="Orders">
      {notice && (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-[4px] bg-foreground px-4 py-3 text-sm text-background shadow-xl">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}
      <KpiStrip orders={orders} />

      <div className="flex items-center justify-end gap-2">
        <button onClick={() => showNotice("Order queue is up to date")} className="flex h-9 items-center gap-2 rounded-[3px] border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
        <button onClick={() => setShowNewOrder(true)} className="flex h-9 items-center gap-2 rounded-[3px] bg-pine px-3 text-xs font-semibold text-primary-foreground hover:bg-pine/90">
          <FilePlus2 className="h-3.5 w-3.5" /> Receive order
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, client, ticker…" className="h-10 w-full rounded-[3px] border border-transparent bg-muted/60 pl-10 pr-3 text-sm focus:border-border focus:outline-none" />
        </div>
        <button onClick={() => setShowFilters((v) => !v)} className={`flex h-10 items-center gap-2 rounded-[3px] border px-3 text-sm ${showFilters || sideFilter !== "ALL" ? "border-border bg-muted text-foreground" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
          <ListFilter className="h-3.5 w-3.5" /> Filters
          {sideFilter !== "ALL" && <span className="rounded-full bg-foreground px-1.5 text-[10px] text-background">1</span>}
        </button>
        <button onClick={() => exportOrders(filteredOrders)} className="flex h-10 items-center gap-2 rounded-[3px] border border-border px-3 text-sm text-muted-foreground hover:bg-muted/40">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
        {showFilters && (
          <div className="flex w-full items-center gap-2 rounded-[3px] border border-border bg-card p-3 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">Side</span>
            {(["ALL", "BUY", "SELL"] as const).map((side) => (
              <button key={side} onClick={() => setSideFilter(side)} className={`rounded-[3px] px-2.5 py-1.5 ${sideFilter === side ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {side === "ALL" ? "All sides" : side}
              </button>
            ))}
            <button onClick={() => { setSideFilter("ALL"); setShowFilters(false); }} className="ml-auto text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TAB_FILTERS.map((tab) => {
          const count = orders.filter(tab.filter).length;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`relative flex shrink-0 items-center gap-2 px-3 py-3 text-[13px] font-medium ${activeTab === tab.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {tab.label}
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${activeTab === tab.key ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}>{count}</span>
              {activeTab === tab.key && <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 rounded-full bg-foreground" />}
            </button>
          );
        })}
      </div>

      <BrokerCard
        className="overflow-hidden"
        title={activeFilter.label}
        subtitle={`${filteredOrders.length} orders shown · click an order to open`}
        action={<button className="rounded-[3px] p-1.5 text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>}
      >
        <OrderTable orders={filteredOrders} />
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Showing <span className="font-medium text-foreground">{filteredOrders.length}</span> of {orders.length} orders</span>
          <span className="hidden sm:inline">Last synced just now</span>
        </div>
      </BrokerCard>

      {showNewOrder && <NewOrderPanel onClose={() => setShowNewOrder(false)} onCreate={addOrder} />}
    </BrokerShell>
  );
}
