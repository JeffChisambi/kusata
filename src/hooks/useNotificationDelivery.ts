/**
 * useNotificationDelivery
 *
 * Mounted once in the persistent dashboard shell. Watches the polled admin
 * notifications list and raises a desktop (browser) notification for every
 * genuinely-new item. The initial backlog present at mount is recorded as
 * "seen" without alerting, so the admin is only notified about things that
 * arrive while the dashboard is open.
 *
 * Delivery itself is gated inside showNotification() by OS permission + the
 * per-device opt-in, so this hook is always safe to run.
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useNotificationsList } from "./useNotifications";
import { showNotification } from "@/lib/browser-notifications";

type DeliverItem = { id: string; title: string; body: string };

function extractItems(rawData: unknown): DeliverItem[] {
  if (!rawData) return [];
  let raw: any[] = [];
  if (Array.isArray(rawData)) raw = rawData;
  else {
    const d = rawData as Record<string, unknown>;
    if (Array.isArray(d.notifications)) raw = d.notifications as any[];
    else if (Array.isArray(d.data)) raw = d.data as any[];
  }
  return raw
    .map((n: any) => ({
      id: String(n.id ?? ""),
      title: n.title ?? "New notification",
      body: n.body ?? n.message ?? "",
    }))
    .filter((n) => n.id);
}

export function useNotificationDelivery() {
  const { data } = useNotificationsList();
  const navigate = useNavigate();
  // null until the first successful load — used to skip the initial backlog.
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (data === undefined) return;
    const items = extractItems(data);

    // First load: remember what's already there, don't alert.
    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.id));
      return;
    }

    for (const item of items) {
      if (seen.current.has(item.id)) continue;
      seen.current.add(item.id);
      showNotification(item.title, {
        body: item.body,
        tag: item.id,
        onClick: () => navigate({ to: "/notifications" }),
      });
    }
  }, [data, navigate]);
}
