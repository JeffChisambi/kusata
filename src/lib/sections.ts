/**
 * The broker dashboard as a list of sections a staff member can be granted.
 *
 * Mirrors pine-backend/src/modules/brokers/staff/dashboard-sections.ts. The
 * backend is the authority - StaffSectionGuard refuses any admin request
 * outside a staff member's sections - and this file lets the dashboard hide
 * what it knows would be refused, so nobody lands on a screen that only 403s.
 */
import { redirect } from "@tanstack/react-router";
import { getCurrentUser, type AdminUser } from "./auth";

export const DASHBOARD_SECTIONS = [
  { key: "overview",      label: "Overview",             hint: "Figures, charts and the activity feed" },
  { key: "users",         label: "Users",                hint: "Investor accounts and their balances" },
  { key: "kyc",           label: "KYC",                  hint: "Review and decide identity applications" },
  { key: "withdrawals",   label: "Withdrawals",          hint: "Approve or reject withdrawal requests" },
  { key: "support",       label: "Support",              hint: "Reply to client tickets" },
  { key: "orders",        label: "Orders",               hint: "Execute and monitor client orders" },
  { key: "notifications", label: "Client Notifications", hint: "Delivery log and announcements" },
  { key: "settings",      label: "Settings",             hint: "Fees, risk limits and migration" },
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number]["key"];

/** Which section a dashboard route belongs to, by its first path segment. */
const ROUTE_SECTIONS: Record<string, DashboardSection> = {
  "": "overview",
  users: "users",
  kyc: "kyc",
  withdrawals: "withdrawals",
  support: "support",
  orders: "orders",
  notifications: "notifications",
  settings: "settings",
};

/** Routes any signed-in person may open, whatever their sections. */
const UNGATED = new Set(["login", "activate", "change-password"]);

export function sectionForPath(pathname: string): DashboardSection | null {
  const first = pathname.replace(/^\/+/, "").split("/")[0] ?? "";
  if (UNGATED.has(first)) return null;
  return ROUTE_SECTIONS[first] ?? null;
}

/** True for broker STAFF - people limited to a subset of sections. */
export function isStaff(user: AdminUser | null | undefined): boolean {
  return !!user?.isBrokerStaff;
}

export function canAccess(user: AdminUser | null | undefined, section: DashboardSection): boolean {
  if (!user) return false;
  if (!user.isBrokerStaff) return true;
  return (user.sections ?? []).includes(section);
}

/** The first section a staff member may open - where they land after sign-in. */
export function homePathFor(user: AdminUser | null | undefined): string {
  if (!user?.isBrokerStaff) return "/";
  const first = DASHBOARD_SECTIONS.find((s) => canAccess(user, s.key));
  if (!first || first.key === "overview") return "/";
  return `/${first.key}`;
}

/**
 * Route-level guard, called from the root beforeLoad. Redirects a staff member
 * away from a section they were not granted, and everyone still on a
 * temporary password to the change-password screen first.
 */
export function enforceAccess(pathname: string): void {
  if (typeof window === "undefined") return;
  const user = getCurrentUser();
  if (!user) return;

  const first = pathname.replace(/^\/+/, "").split("/")[0] ?? "";

  if (user.mustChangePassword && first !== "change-password") {
    throw redirect({ to: "/change-password" });
  }
  if (!user.mustChangePassword && first === "change-password") {
    throw redirect({ to: homePathFor(user) });
  }

  const section = sectionForPath(pathname);
  if (section && !canAccess(user, section)) {
    throw redirect({ to: homePathFor(user) });
  }
}
