/**
 * Desktop (browser) notification delivery.
 *
 * Uses the Web Notifications API so an admin receives OS-level alerts for new
 * notifications while the dashboard is open, even on another tab. The opt-in is
 * per-device (localStorage) and independent of the server-side event
 * preferences (which control what the backend generates in the first place).
 *
 * Everything is SSR-safe and guarded — it no-ops when `window`/`Notification`
 * is unavailable so it never breaks server rendering.
 */
const PREF_KEY = "pine-desktop-notifications";

export type NotifPermission = "granted" | "denied" | "default" | "unsupported";

export function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): NotifPermission {
  if (!isSupported()) return "unsupported";
  return Notification.permission as NotifPermission;
}

export async function requestPermission(): Promise<NotifPermission> {
  if (!isSupported()) return "unsupported";
  try {
    return (await Notification.requestPermission()) as NotifPermission;
  } catch {
    return getPermission();
  }
}

/** Per-device opt-in (separate from OS permission). */
export function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(PREF_KEY, "1");
    else window.localStorage.removeItem(PREF_KEY);
  } catch {
    /* storage blocked — ignore */
  }
}

/** True when we can actually deliver: supported, permitted, and opted in. */
export function canDeliver(): boolean {
  return getPermission() === "granted" && isEnabled();
}

export function showNotification(
  title: string,
  opts?: { body?: string; tag?: string; onClick?: () => void },
): void {
  if (!canDeliver()) return;
  try {
    const n = new Notification(title, {
      body: opts?.body,
      tag: opts?.tag,
      icon: "/favicon.png",
    });
    if (opts?.onClick) {
      n.onclick = () => {
        try { window.focus(); } catch { /* noop */ }
        opts.onClick!();
        n.close();
      };
    }
  } catch {
    /* Some browsers throw when constructing Notifications directly — ignore. */
  }
}
