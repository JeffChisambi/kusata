/**
 * Idle session handling for the dashboard.
 *
 * A staff session ends after two hours with nobody at the keyboard. The
 * SERVER is the authority — it revokes the session and refuses the refresh
 * token — and this file is the client half:
 *
 *   1. It notices real interaction (pointer, key, scroll, touch) and beats a
 *      heartbeat at most once a minute so the server knows someone is there.
 *      Background polling deliberately does NOT count: the dashboard refetches
 *      every 20-30 seconds on its own, so if requests counted as activity an
 *      abandoned browser would stay signed in indefinitely.
 *
 *   2. It signs the person out locally the moment the window passes, rather
 *      than leaving a screen full of stale figures up until the next request
 *      happens to fail.
 *
 * Interaction is shared between tabs through localStorage, so working in one
 * tab keeps every tab alive.
 */
import { api } from "./api";

/** Must match STAFF_IDLE_TIMEOUT_MINUTES on the server. */
export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
/** At most one heartbeat per minute, however busy the person is. */
const HEARTBEAT_INTERVAL_MS = 60_000;
/** How often the local clock is checked against the last interaction. */
const IDLE_CHECK_MS = 30_000;

const LAST_ACTIVITY_KEY = "pine-last-activity";
const SIGNED_OUT_REASON_KEY = "pine-signed-out-reason";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

function now(): number {
  return Date.now();
}

/** Shared across tabs: working in one keeps the others alive. */
export function lastActivityAt(): number {
  if (typeof window === "undefined") return now();
  const raw = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : now();
}

export function markActive(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_ACTIVITY_KEY, String(now()));
}

/** Why the person was signed out, read once by the login screen. */
export function takeSignOutReason(): string | null {
  if (typeof window === "undefined") return null;
  const reason = localStorage.getItem(SIGNED_OUT_REASON_KEY);
  if (reason) localStorage.removeItem(SIGNED_OUT_REASON_KEY);
  return reason;
}

export function setSignOutReason(reason: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SIGNED_OUT_REASON_KEY, reason);
}

/**
 * Start watching. Returns a teardown function.
 *
 * `onIdle` runs once, when the window has passed — the caller clears tokens
 * and sends the person to the login screen.
 */
export function startIdleWatch(onIdle: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  markActive();
  let lastBeat = 0;
  let stopped = false;

  const onInteraction = () => {
    if (stopped) return;
    markActive();

    // Beat only when a person actually did something, and at most once a
    // minute — this is what distinguishes presence from polling.
    if (now() - lastBeat >= HEARTBEAT_INTERVAL_MS) {
      lastBeat = now();
      api.post("/v1/admin/auth/heartbeat").catch(() => {
        // A failed beat is not worth surfacing: either the session is already
        // gone (the next request will say so) or the network blipped.
      });
    }
  };

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, onInteraction, { passive: true });
  }

  // Coming back to the tab counts as being present.
  const onVisible = () => {
    if (document.visibilityState === "visible") onInteraction();
  };
  document.addEventListener("visibilitychange", onVisible);

  const timer = window.setInterval(() => {
    if (stopped) return;
    if (now() - lastActivityAt() > IDLE_TIMEOUT_MS) {
      stopped = true;
      setSignOutReason("idle");
      onIdle();
    }
  }, IDLE_CHECK_MS);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, onInteraction);
    }
  };
}
