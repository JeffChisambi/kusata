import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, X } from "lucide-react";
import { Card } from "@/components/broker-shell";
import { Money, fmtMoney, fmtExact } from "@/components/money";
import {
  usePendingWithdrawals, useApproveWithdrawal, useRejectWithdrawal,
  type PendingWithdrawal,
} from "@/hooks/useWithdrawals";
import { relativeTime } from "@/lib/relative-time";

export const Route = createFileRoute("/withdrawals")({
  head: () => ({
    meta: [
      { title: "Withdrawals — Pine Broker Portal" },
      { name: "description", content: "Approve or reject client withdrawal requests." },
    ],
  }),
  component: WithdrawalsPage,
});

function WithdrawalsPage() {
  return (
    <div className="space-y-5">
      <WithdrawalsList />
    </div>
  );
}


type WithdrawalDecision =
  | { kind: "approve"; w: PendingWithdrawal }
  | { kind: "reject"; w: PendingWithdrawal };

function ConfirmDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md rounded-[4px] bg-card border border-border p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-[3px] hover:bg-muted/60 flex items-center justify-center text-muted-foreground" aria-label="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function WithdrawalsList() {
  const { data, isLoading } = usePendingWithdrawals();
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();
  const [decision, setDecision] = useState<WithdrawalDecision | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);
  const rows = data?.withdrawals ?? [];
  const busy = approve.isPending || reject.isPending;

  const showToast = (msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };
  const open = (d: WithdrawalDecision) => { setDecision(d); setReason(""); setError(null); };
  const close = () => { if (!busy) setDecision(null); };

  const confirm = async () => {
    if (!decision) return;
    setError(null);
    try {
      if (decision.kind === "approve") {
        await approve.mutateAsync(decision.w.transactionId);
        showToast(`Approved ${fmtMoney(decision.w.amount)} for ${decision.w.user.name}`);
      } else {
        await reject.mutateAsync({ transactionId: decision.w.transactionId, reason: reason.trim() || undefined });
        showToast(`Rejected ${decision.w.user.name}'s withdrawal`);
      }
      setDecision(null);
    } catch (e: any) {
      setError(e?.message ?? (decision.kind === "approve" ? "Approval failed" : "Rejection failed"));
    }
  };

  return (
    <Card
      title="Withdrawal Requests"
      subtitle="Client withdrawals awaiting your decision — funds stay held until approved"
      action={
        rows.length > 0 ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            {rows.length} pending
          </span>
        ) : undefined
      }
    >
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] rounded-[4px] px-3.5 py-2 text-xs font-medium border shadow-lg ${
          toast.tone === "ok" ? "bg-pine/10 text-pine border-pine/30" : "bg-rose/10 text-rose border-rose/30"
        }`}>{toast.msg}</div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No pending withdrawals</div>
      ) : (
        <div className="space-y-1">
          {rows.map((w) => (
            <div key={w.transactionId} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <Link
                  to="/users/$userId"
                  params={{ userId: w.user.id }}
                  className="text-[13px] font-medium text-foreground truncate block hover:text-pine transition-colors"
                >
                  {w.user.name}
                </Link>
                <div className="text-[11px] text-muted-foreground">
                  {relativeTime(w.requestedAt)} · wallet <Money value={w.walletBalance} />
                </div>
              </div>
              <span className="font-mono text-sm font-semibold shrink-0"><Money value={w.amount} /></span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => open({ kind: "approve", w })}
                  disabled={busy}
                  className="h-7 px-2.5 rounded-[3px] bg-pine text-primary-foreground text-[11px] font-medium hover:bg-pine/90 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => open({ kind: "reject", w })}
                  disabled={busy}
                  className="h-7 px-2.5 rounded-[3px] border border-border text-[11px] font-medium text-muted-foreground hover:bg-rose/10 hover:text-rose disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {decision && (
        <ConfirmDialog
          title={decision.kind === "approve" ? "Approve withdrawal" : "Reject withdrawal"}
          onClose={close}
        >
          <p className="text-xs text-muted-foreground mb-3">
            {decision.kind === "approve" ? (
              <>
                Approve the withdrawal of <strong className="text-foreground">{fmtExact(decision.w.amount)}</strong> for{" "}
                <strong className="text-foreground">{decision.w.user.name}</strong>? This debits their wallet and completes the payout.
              </>
            ) : (
              <>
                Reject <strong className="text-foreground">{decision.w.user.name}</strong>'s withdrawal of{" "}
                <strong className="text-foreground">{fmtExact(decision.w.amount)}</strong>? The held funds return to their available balance.
              </>
            )}
          </p>
          {decision.kind === "reject" && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Reason (optional — shown to the client)"
              className="w-full px-3 py-2.5 rounded-[3px] border border-border bg-transparent text-sm resize-none focus:outline-none focus:border-pine/40 mb-3"
            />
          )}
          {error && <p className="text-xs text-rose mb-3">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={close} disabled={busy} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={busy}
              className={`h-8 px-4 rounded-[3px] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 ${
                decision.kind === "approve" ? "bg-pine text-primary-foreground hover:bg-pine/90" : "bg-rose text-white hover:bg-rose/90"
              }`}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : decision.kind === "approve" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {decision.kind === "approve" ? "Confirm approve" : "Confirm reject"}
            </button>
          </div>
        </ConfirmDialog>
      )}
    </Card>
  );
}
