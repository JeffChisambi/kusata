/**
 * RoleShell — picks AdminShell or BrokerShell based on the logged-in user's role.
 * Shared pages (users, kyc, notifications) import this instead of AdminShell directly
 * so that brokers see their scoped sidebar and admins see the full one.
 */
import type { ReactNode } from "react";
import { AdminShell } from "./admin-shell";
import { BrokerShell } from "./broker-shell";
import { getCurrentUser } from "@/lib/auth";

export function RoleShell({
  activeLabel,
  eyebrow,
  title,
  children,
}: {
  activeLabel: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  const user = getCurrentUser();

  if (user?.role === "BROKER") {
    return (
      <BrokerShell activeLabel={activeLabel} title={title}>
        {children}
      </BrokerShell>
    );
  }

  return (
    <AdminShell activeLabel={activeLabel} eyebrow={eyebrow ?? ""} title={title}>
      {children}
    </AdminShell>
  );
}
