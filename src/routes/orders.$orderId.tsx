import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
  X,
} from "lucide-react";
import { BrokerShell } from "@/components/broker-shell";
import { ordersStore, type Order, type OrderStatus, type OrderSide } from "@/lib/orders-store";

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({ title: "Order Detail — Pine Broker Portal" }),
  component: OrderDetailPage,
});

const fmtMoney = (n: number) =>
  `MK ${n.toLocaleString("en-MW", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const fmtShares = (n: number) => n.toLocaleString("en-MW");

function statusLabel(status: OrderStatus) {
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

function StatusPill({ status }: { status: OrderStatus }) {
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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{children}</span>
    </div>
  );
}

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | undefined>(() => ordersStore.getById(orderId));
  const [executionQty, setExecutionQty] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [notice, setNotice] = useState("");

  // Keep in sync with store mutations
  useEffect(() => {
    return ordersStore.subscribe(() => {
      setOrder(ordersStore.getById(orderId));
    });
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    const remaining = order.quantity - order.filled;
    setExecutionQty(String(remaining > 0 ? remaining : 0));
    setShowReject(false);
  }, [order?.id]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  if (!order) {
    return (
      <BrokerShell activeLabel="Orders" title="Order not found">
        <div className="flex flex-col items-center gap-4 pt-24 text-center">
          <p className="text-sm text-muted-foreground">
            Order <span className="font-mono font-semibold">{orderId}</span> was not found.
          </p>
          <button
            onClick={() => navigate({ to: "/orders" })}
            className="flex items-center gap-2 rounded-[3px] border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Orders
          </button>
        </div>
      </BrokerShell>
    );
  }

  const remaining = order.quantity - order.filled;
  const canExecute =
    order.status === "READY" || order.status === "PARTIAL" || order.status === "REVIEW";
  const qty = Math.max(0, Math.min(remaining, Number(executionQty) || 0));

  const update = (patch: Partial<Order>, message: string) => {
    ordersStore.update(order.id, patch);
    showNotice(message);
  };

  const executeOrder = () => {
    const nextFilled = order.filled + qty;
    update(
      {
        filled: nextFilled,
        status: nextFilled >= order.quantity ? "EXECUTED" : "PARTIAL",
        executed: nextFilled >= order.quantity ? "Just now" : order.executed,
      },
      nextFilled >= order.quantity
        ? `${order.id} marked executed`
        : `${order.id} recorded as a partial fill`,
    );
  };

  return (
    <BrokerShell activeLabel="Orders" title={`Order ${order.id}`}>
      {notice && (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-[4px] bg-foreground px-4 py-3 text-sm text-background shadow-xl">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => navigate({ to: "/orders" })}
          className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-semibold">{order.id}</span>
          <StatusPill status={order.status} />
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {order.client} · {order.clientId}
        </span>
      </div>

      <div className="grid gap-4 pt-2 lg:grid-cols-2">
        {/* Instruction banner */}
        <div className="col-span-full rounded-[3px] border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Execution-ready instruction
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{order.instructions}</p>
        </div>

        {/* Order details */}
        <div className="rounded-[3px] border border-border bg-card p-5">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            ORDER DETAILS
          </div>
          <DetailRow label="Direction">
            <SideBadge side={order.side} />
          </DetailRow>
          <DetailRow label="Security">
            <span className="font-semibold">{order.ticker}</span>
            <span className="ml-1 text-muted-foreground">· {order.company}</span>
          </DetailRow>
          <DetailRow label="Quantity">{fmtShares(order.quantity)} shares</DetailRow>
          <DetailRow label="Remaining">{fmtShares(remaining)} shares</DetailRow>
          <DetailRow label="Limit price">{fmtMoney(order.limitPrice)}</DetailRow>
          <DetailRow label="Estimated value">
            <span className="font-semibold">{fmtMoney(order.value)}</span>
          </DetailRow>
          <DetailRow label="Time in force">{order.tif}</DetailRow>
          <DetailRow label="Route">{order.exchange}</DetailRow>
        </div>

        {/* Audit trail */}
        <div className="rounded-[3px] border border-border bg-card p-5">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            AUDIT TRAIL
          </div>
          <DetailRow label="Received">
            {order.received} · {order.channel}
          </DetailRow>
          <DetailRow label="Executed">{order.executed ?? "Not yet executed"}</DetailRow>
          <DetailRow label="Risk check">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                order.risk === "LOW" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {order.risk === "LOW" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <CircleAlert className="h-3.5 w-3.5" />
              )}
              {order.risk === "LOW" ? "Passed" : "Manual review"}
            </span>
          </DetailRow>
          <DetailRow label="Account">{order.account}</DetailRow>
          <DetailRow label="Client ID">{order.clientId}</DetailRow>
        </div>

        {/* Execution panel */}
        {canExecute && (
          <div className="col-span-full rounded-[3px] border border-border bg-card p-5">
            <div className="mb-4 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
              EXECUTE ORDER
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 text-xs font-medium" htmlFor="execution-quantity">
                Shares to execute now
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="execution-quantity"
                    type="number"
                    min={1}
                    max={remaining}
                    value={executionQty}
                    onChange={(e) => setExecutionQty(e.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-[3px] border border-input bg-background px-3 text-sm focus:border-border focus:outline-none"
                  />
                  <button
                    onClick={() => setExecutionQty(String(remaining))}
                    className="h-9 rounded-[3px] border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
                  >
                    All
                  </button>
                </div>
              </label>
              <button
                disabled={qty === 0}
                onClick={executeOrder}
                className="flex h-9 items-center gap-2 rounded-[3px] bg-foreground px-5 text-sm font-semibold text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {qty === remaining ? "Confirm execution" : "Record partial fill"}
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowReject((v) => !v)}
                className="h-9 rounded-[3px] border border-border px-4 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Reject order
              </button>
              <button
                onClick={() => {
                  update({ status: "CANCELLED" }, `${order.id} cancelled`);
                  navigate({ to: "/orders" });
                }}
                className="h-9 rounded-[3px] border border-border px-4 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel order
              </button>
            </div>
            {showReject && (
              <div className="mt-3 flex items-center justify-between rounded-[3px] border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Reject this order and remove it from the execution queue?
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      update({ status: "REJECTED" }, `${order.id} rejected`);
                      navigate({ to: "/orders" });
                    }}
                    className="text-xs font-semibold text-foreground hover:underline"
                  >
                    Yes, reject
                  </button>
                  <button onClick={() => setShowReject(false)}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {order.status === "EXECUTED" && (
          <div className="col-span-full flex items-start gap-2 rounded-[3px] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            This order is complete. {fmtShares(order.filled)} shares were recorded as executed.
          </div>
        )}
      </div>
    </BrokerShell>
  );
}
