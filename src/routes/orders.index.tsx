import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  Download,
  MoreHorizontal,
  RefreshCw,
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
              </tr>
            ))
          )}
        </tbody>
      </table>
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

function OrdersPage() {
  const [orders, setOrders] = useState(() => ordersStore.getAll());
  const [sideFilter, setSideFilter] = useState<"ALL" | OrderSide>("ALL");
  const [notice, setNotice] = useState("");

  useEffect(() => ordersStore.subscribe(() => setOrders(ordersStore.getAll())), []);

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesSide = sideFilter === "ALL" || order.side === sideFilter;
        return matchesSide;
      }),
    [orders, sideFilter],
  );

  const showNotice = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(""), 2800); };
  const orderViewLabel = sideFilter === "ALL" ? "All orders" : `${sideFilter === "BUY" ? "Buy" : "Sell"} orders`;

  return (
    <BrokerShell activeLabel="Orders" title="Orders">
      {notice && (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-[4px] bg-foreground px-4 py-3 text-sm text-background shadow-xl">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}
      <KpiStrip orders={orders} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="sr-only" htmlFor="order-side-filter">Order type</label>
        <div className="relative">
          <select
            id="order-side-filter"
            value={sideFilter}
            onChange={(event) => setSideFilter(event.target.value as "ALL" | OrderSide)}
            className="h-10 min-w-36 appearance-none rounded-[3px] border border-border bg-card pl-3 pr-8 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-pine/20"
          >
            <option value="ALL">All orders</option>
            <option value="BUY">Buy orders</option>
            <option value="SELL">Sell orders</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={() => showNotice("Order list is up to date")} className="flex h-10 items-center gap-2 rounded-[3px] border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-muted">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={() => exportOrders(filteredOrders)} className="flex h-10 items-center gap-2 rounded-[3px] border border-border px-3 text-sm text-muted-foreground hover:bg-muted/40">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      <BrokerCard
        className="overflow-hidden"
        title={orderViewLabel}
        subtitle={`${filteredOrders.length} orders shown · click an order to open`}
      >
        <OrderTable orders={filteredOrders} />
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Showing <span className="font-medium text-foreground">{filteredOrders.length}</span> of {orders.length} orders</span>
          <span className="hidden sm:inline">Last synced just now</span>
        </div>
      </BrokerCard>

    </BrokerShell>
  );
}
