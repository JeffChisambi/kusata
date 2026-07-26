import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { BrokerShell } from "@/components/broker-shell";
import { useOrder, type DisplayStatus, type OrderSide } from "@/hooks/useOrders";

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({ title: "Order Detail — Pine Broker Portal" }),
  component: OrderDetailPage,
});

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

function StatusPill({ status }: { status: DisplayStatus }) {
  const Icon =
    status === "READY"
      ? Clock3
      : status === "PARTIAL"
        ? RefreshCw
        : status === "EXECUTED" || status === "SETTLED"
          ? CheckCircle2
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
  const { data: order, isLoading, isError, error } = useOrder(orderId);

  if (isLoading) {
    return (
      <BrokerShell activeLabel="Orders" title="Loading…">
        <div className="flex flex-col items-center gap-4 pt-24 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading order details…</p>
        </div>
      </BrokerShell>
    );
  }

  if (isError || !order) {
    return (
      <BrokerShell activeLabel="Orders" title="Order not found">
        <div className="flex flex-col items-center gap-4 pt-24 text-center">
          <p className="text-sm text-muted-foreground">
            {isError
              ? `Error loading order: ${(error as Error)?.message ?? 'Unknown error'}`
              : <>Order <span className="font-mono font-semibold">{orderId}</span> was not found.</>
            }
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

  return (
    <BrokerShell activeLabel="Orders" title={`Order ${order.id.slice(0, 8)}…`}>
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => navigate({ to: "/orders" })}
          className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-semibold">{order.id.slice(0, 8)}</span>
          <StatusPill status={order.status} />
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {order.client} · {order.clientId.slice(0, 8)}
        </span>
      </div>

      <div className="grid gap-4 pt-2 lg:grid-cols-2">
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
          <DetailRow label="Type">{order.type}</DetailRow>
          <DetailRow label="Quantity">{fmtShares(order.quantity)} shares</DetailRow>
          <DetailRow label="Filled">{fmtShares(order.filled)} shares</DetailRow>
          <DetailRow label="Remaining">{fmtShares(remaining)} shares</DetailRow>
          <DetailRow label="Limit price">{order.limitPrice ? fmtMoney(order.limitPrice) : 'Market'}</DetailRow>
          {order.avgFillPrice && (
            <DetailRow label="Avg fill price">{fmtMoney(order.avgFillPrice)}</DetailRow>
          )}
          <DetailRow label="Estimated value">
            <span className="font-semibold">{fmtMoney(order.value)}</span>
          </DetailRow>
          <DetailRow label="Fees">{fmtMoney(order.fees)}</DetailRow>
          <DetailRow label="Backend status">{order.backendStatus}</DetailRow>
          {order.brokerRef && <DetailRow label="Broker ref">{order.brokerRef}</DetailRow>}
        </div>

        {/* Audit trail */}
        <div className="rounded-[3px] border border-border bg-card p-5">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            TIMELINE
          </div>
          <DetailRow label="Created">{new Date(order.received).toLocaleString()}</DetailRow>
          <DetailRow label="Executed">{order.executed ? new Date(order.executed).toLocaleString() : "Not yet"}</DetailRow>
          {order.rejectionReason && (
            <DetailRow label="Rejection reason">{order.rejectionReason}</DetailRow>
          )}
          <DetailRow label="Client">{order.client}</DetailRow>
          {(order as any).user?.phone && (
            <DetailRow label="Phone">{(order as any).user.phone}</DetailRow>
          )}

          {/* Executions sub-table */}
          {(order as any).executions?.length > 0 && (
            <>
              <div className="mt-4 mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                EXECUTIONS
              </div>
              {(order as any).executions.map((exec: any) => (
                <DetailRow key={exec.id} label={new Date(exec.executedAt).toLocaleString()}>
                  {fmtShares(parseFloat(exec.quantity))} @ {fmtMoney(parseFloat(exec.price))}
                </DetailRow>
              ))}
            </>
          )}

          {/* Trades sub-table */}
          {(order as any).trades?.length > 0 && (
            <>
              <div className="mt-4 mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                TRADES
              </div>
              {(order as any).trades.map((trade: any) => (
                <DetailRow key={trade.id} label={new Date(trade.createdAt).toLocaleString()}>
                  {fmtShares(parseFloat(trade.quantity))} @ {fmtMoney(parseFloat(trade.price))}
                  {trade.settlement && (
                    <span className="ml-2 text-[10px] text-muted-foreground">({trade.settlement.status})</span>
                  )}
                </DetailRow>
              ))}
            </>
          )}
        </div>

        {/* Completion banner */}
        {(order.status === "EXECUTED" || order.status === "SETTLED") && (
          <div className="col-span-full flex items-start gap-2 rounded-[3px] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            This order is complete. {fmtShares(order.filled)} shares were filled.
          </div>
        )}

        {order.status === "REJECTED" && (
          <div className="col-span-full flex items-start gap-2 rounded-[3px] border border-border bg-rose/5 p-4 text-sm text-muted-foreground">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            This order was rejected.{order.rejectionReason ? ` Reason: ${order.rejectionReason}` : ''}
          </div>
        )}
      </div>
    </BrokerShell>
  );
}
