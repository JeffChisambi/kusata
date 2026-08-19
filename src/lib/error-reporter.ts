import { api } from "@/lib/api";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";

/**
 * Global browser error reporter — ships unhandled errors and promise
 * rejections to the platform's System Errors console so admins see
 * dashboard problems before anyone reports them.
 *
 * Guarantees:
 *  - never throws, never loops (reporting failures are swallowed);
 *  - session-level dedupe: each distinct message is sent once per tab;
 *  - hard cap per session so a crash loop can't flood the API.
 */
const seen = new Set<string>();
let sent = 0;
const MAX_PER_SESSION = 20;

function report(message: string, stack?: string, location?: string) {
  try {
    if (!message || sent >= MAX_PER_SESSION) return;
    const key = message.slice(0, 200);
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;

    const user = getCurrentUser();
    if (!user) return; // unauthenticated: no token to report with

    void api
      .post("/v1/errors/report", {
        source: isSuperAdmin(user) ? "ADMIN_DASHBOARD" : "BROKER_DASHBOARD",
        severity: "HIGH",
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 8000),
        location: location ?? window.location.pathname,
        context: { userAgent: navigator.userAgent },
      })
      .catch(() => {});
  } catch {
    // Reporting must never become an error source itself.
  }
}

let installed = false;

export function installErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    report(
      event.message ?? String(event.error ?? "Unknown error"),
      event.error?.stack,
      `${window.location.pathname} (${event.filename ?? "?"}:${event.lineno ?? "?"})`,
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    report(
      reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection"),
      reason instanceof Error ? reason.stack : undefined,
    );
  });
}
