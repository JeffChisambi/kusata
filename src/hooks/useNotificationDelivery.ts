/**
 * useNotificationDelivery
 *
 * Mounted once in the persistent dashboard shell. Raises a desktop (browser)
 * notification when something lands in the BROKER'S OWN work queue — a new
 * KYC application to review, a withdrawal awaiting approval, a client waiting
 * on a support reply.
 *
 * It deliberately does NOT watch the client notification log. Those messages
 * belong to investors and end with them: a broker should never get an OS
 * popup because a client received their own deposit receipt.
 *
 * The queue present at mount is recorded as "seen" without alerting, so only
 * things arriving while the dashboard is open raise a notification. Delivery
 * is gated inside showNotification() by OS permission plus the per-device
 * opt-in, so this hook is always safe to run.
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKycQueue } from "./useKyc";
import { usePendingWithdrawals } from "./useWithdrawals";
import { showNotification } from "@/lib/browser-notifications";

type QueueItem = {
  /** Stable id so the same item never alerts twice. */
  key: string;
  title: string;
  body: string;
  to: string;
};

export function useNotificationDelivery() {
  const navigate = useNavigate();
  const { data: kyc } = useKycQueue({ status: "PENDING", limit: 20 });
  const { data: withdrawals } = usePendingWithdrawals();

  // null until the first successful load — used to skip the existing backlog.
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Wait until both queues have answered once, so the backlog snapshot is
    // complete and nothing old is announced as new.
    if (kyc === undefined || withdrawals === undefined) return;

    const items: QueueItem[] = [
      ...(kyc?.applications ?? []).map((a) => ({
        key: `kyc:${a.id}`,
        title: "New KYC application",
        body: `${a.userName ?? "An investor"} is waiting for review.`,
        to: "/kyc",
      })),
      ...(withdrawals?.withdrawals ?? []).map((w) => ({
        key: `withdrawal:${w.transactionId}`,
        title: "Withdrawal awaiting approval",
        body: `${w.user.name} requested MK ${w.amount.toLocaleString()}.`,
        to: "/",
      })),
    ];

    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.key));
      return;
    }

    for (const item of items) {
      if (seen.current.has(item.key)) continue;
      seen.current.add(item.key);
      showNotification(item.title, {
        body: item.body,
        tag: item.key,
        onClick: () => navigate({ to: item.to }),
      });
    }
  }, [kyc, withdrawals, navigate]);
}
