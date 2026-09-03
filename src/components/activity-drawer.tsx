/**
 * Recent activity — a floating bell on the overview and the panel it opens.
 *
 * The overview used to carry four cards (orders, KYC, withdrawals, support)
 * that were really a feed: things that had happened and might need attention.
 * They pushed the figures a broker opens the dashboard for below the fold.
 * They now live here, five per category with a way through to the full
 * section, leaving the overview to its numbers.
 *
 * The bell can be dragged up and down the right edge so it never sits on top
 * of whatever the broker is reading; its position is remembered per device.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowDownRight, Headphones, X } from "lucide-react";
import { NotificationsIcon } from "@/components/pine-icons";
import { Money } from "@/components/money";
import { relativeTime } from "@/lib/relative-time";
import { useOrders } from "@/hooks/useOrders";
import { useKycQueue } from "@/hooks/useKyc";
import { usePendingWithdrawals } from "@/hooks/useWithdrawals";
import { useSupportTickets } from "@/hooks/useSupport";

const MAX_PER_GROUP = 5;
const BELL_POS_KEY = "pine-activity-bell-top";
/** Keep the bell clear of the window edges however far it is dragged. */
const EDGE_MARGIN = 72;

export function ActivityDrawer() {
  const [open, setOpen] = useState(false);

  // Mounted separately from `open` so the panel can animate out before it is
  // removed from the tree.
  const [visible, setVisible] = useState(false);
  // Drives the transform. Kept a frame behind `visible` so the panel paints
  // off-screen first and the browser has a start value to animate FROM —
  // without this the transition is skipped and the panel simply appears.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setVisible(false), 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const count = usePendingCount();

  return (
    <>
      <FloatingBell count={count} open={open} onToggle={() => setOpen((o) => !o)} />
      {visible && <Panel open={shown} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Everything actually waiting on the broker — drives the badge. */
function usePendingCount() {
  const { data: kyc } = useKycQueue({ status: "PENDING", limit: 1 });
  const { data: withdrawals } = usePendingWithdrawals();
  const { data: tickets } = useSupportTickets({ status: "OPEN" });

  return (
    (kyc?.count ?? 0) +
    (withdrawals?.withdrawals?.length ?? 0) +
    (tickets?.total ?? tickets?.tickets?.length ?? 0)
  );
}

// ─── The bell ─────────────────────────────────────────────────────────────────

function FloatingBell({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const [top, setTop] = useState<number | null>(null);
  const dragging = useRef(false);
  // Distinguishes a drag from a click: a few pixels of travel is still a click.
  const moved = useRef(false);
  const offset = useRef(0);

  useEffect(() => {
    const stored = Number(localStorage.getItem(BELL_POS_KEY));
    setTop(Number.isFinite(stored) && stored > 0 ? clampY(stored) : 96);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    offset.current = e.clientY - (top ?? 0);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const next = clampY(e.clientY - offset.current);
      if (Math.abs(next - (top ?? 0)) > 3) moved.current = true;
      setTop(next);
    },
    [top],
  );

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (top != null) localStorage.setItem(BELL_POS_KEY, String(top));
    // A press that never travelled is a click, not the end of a drag.
    if (!moved.current) onToggle();
  };

  if (top == null) return null;

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ top }}
      className={`fixed right-6 z-40 w-11 h-11 rounded-full border shadow-lg flex items-center justify-center touch-none select-none transition-colors ${
        open
          ? "bg-pine text-primary-foreground border-pine"
          : "bg-card text-muted-foreground border-border hover:text-foreground"
      }`}
      title="Recent activity — drag to move"
      aria-label={count > 0 ? `Recent activity — ${count} awaiting you` : "Recent activity"}
      aria-expanded={open}
    >
      <NotificationsIcon className="w-[18px] h-[18px]" />
      {count > 0 && !open && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function clampY(y: number) {
  const max = Math.max(EDGE_MARGIN, window.innerHeight - EDGE_MARGIN);
  return Math.min(Math.max(y, EDGE_MARGIN), max);
}

// ─── The panel ────────────────────────────────────────────────────────────────

function Panel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const orders = useOrders({ limit: MAX_PER_GROUP });
  const kyc = useKycQueue({ limit: MAX_PER_GROUP });
  const withdrawals = usePendingWithdrawals();
  const tickets = useSupportTickets({ status: "OPEN" });

  const withdrawalRows = (withdrawals.data?.withdrawals ?? []).slice(0, MAX_PER_GROUP);
  const kycRows = (kyc.data?.applications ?? []).slice(0, MAX_PER_GROUP);
  const orderRows = (orders.data?.orders ?? []).slice(0, MAX_PER_GROUP);
  const ticketRows = (tickets.data?.tickets ?? []).slice(0, MAX_PER_GROUP);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ease-out ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-label="Recent activity"
        style={{
          transitionTimingFunction: open
            ? "cubic-bezier(0.22, 1, 0.36, 1)"   // decelerate in — settles, no bounce
            : "cubic-bezier(0.4, 0, 1, 1)",      // accelerate out — gets out of the way
        }}
        className={`fixed right-0 top-0 z-50 h-screen w-full max-w-[400px] bg-card border-l border-border shadow-2xl flex flex-col transition-transform ${
          open ? "translate-x-0 duration-[320ms]" : "translate-x-full duration-200"
        }`}
      >
        <header className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <p className="text-[11px] text-muted-foreground">The latest across your desk</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[4px] flex items-center justify-center text-muted-foreground hover:bg-muted/60"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin-gray">
          <Group
            title="Withdrawal requests"
            to="/withdrawals"
            count={withdrawals.data?.withdrawals?.length}
            loading={withdrawals.isLoading}
            empty="No pending withdrawals"
          >
            {withdrawalRows.map((w) => (
              <Row
                key={w.transactionId}
                to="/users/$userId"
                params={{ userId: w.user.id }}
                title={w.user.name}
                meta={relativeTime(w.requestedAt)}
                amount={w.amount}
                tag={{ label: "Awaiting you", tone: "amber" }}
              />
            ))}
          </Group>

          <Group
            title="KYC applications"
            to="/kyc"
            count={kyc.data?.count}
            loading={kyc.isLoading}
            empty="No applications"
          >
            {kycRows.map((a) => (
              <Row
                key={a.id}
                to="/kyc/$applicationId"
                params={{ applicationId: a.id }}
                title={a.userName}
                meta={relativeTime(a.submittedAt)}
                tag={{
                  label: a.status,
                  tone:
                    a.status === "PENDING" ? "amber" : a.status === "APPROVED" ? "pine" : "rose",
                }}
              />
            ))}
          </Group>

          <Group
            title="Orders"
            to="/orders"
            count={orders.data?.total}
            loading={orders.isLoading}
            empty="No orders yet"
          >
            {orderRows.map((o) => (
              <Row
                key={o.id}
                to="/orders/$orderId"
                params={{ orderId: o.id }}
                icon={o.side === "BUY" ? ArrowUpRight : ArrowDownRight}
                title={`${o.side} ${o.quantity.toLocaleString("en-MW")} × ${o.ticker}`}
                meta={`${o.client} · ${relativeTime(o.received)}`}
                amount={o.value}
                tag={{
                  label:
                    o.status === "READY" && o.backendStatus === "SUBMITTED"
                      ? "AWAITING"
                      : o.status,
                  tone:
                    o.status === "REJECTED"
                      ? "rose"
                      : o.status === "EXECUTED" || o.status === "SETTLED"
                        ? "pine"
                        : "amber",
                }}
              />
            ))}
          </Group>

          <Group
            title="Support tickets"
            to="/support"
            count={tickets.data?.total}
            loading={tickets.isLoading}
            empty="No open tickets"
          >
            {ticketRows.map((t) => (
              <Row
                key={t.ticketId}
                to="/support/$ticketId"
                params={{ ticketId: t.ticketId }}
                icon={Headphones}
                title={t.subject}
                meta={`${t.user?.name ?? "Unknown user"} · ${relativeTime(t.lastMessageAt)}`}
                tag={
                  t.awaitingAdmin
                    ? { label: "Reply due", tone: "amber" }
                    : { label: t.statusLabel, tone: "muted" }
                }
              />
            ))}
          </Group>
        </div>
      </aside>
    </>
  );
}

function Group({
  title,
  to,
  count,
  loading,
  empty,
  children,
}: {
  title: string;
  to: string;
  count?: number;
  loading: boolean;
  empty: string;
  children: React.ReactNode[];
}) {
  const rows = children.filter(Boolean);
  const hidden = typeof count === "number" ? count - rows.length : 0;

  return (
    <section className="border-b border-border last:border-0">
      <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h3>
        <Link to={to} className="text-[11px] text-pine hover:underline flex items-center gap-1">
          View all{typeof count === "number" ? ` (${count.toLocaleString()})` : ""}
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <p className="px-5 pb-4 text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 pb-4 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <>
          <div className="pb-1">{rows}</div>
          {hidden > 0 && (
            <p className="px-5 pb-3 text-[11px] text-muted-foreground/70">
              {hidden.toLocaleString()} more not shown
            </p>
          )}
        </>
      )}
    </section>
  );
}

type Tone = "amber" | "pine" | "rose" | "muted";
const TONE: Record<Tone, string> = {
  amber: "text-amber",
  pine: "text-pine",
  rose: "text-rose",
  muted: "text-muted-foreground",
};

function Row({
  to,
  params,
  icon: Icon,
  title,
  meta,
  amount,
  tag,
}: {
  to: string;
  params?: Record<string, string>;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  meta: string;
  amount?: number;
  tag?: { label: string; tone: Tone };
}) {
  return (
    <Link
      to={to}
      params={params as never}
      className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors"
    >
      {Icon && (
        <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-foreground truncate">{title}</span>
        <span className="block text-[11px] text-muted-foreground truncate">{meta}</span>
      </span>
      <span className="shrink-0 text-right">
        {amount != null && (
          <span className="block font-mono text-xs font-semibold">
            <Money value={amount} />
          </span>
        )}
        {tag && <span className={`block text-[10px] font-semibold ${TONE[tag.tone]}`}>{tag.label}</span>}
      </span>
    </Link>
  );
}
