import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import { useOrders, useRefreshOrders, type Order, type DisplayStatus, type OrderSide } from "@/hooks/useOrders";
import { useCurrentUser, isSuperAdmin } from "@/lib/auth";
import { useTreasuryInvestments, type TreasuryInvestment } from "@/hooks/useTreasuryAdmin";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — Pine Broker Portal" },
      { name: "description", content: "Receive, review, and execute client trade orders." },
    ],
  }),
  component: OrdersPage,
});

const PAGE_SIZE = 50;

const fmtMoney = (n: number) =>
  `MK ${n.toLocaleString("en-MW", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const fmtShares = (n: number) => n.toLocaleString("en-MW");

function statusLabel(status: DisplayStatus) {
  switch (status) {
    case "READY": return "Ready";
    case "PARTIAL": return "Partial fill";
    case "EXECUTED": return "Executed";
    case "SETTLED": return "Settled";
    case "REJECTED": return "Rejected";
    case "CANCELLED": return "Cancelled";
    case "PENDING": return "Pending";
    default: return status;
  }
}

function StatusPill({ status, label }: { status: DisplayStatus; label?: string }) {
  const Icon =
    status === "READY"
      ? Clock3
      : status === "PARTIAL"
        ? RefreshCw
        : status === "EXECUTED" || status === "SETTLED"
          ? CheckCircle2
          : XCircle;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label ?? statusLabel(status)}
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

function KpiStrip({ orders, total }: { orders: Order[]; total: number }) {
  const ready = orders.filter((o) => o.status === "READY" || o.status === "PARTIAL").length;
  const rejected = orders.filter((o) => o.status === "REJECTED" || o.status === "CANCELLED").length;
  const executed = orders.filter((o) => o.status === "EXECUTED" || o.status === "SETTLED");
  const executedValue = executed.reduce((sum, order) => sum + order.value, 0);
  const kpis = [
    { label: "Awaiting execution", value: ready, detail: "ready for the market", icon: Clock3 },
    { label: "Needs attention", value: rejected, detail: "rejected / cancelled", icon: AlertTriangle },
    { label: "Executed", value: executed.length, detail: `${fmtMoney(executedValue)} total value`, icon: CheckCircle2 },
    { label: "Total orders", value: total, detail: "across all pages", icon: ClipboardList },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
  // Platform admins observe across brokers — label every row with its owner.
  const superAdmin = isSuperAdmin(useCurrentUser());
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] table-fixed text-[13px]">
        {/* Fixed shares so the columns space evenly instead of collapsing
            left and leaving the right half of the card blank. */}
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[24%]" />
          <col className="w-[13%]" />
          <col className="w-[20%]" />
          <col className="w-[17%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border">
            {["Client", "Side / security", "Quantity", "Limit", "Status"].map((heading) => (
              <th
                key={heading}
                className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground first:pl-4 last:pr-4 last:text-right text-left"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-14 text-center text-sm text-muted-foreground">
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
                <td className="px-3 py-3.5 first:pl-4">
                  <div className="truncate font-medium">{order.client}</div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground font-mono">{order.id.slice(0, 8)}</div>
                  {superAdmin && order.brokerName && (
                    <div className="mt-1 inline-flex items-center rounded-[3px] border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {order.brokerName}
                    </div>
                  )}
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
                  {/* Limit orders show their limit; market orders say so instead of "MK 0" */}
                  <div className="font-medium">
                    {order.limitPrice > 0 ? fmtMoney(order.limitPrice) : "Market"}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {order.avgFillPrice
                      ? `${fmtMoney(order.avgFillPrice)} fill`
                      : `${fmtMoney(order.value)} est.`}
                  </div>
                </td>
                <td className="px-3 py-3.5 pr-4 text-right">
                  {/* One status only. "Ready" and "Awaiting execution" side by side
                      read as two different states of the same order. */}
                  <StatusPill status={order.status} label={order.backendStatus === "SUBMITTED" ? "Awaiting" : undefined} />
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
  const headers = ["Order ID", "Client", "Client ID", "Side", "Ticker", "Quantity", "Filled", "Limit Price", "Estimated Value", "Status", "Received"];
  const rows = orders.map((o) => [o.id, o.client, o.clientId, o.side, o.ticker, o.quantity, o.filled, o.limitPrice, o.value, statusLabel(o.status), o.received]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `pine-order-blotter-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function TreasuryOrderTable({ investments }: { investments: TreasuryInvestment[] }) {
  const mwk = (n: number) => `MK ${n.toLocaleString("en-MW")}`;
  const fmt = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  if (investments.length === 0) {
    return <div className="py-14 text-center text-sm text-muted-foreground">No treasury bill orders yet.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <th className="pl-1 py-2.5 text-left font-medium">Investor</th>
            <th className="py-2.5 text-left font-medium">Tenor</th>
            <th className="py-2.5 text-left font-medium">Amount</th>
            <th className="py-2.5 text-left font-medium">Maturity value</th>
            <th className="py-2.5 text-left font-medium">Maturity</th>
            <th className="py-2.5 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {investments.map((iv) => (
            <tr key={iv.investmentId} className="border-b border-border hover:bg-muted/20">
              <td className="pl-1 py-3">
                <div className="font-medium text-[13px]">{iv.user?.name ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground">{iv.user?.phone ?? ""}</div>
              </td>
              <td className="py-3 text-muted-foreground">{iv.product?.duration ?? iv.product?.tenorDays ?? "—"}-Day T-bill</td>
              <td className="py-3 font-medium">{mwk(Number(iv.amount))}</td>
              <td className="py-3 text-pine">{mwk(Number(iv.maturityValue))}</td>
              <td className="py-3 text-muted-foreground whitespace-nowrap">{fmt(iv.maturityDate)}</td>
              <td className="py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{iv.status.toLowerCase()}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersPage() {
  const [sideFilter, setSideFilter] = useState<"ALL" | OrderSide | "TREASURY">("ALL");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const refreshOrders = useRefreshOrders();
  const isTreasury = sideFilter === "TREASURY";
  // No date window: the blotter shows the book as it stands right now, so an
  // order left pending for a fortnight can never fall silently out of view.
  useEffect(() => { setPage(1); }, [sideFilter]);

  const { data, isLoading, isError, error, isFetching } = useOrders({
    ...(sideFilter === "ALL" || isTreasury ? {} : { side: sideFilter as OrderSide }),
    page,
    limit: PAGE_SIZE,
  });
  const treasury = useTreasuryInvestments();

  const orders = data?.orders ?? [];
  const total = isTreasury ? (treasury.data?.investments?.length ?? 0) : (data?.total ?? 0);
  const totalPages = data?.totalPages ?? 1;
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  const showNotice = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(""), 2800); };
  const orderViewLabel = sideFilter === "ALL" ? "All orders" : `${sideFilter === "BUY" ? "Buy" : "Sell"} orders`;

  return (
    <>
      {notice && (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-[4px] bg-foreground px-4 py-3 text-sm text-background shadow-xl">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}
      <KpiStrip orders={orders} total={total} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="sr-only" htmlFor="order-side-filter">Order type</label>
        <div className="relative">
          <select
            id="order-side-filter"
            value={sideFilter}
            onChange={(event) => setSideFilter(event.target.value as "ALL" | OrderSide | "TREASURY")}
            className="h-10 min-w-36 appearance-none rounded-[3px] border border-border bg-card pl-3 pr-8 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-pine/20"
          >
            <option value="ALL">All orders</option>
            <option value="BUY">Buy orders</option>
            <option value="SELL">Sell orders</option>
            <option value="TREASURY">Treasury bill orders</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => { refreshOrders(); showNotice("Refreshing orders…"); }}
            className="flex h-10 items-center gap-2 rounded-[3px] border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={() => exportOrders(orders)}
            disabled={isTreasury || orders.length === 0}
            title="Downloads the orders shown on this page as CSV"
            className="flex h-10 items-center gap-2 rounded-[3px] border border-border px-3 text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Export page
          </button>
        </div>
      </div>

      <Card
        className="overflow-hidden"
        title={orderViewLabel}
        subtitle={
          isLoading
            ? "Loading orders…"
            : isError
              ? `Error: ${(error as Error)?.message ?? 'Failed to load'}`
              : `${orders.length} of ${total} orders · click an order to open`
        }
      >
        {isTreasury ? (
          treasury.isLoading ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading treasury orders…
            </div>
          ) : (
            <TreasuryOrderTable investments={treasury.data?.investments ?? []} />
          )
        ) : isLoading ? (
          <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading orders from server…
          </div>
        ) : (
          <OrderTable orders={orders} />
        )}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          {isTreasury ? (
            <span>Showing <span className="font-medium text-foreground">{treasury.data?.investments?.length ?? 0}</span> of {total} treasury orders</span>
          ) : (
            <>
              <span>
                {total === 0 ? "No orders" : <>Showing <span className="font-medium text-foreground">{pageStart}–{pageEnd}</span> of {total.toLocaleString()} orders</>}
                {isFetching && !isLoading && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
              </span>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline">Auto-refreshes every 15s</span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="h-7 px-2 rounded-[3px] border border-border text-[11px] hover:bg-muted/40 disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3 h-3" /> Prev
                    </button>
                    <span className="text-[11px]">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="h-7 px-2 rounded-[3px] border border-border text-[11px] hover:bg-muted/40 disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      Next <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

    </>
  );
}
