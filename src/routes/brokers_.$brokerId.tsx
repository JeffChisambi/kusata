import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2, Loader2, X, Check, AlertTriangle, CreditCard, Users, KeyRound,
  ShieldCheck, ShieldOff, Copy, CheckCircle2, Mail, Phone, Plus, Send,
  RefreshCw, Power, Plug, ChevronLeft, ChevronRight, Pencil,
} from "lucide-react";
import { Card, useDashboardTitle } from "@/components/broker-shell";
import { Breadcrumb, Kpi, LoadingBlock, Panel } from "@/components/detail-kit";
import { requireSuperAdmin } from "@/lib/auth";
import {
  useBrokerDetail, useUpdateBroker, useUpdateBrokerStatus,
  useInviteBrokerAdmin, useReinviteBrokerAdmin,
  useBrokerPaymentConfig, useUpdateBrokerPaymentConfig, useTestBrokerPaymentConfig,
  useBrokerApiConfigs, useUpsertBrokerApiConfig,
  useBrokerUsers,
  type BrokerDetail, type BrokerAdmin, type BrokerApiConfig, type PaymentConfigInput,
  type BrokerGatewayTestResult,
} from "@/hooks/useBrokers";

export const Route = createFileRoute("/brokers_/$brokerId")({
  head: () => ({ meta: [{ title: "Broker — Pine Admin" }] }),
  beforeLoad: () => requireSuperAdmin(),
  component: BrokerDetailPage,
});

const API_KEY_RE = /^[A-Z0-9_]{2,40}$/;

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

type Tab = "general" | "admins" | "payment" | "api" | "investors";

/** One-time invitation token payload held ONLY in component state for the modal. */
type OneTimeToken = { token: string; expiresAt: string; email?: string; instructions?: string };

function BrokerDetailPage() {
  const { brokerId } = Route.useParams();
  const { data: broker, isLoading, isError } = useBrokerDetail(brokerId);
  useDashboardTitle(broker ? broker.name : "Brokers");

  const [tab, setTab] = useState<Tab>("general");
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);
  const flash = (msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2500);
  };

  // Keep the breadcrumb frame while the broker loads so drilling in from the
  // list doesn't blank the page.
  if (isLoading) {
    return (
      <div className="pt-6 space-y-5">
        <Breadcrumb items={[{ label: "Brokers", to: "/brokers" }, { label: "Broker" }]} />
        <Card>
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-64 rounded bg-muted" />
            </div>
          </div>
        </Card>
        <LoadingBlock />
      </div>
    );
  }
  if (isError || !broker) {
    return (
      <div className="pt-6">
        <Breadcrumb items={[{ label: "Brokers", to: "/brokers" }, { label: "Broker" }]} />
        <Card>
          <div className="py-16 text-center text-sm text-rose flex flex-col items-center gap-2">
            <AlertTriangle className="w-6 h-6" /> Failed to load this broker.
          </div>
        </Card>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "admins", label: `Administrators (${broker.admins.length})` },
    { key: "payment", label: "Payment" },
    { key: "api", label: `API Config (${broker.apiConfigs.length})` },
    { key: "investors", label: "Investors" },
  ];

  return (
    <div className="pt-6 space-y-5">
      <Breadcrumb items={[{ label: "Brokers", to: "/brokers" }, { label: broker.name }]} />

      <HeaderCard broker={broker} onFlash={flash} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi icon={<Users className="w-4 h-4" />} label="Investors" value={broker._count.users.toLocaleString()} tone="pine" />
        <Kpi icon={<Building2 className="w-4 h-4" />} label="Orders" value={broker._count.orders.toLocaleString()} />
        <Kpi icon={<CreditCard className="w-4 h-4" />} label="Transactions" value={broker._count.transactions.toLocaleString()} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative py-2.5 px-4 text-sm font-medium whitespace-nowrap ${
              tab === t.key ? "text-pine" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {tab === t.key && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-pine rounded-full" />}
          </button>
        ))}
      </div>

      {tab === "general" && <GeneralPanel broker={broker} onFlash={flash} />}
      {tab === "admins" && <AdminsPanel broker={broker} onFlash={flash} />}
      {tab === "payment" && <PaymentPanel brokerId={broker.id} onFlash={flash} />}
      {tab === "api" && <ApiPanel brokerId={broker.id} onFlash={flash} />}
      {tab === "investors" && <InvestorsPanel brokerId={broker.id} />}

      {toast && (
        <div className={`fixed top-4 right-4 z-[70] rounded-[4px] px-4 py-2.5 text-sm shadow-lg ${
          toast.tone === "ok" ? "bg-pine text-primary-foreground" : "bg-rose text-white"
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}

/* ── Header: identity + status toggle + integration chips ─────────────────── */

function HeaderCard({ broker, onFlash }: { broker: BrokerDetail; onFlash: (m: string, t?: "ok" | "err") => void }) {
  const statusMutation = useUpdateBrokerStatus();
  const [confirmStatus, setConfirmStatus] = useState(false);

  const initials = broker.name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  const activeAdmins = broker.admins.filter((a) => a.isActive).length;
  const enabledApis = broker.apiConfigs.filter((c) => c.isEnabled).length;
  const paymentReady = !!broker.paymentConfig;

  const toggleStatus = () => {
    statusMutation.mutate(
      { brokerId: broker.id, isActive: !broker.isActive },
      {
        onSuccess: () => {
          setConfirmStatus(false);
          onFlash(broker.isActive ? "Broker deactivated." : "Broker activated.");
        },
        onError: (e: any) => {
          setConfirmStatus(false);
          onFlash(e?.message ?? "Status change failed.", "err");
        },
      },
    );
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-14 h-14 rounded-[6px] bg-muted overflow-hidden shrink-0 flex items-center justify-center ring-1 ring-border">
          {broker.logoUrl ? (
            <img src={broker.logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-bold text-muted-foreground">{initials || "?"}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-semibold truncate">{broker.name}</h2>
            <code className="text-[11px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{broker.code}</code>
            {broker.isActive ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-pine/10 text-pine">
                <span className="w-1.5 h-1.5 rounded-full bg-pine" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose/10 text-rose">
                <span className="w-1.5 h-1.5 rounded-full bg-rose" /> Inactive
              </span>
            )}
          </div>
          {broker.description && <p className="text-xs text-muted-foreground mt-1 max-w-xl">{broker.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground flex-wrap">
            {broker.contactEmail && (
              <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {broker.contactEmail}</span>
            )}
            {broker.contactPhone && (
              <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {broker.contactPhone}</span>
            )}
            <span>Onboarded {fmtDate(broker.createdAt)}</span>
          </div>
        </div>
        <button
          onClick={() => setConfirmStatus(true)}
          className={`h-9 px-3.5 rounded-[3px] border text-sm font-medium flex items-center gap-1.5 ${
            broker.isActive
              ? "border-rose/30 text-rose hover:bg-rose/5"
              : "border-pine/30 text-pine hover:bg-pine/5"
          }`}
        >
          <Power className="w-4 h-4" /> {broker.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>

      {/* Integration status chips */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
        <StatusChip ok={paymentReady} icon={<CreditCard className="w-3 h-3" />}
          label={paymentReady
            ? `Payments · ${broker.paymentConfig?.provider ?? "configured"}${broker.paymentConfig?.environment ? ` (${broker.paymentConfig.environment})` : ""}${broker.paymentConfig?.isEnabled === false ? " · disabled" : ""}`
            : "Payments not configured"} />
        <StatusChip ok={enabledApis > 0} icon={<Plug className="w-3 h-3" />}
          label={`API integrations · ${enabledApis} enabled / ${broker.apiConfigs.length} total`} />
        <StatusChip ok={activeAdmins > 0} icon={<KeyRound className="w-3 h-3" />}
          label={`Administrators · ${activeAdmins} active / ${broker.admins.length} total`} />
        <StatusChip ok={broker.isActive} icon={<Building2 className="w-3 h-3" />}
          label={broker.isActive ? "Broker live" : "Broker offline"} />
      </div>

      {confirmStatus && (
        <Modal title={broker.isActive ? "Deactivate broker" : "Activate broker"} onClose={() => setConfirmStatus(false)}>
          <p className="text-xs text-muted-foreground mb-4">
            {broker.isActive ? (
              <>Deactivate <strong>{broker.name}</strong>? Their investors and administrators will lose access until the broker is re-activated.</>
            ) : (
              <>Activate <strong>{broker.name}</strong>? Their investors and administrators will regain access immediately.</>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmStatus(false)} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40">Cancel</button>
            <button
              onClick={toggleStatus}
              disabled={statusMutation.isPending}
              className={`h-8 px-4 rounded-[3px] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 ${
                broker.isActive ? "bg-rose text-white hover:bg-rose/90" : "bg-pine text-primary-foreground hover:bg-pine/90"
              }`}
            >
              {statusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
              {broker.isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function StatusChip({ ok, icon, label }: { ok: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
      ok ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"
    }`}>
      {icon} {label}
    </span>
  );
}

/* ── General information (editable) ───────────────────────────────────────── */

function GeneralPanel({ broker, onFlash }: { broker: BrokerDetail; onFlash: (m: string, t?: "ok" | "err") => void }) {
  const update = useUpdateBroker();
  const [name, setName] = useState(broker.name);
  const [description, setDescription] = useState(broker.description ?? "");
  const [logoUrl, setLogoUrl] = useState(broker.logoUrl ?? "");
  const [contactEmail, setContactEmail] = useState(broker.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(broker.contactPhone ?? "");

  const isDirty =
    name !== broker.name ||
    description !== (broker.description ?? "") ||
    logoUrl !== (broker.logoUrl ?? "") ||
    contactEmail !== (broker.contactEmail ?? "") ||
    contactPhone !== (broker.contactPhone ?? "");

  const save = () => {
    update.mutate(
      {
        brokerId: broker.id,
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        },
      },
      {
        onSuccess: () => onFlash("Broker details saved."),
        onError: (e: any) => onFlash(e?.message ?? "Save failed.", "err"),
      },
    );
  };

  return (
    <Panel
      title="General Information"
      subtitle="Identity and contact details shown across the platform."
      action={
        <button
          onClick={save}
          disabled={!isDirty || !name.trim() || update.isPending}
          className="h-8 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 disabled:opacity-40 flex items-center gap-1.5"
        >
          {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save changes
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        <FormField label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
        </FormField>
        <FormField label="Code">
          <input value={broker.code} disabled className="form-input font-mono opacity-60 cursor-not-allowed" />
          <div className="text-[11px] text-muted-foreground mt-1">The broker code is permanent.</div>
        </FormField>
        <FormField label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="form-input" placeholder="Short internal description" />
        </FormField>
        <FormField label="Logo URL">
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="form-input" placeholder="https://…" />
        </FormField>
        <FormField label="Contact email">
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="form-input" placeholder="ops@broker.mw" />
        </FormField>
        <FormField label="Contact phone">
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="form-input" placeholder="+265…" />
        </FormField>
      </div>
      <FormStyles />
    </Panel>
  );
}

/* ── Administrators ───────────────────────────────────────────────────────── */

function AdminsPanel({ broker, onFlash }: { broker: BrokerDetail; onFlash: (m: string, t?: "ok" | "err") => void }) {
  const reinvite = useReinviteBrokerAdmin();
  const [inviting, setInviting] = useState(false);
  // The invitation token lives ONLY here, for the lifetime of the modal.
  const [oneTimeToken, setOneTimeToken] = useState<OneTimeToken | null>(null);
  const [reinvitingId, setReinvitingId] = useState<string | null>(null);

  const handleReinvite = (admin: BrokerAdmin) => {
    setReinvitingId(admin.id);
    reinvite.mutate(
      { brokerId: broker.id, adminId: admin.id },
      {
        onSuccess: (res) => {
          setReinvitingId(null);
          setOneTimeToken({ token: res.invitationToken, expiresAt: res.expiresAt, email: admin.email });
        },
        onError: (e: any) => {
          setReinvitingId(null);
          onFlash(e?.message ?? "Re-invite failed.", "err");
        },
      },
    );
  };

  return (
    <Panel
      title="Broker Administrators"
      subtitle="Staff accounts that can sign in to this broker's portal."
      action={
        <button
          onClick={() => setInviting(true)}
          className="h-8 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Invite administrator
        </button>
      }
      bodyClassName="!p-0"
    >
      {broker.admins.length === 0 ? (
        <div className="py-14 text-center">
          <KeyRound className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground">No administrators yet.</p>
          <button onClick={() => setInviting(true)} className="mt-2 text-sm text-pine font-medium">
            Invite the first administrator
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                <th className="pl-5 py-2.5 text-left font-medium">Administrator</th>
                <th className="py-2.5 text-left font-medium">Status</th>
                <th className="py-2.5 text-left font-medium">MFA</th>
                <th className="py-2.5 text-left font-medium">Added</th>
                <th className="pr-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {broker.admins.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="pl-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 ring-1 ring-border">
                        <span className="text-[11px] font-bold text-muted-foreground">
                          {`${a.firstName[0] ?? ""}${a.lastName[0] ?? ""}`.toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-[13px] truncate">{a.firstName} {a.lastName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    {a.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-pine/10 text-pine">
                        <span className="w-1.5 h-1.5 rounded-full bg-pine" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber/10 text-amber">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber" /> Invited
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    {a.mfaEnabled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pine">
                        <ShieldCheck className="w-3.5 h-3.5" /> Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <ShieldOff className="w-3.5 h-3.5" /> Not set up
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                  <td className="pr-5 py-3 text-right">
                    {!a.isActive && (
                      <button
                        onClick={() => handleReinvite(a)}
                        disabled={reinvite.isPending}
                        className="h-7 px-2.5 rounded-[3px] border border-border text-[11px] font-medium text-muted-foreground hover:bg-muted/40 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {reinvite.isPending && reinvitingId === a.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <RefreshCw className="w-3 h-3" />}
                        Re-invite
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviting && (
        <InviteAdminModal
          brokerId={broker.id}
          onClose={() => setInviting(false)}
          onInvited={(inv) => { setInviting(false); setOneTimeToken(inv); }}
        />
      )}

      {oneTimeToken && (
        <TokenModal invitation={oneTimeToken} onClose={() => setOneTimeToken(null)} />
      )}
    </Panel>
  );
}

function InviteAdminModal({ brokerId, onClose, onInvited }: {
  brokerId: string;
  onClose: () => void;
  onInvited: (inv: OneTimeToken) => void;
}) {
  const invite = useInviteBrokerAdmin();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave = email.trim().includes("@") && firstName.trim() && lastName.trim();

  const save = () => {
    if (!canSave) { setError("Email, first name and last name are required."); return; }
    setError(null);
    invite.mutate(
      {
        brokerId,
        input: {
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        },
      },
      {
        onSuccess: (res) => onInvited({
          token: res.invitationToken,
          expiresAt: res.expiresAt,
          email: res.email,
          instructions: res.instructions,
        }),
        onError: (e: any) => setError(e?.message ?? "Invitation failed."),
      },
    );
  };

  return (
    <Modal title="Invite administrator" onClose={onClose}>
      <div className="space-y-3.5">
        <FormField label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="admin@broker.mw" autoFocus />
        </FormField>
        <div className="grid grid-cols-2 gap-3.5">
          <FormField label="First name">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="form-input" />
          </FormField>
          <FormField label="Last name">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="form-input" />
          </FormField>
        </div>
        <FormField label="Phone (optional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" placeholder="+265…" />
        </FormField>
        {error && <p className="text-xs text-rose">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40">Cancel</button>
          <button
            onClick={save}
            disabled={!canSave || invite.isPending}
            className="h-8 px-4 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 disabled:opacity-40 flex items-center gap-1.5"
          >
            {invite.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send invitation
          </button>
        </div>
      </div>
      <FormStyles />
    </Modal>
  );
}

/** One-time invitation token display. The token is never persisted anywhere —
 *  closing this modal discards it permanently. */
function TokenModal({ invitation, onClose }: { invitation: OneTimeToken; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(invitation.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title="Invitation created" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-[3px] border border-amber/30 bg-amber/8 px-3.5 py-2.5 text-xs text-amber flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>
            This invitation token is shown <strong>only once</strong> and cannot be retrieved again.
            Copy it now and share it securely with the administrator.
          </span>
        </div>

        {invitation.email && (
          <p className="text-xs text-muted-foreground">
            Invitation for <strong className="text-foreground">{invitation.email}</strong> — expires {fmtDateTime(invitation.expiresAt)}.
          </p>
        )}

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Invitation token</div>
          <code className="block text-xs font-mono bg-muted/40 border border-border rounded-[3px] p-3 break-all select-all">
            {invitation.token}
          </code>
        </div>

        <button
          onClick={copy}
          className="w-full h-9 rounded-[3px] border border-border text-sm font-medium hover:bg-muted/40 flex items-center justify-center gap-2"
        >
          {copied
            ? <><CheckCircle2 className="w-4 h-4 text-pine" /> Copied to clipboard</>
            : <><Copy className="w-4 h-4" /> Copy token</>}
        </button>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {invitation.instructions ??
            "The administrator activates their account at the /activate page using this token, sets a password, then signs in and completes MFA setup."}
        </p>

        <div className="flex justify-end">
          <button onClick={onClose} className="h-8 px-4 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90">
            Done — I've copied the token
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Payment configuration (Mastercard Gateway / MPGS) ───────────────────── */

/**
 * Each broker settles through their OWN MPGS merchant account with their own
 * acquiring bank. These helpers keep the UI honest about which host belongs to
 * which environment, mirroring the backend guard exactly.
 */
const gatewayHost = (url: string) => {
  const raw = url.trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
};
const looksLikeTestHost = (url: string) => {
  const host = gatewayHost(url);
  return host.includes("test") || host.includes("mtf");
};

type OnboardingStage = "not-started" | "credentials" | "live";

function PaymentPanel({ brokerId, onFlash }: { brokerId: string; onFlash: (m: string, t?: "ok" | "err") => void }) {
  const { data: config, isLoading, isError } = useBrokerPaymentConfig(brokerId);
  const update = useUpdateBrokerPaymentConfig();
  const test = useTestBrokerPaymentConfig();

  const [provider, setProvider] = useState("MPGS");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiVersion, setApiVersion] = useState("");
  const [environment, setEnvironment] = useState<"test" | "production">("test");
  const [merchantId, setMerchantId] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [settlementBankName, setSettlementBankName] = useState("");
  const [settlementAccountName, setSettlementAccountName] = useState("");
  const [settlementAccountNumber, setSettlementAccountNumber] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [testResult, setTestResult] = useState<BrokerGatewayTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (config && !seeded) {
      setProvider(config.provider ?? "MPGS");
      setBaseUrl(config.baseUrl ?? "");
      setApiVersion(config.apiVersion ?? "");
      setEnvironment(config.environment ?? "test");
      setMerchantId(config.merchantId ?? "");
      setSettlementBankName(config.settlementBankName ?? "");
      setSettlementAccountName(config.settlementAccountName ?? "");
      setIsEnabled(config.isEnabled ?? false);
      setSeeded(true);
    }
  }, [config, seeded]);

  // Environment guard — mirrors the backend rule so the operator gets
  // feedback before the request is ever sent.
  const envMismatch: string | null = (() => {
    const url = baseUrl.trim();
    if (!url) return null;
    const host = gatewayHost(url);
    if (environment === "production" && looksLikeTestHost(url)) {
      return `Environment is Production but ${host} is a test/MTF gateway host. Real deposits must point at the acquirer's production host.`;
    }
    if (environment === "test" && !looksLikeTestHost(url)) {
      return `Environment is Test but ${host} is not a test/MTF host. Use the acquirer's test host, or switch the environment to Production.`;
    }
    return null;
  })();

  // Onboarding progress, derived from what is actually stored.
  const storedMerchant = !!config?.merchantId;
  const storedPassword = !!config?.apiPasswordSet;
  const storedBaseUrl = !!config?.baseUrl;
  const stage: OnboardingStage = config?.isEnabled
    ? "live"
    : storedMerchant && storedPassword && storedBaseUrl
      ? "credentials"
      : "not-started";
  const missing = [
    !storedBaseUrl ? "base URL" : null,
    !storedMerchant ? "merchant ID" : null,
    !storedPassword ? "API password" : null,
    !config?.isEnabled ? "payments not switched on" : null,
  ].filter(Boolean) as string[];

  const canTest = storedMerchant && storedPassword && storedBaseUrl && !test.isPending;

  const save = () => {
    if (envMismatch) {
      onFlash("Fix the environment / base URL mismatch before saving.", "err");
      return;
    }
    const input: PaymentConfigInput = {
      // Provider is fixed: every broker integrates through MPGS.
      provider: provider.trim() || "MPGS",
      baseUrl: baseUrl.trim() || undefined,
      apiVersion: apiVersion.trim() || undefined,
      environment,
      merchantId: merchantId.trim() || undefined,
      settlementBankName: settlementBankName.trim() || undefined,
      settlementAccountName: settlementAccountName.trim() || undefined,
      isEnabled,
    };
    // Write-only secrets — only sent when the operator typed a new value, so a
    // blank field can never clear a stored secret.
    if (apiPassword) input.apiPassword = apiPassword;
    if (settlementAccountNumber) input.settlementAccountNumber = settlementAccountNumber;

    update.mutate(
      { brokerId, input },
      {
        onSuccess: () => {
          setApiPassword("");
          setSettlementAccountNumber("");
          setTestResult(null);
          setTestError(null);
          onFlash("Gateway configuration saved.");
        },
        onError: (e: any) => onFlash(e?.message ?? "Save failed.", "err"),
      },
    );
  };

  const runTest = () => {
    setTestResult(null);
    setTestError(null);
    test.mutate(brokerId, {
      onSuccess: (r) => setTestResult(r),
      onError: (e: any) => setTestError(e?.message ?? "The connection test could not be run."),
    });
  };

  if (isLoading) return <Panel title="Mastercard Gateway (MPGS)"><LoadingBlock /></Panel>;
  if (isError) {
    return (
      <Panel title="Mastercard Gateway (MPGS)">
        <div className="py-10 text-center text-sm text-rose">Failed to load the gateway configuration.</div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Mastercard Gateway (MPGS)"
      subtitle="Deposits are charged to this broker's own MPGS merchant account and settle to their bank — Pine never holds the funds."
      action={
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={runTest}
            disabled={!canTest}
            title={canTest ? "Runs against the saved credentials — charges nothing" : "Save a base URL, merchant ID and API password first"}
            className="h-8 px-3 rounded-[3px] border border-border text-xs font-medium hover:bg-muted/40 disabled:opacity-40 flex items-center gap-1.5"
          >
            {test.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />} Test connection
          </button>
          <button
            onClick={save}
            disabled={update.isPending || !!envMismatch}
            className="h-8 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 disabled:opacity-40 flex items-center gap-1.5"
          >
            {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save configuration
          </button>
        </div>
      }
    >
      {/* Onboarding status */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
          stage === "live" ? "bg-pine/10 text-pine"
            : stage === "credentials" ? "bg-amber/10 text-amber"
              : "bg-muted text-muted-foreground"
        }`}>
          {stage === "live" ? <ShieldCheck className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
          {stage === "live" ? "Live" : stage === "credentials" ? "Credentials saved" : "Not started"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {stage === "live"
            ? `Taking deposits in ${config?.environment ?? "test"} · last updated ${fmtDateTime(config?.updatedAt)}`
            : missing.length
              ? `Still needed: ${missing.join(", ")}.`
              : "Ready to switch on."}
        </span>
      </div>

      {envMismatch && (
        <div className="rounded-[3px] border border-rose/30 bg-rose/8 px-3.5 py-2.5 text-xs text-rose flex items-start gap-2 mb-5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span><strong>Environment mismatch.</strong> {envMismatch} Saving is blocked until this is corrected.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        <FormField label="Provider" hint="Fixed — every Pine broker integrates through MPGS.">
          <div className="form-input flex items-center text-muted-foreground bg-muted/30">
            MPGS · Mastercard Payment Gateway Services
          </div>
        </FormField>
        <FormField label="Environment" hint="Test uses the acquirer's MTF sandbox; production moves real money.">
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as "test" | "production")}
            className="form-input"
          >
            <option value="test">Test</option>
            <option value="production">Production</option>
          </select>
        </FormField>
        <FormField
          label="Base URL"
          hint="The acquiring bank's gateway host. Test: https://test-nbm.mtf.gateway.mastercard.com · Production: https://nbm.gateway.mastercard.com"
        >
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="form-input"
            placeholder="https://test-nbm.mtf.gateway.mastercard.com"
          />
        </FormField>
        <FormField label="API version" hint="Numeric MPGS REST version issued with the merchant account, e.g. 100.">
          <input value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} className="form-input" placeholder="100" />
        </FormField>
        <FormField label="Merchant ID" hint="Issued by the acquiring bank for this broker's merchant account.">
          <input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className="form-input" />
        </FormField>
        <FormField
          label="API password"
          hint="Write-only: encrypted at rest and never returned. Leaving it blank keeps the stored password."
        >
          <input
            type="password"
            autoComplete="new-password"
            value={apiPassword}
            onChange={(e) => setApiPassword(e.target.value)}
            className="form-input"
            placeholder={config?.apiPasswordSet ? "•••••• (set)" : "enter the gateway API password"}
          />
        </FormField>
        <FormField label="Settlement bank" hint="The broker's own bank — where captured deposits land.">
          <input value={settlementBankName} onChange={(e) => setSettlementBankName(e.target.value)} className="form-input" placeholder="e.g. National Bank of Malawi" />
        </FormField>
        <FormField label="Settlement account name">
          <input value={settlementAccountName} onChange={(e) => setSettlementAccountName(e.target.value)} className="form-input" />
        </FormField>
        <FormField
          label="Settlement account number"
          hint={config?.settlementAccountMasked ? `Stored: ${config.settlementAccountMasked} — leave blank to keep it.` : "Write-only: encrypted at rest."}
        >
          <input
            type="password"
            autoComplete="off"
            value={settlementAccountNumber}
            onChange={(e) => setSettlementAccountNumber(e.target.value)}
            className="form-input"
            placeholder={config?.settlementAccountMasked ? "•••••• (set)" : "enter the settlement account number"}
          />
        </FormField>
        <div className="flex items-end pb-1">
          <ToggleRow
            checked={isEnabled}
            onChange={setIsEnabled}
            label="Payments enabled"
            hint="Turns this broker's merchant account on for their investors"
          />
        </div>
      </div>

      {/* Connection test results */}
      {(testResult || testError) && (
        <div className="mt-5 max-w-3xl rounded-[3px] border border-border bg-muted/20 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Connection test
          </div>

          {testError && (
            <div className="text-xs text-rose flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span>{testError}</span>
            </div>
          )}

          {testResult && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <TestRow
                  ok={testResult.reachable}
                  label="Gateway reachable"
                  detail={testResult.reachable ? testResult.baseUrl : `No response from ${testResult.baseUrl}`}
                />
                <TestRow
                  ok={testResult.authenticated}
                  label="Credentials valid"
                  detail={testResult.authenticated ? "Payment session created — merchant ID and API password accepted" : "Gateway did not accept these credentials"}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                <span>Latency <strong className="text-foreground">{testResult.latencyMs} ms</strong></span>
                <span>Environment <strong className="text-foreground">{testResult.environment}</strong></span>
                <span>Merchant <strong className="text-foreground font-mono">{testResult.merchantId}</strong></span>
              </div>
              <p className={`mt-2.5 text-xs ${testResult.authenticated ? "text-muted-foreground" : "text-rose"}`}>
                {testResult.message}
              </p>
            </>
          )}
        </div>
      )}

      <FormStyles />
    </Panel>
  );
}

function TestRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok
        ? <CheckCircle2 className="w-4 h-4 text-pine shrink-0 mt-px" />
        : <AlertTriangle className="w-4 h-4 text-rose shrink-0 mt-px" />}
      <div className="min-w-0">
        <div className={`text-xs font-medium ${ok ? "text-foreground" : "text-rose"}`}>{label}</div>
        <div className="text-[11px] text-muted-foreground break-all">{detail}</div>
      </div>
    </div>
  );
}


/* ── API configuration ────────────────────────────────────────────────────── */

function ApiPanel({ brokerId, onFlash }: { brokerId: string; onFlash: (m: string, t?: "ok" | "err") => void }) {
  const { data: configs, isLoading, isError } = useBrokerApiConfigs(brokerId);
  const [editing, setEditing] = useState<BrokerApiConfig | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Panel
      title="API Configuration"
      subtitle="External integrations (MSE, CSD, market data…) keyed per broker."
      action={
        <button
          onClick={() => setCreating(true)}
          className="h-8 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add configuration
        </button>
      }
      bodyClassName="!p-0"
    >
      {isLoading ? (
        <LoadingBlock />
      ) : isError ? (
        <div className="py-10 text-center text-sm text-rose">Failed to load API configurations.</div>
      ) : (configs ?? []).length === 0 ? (
        <div className="py-14 text-center">
          <Plug className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground">No API configurations yet.</p>
          <button onClick={() => setCreating(true)} className="mt-2 text-sm text-pine font-medium">
            Add the first integration
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                <th className="pl-5 py-2.5 text-left font-medium">Key</th>
                <th className="py-2.5 text-left font-medium">Base URL</th>
                <th className="py-2.5 text-left font-medium">Secret</th>
                <th className="py-2.5 text-left font-medium">Status</th>
                <th className="py-2.5 text-left font-medium">Updated</th>
                <th className="pr-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {(configs ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="pl-5 py-3">
                    <div className="min-w-0">
                      <code className="text-[11px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-foreground">{c.key}</code>
                      {c.label && <div className="text-[11px] text-muted-foreground mt-1 truncate max-w-[220px]">{c.label}</div>}
                    </div>
                  </td>
                  <td className="py-3 text-[12px] text-muted-foreground truncate max-w-[240px]">{c.baseUrl || "—"}</td>
                  <td className="py-3">
                    {c.secretSet ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pine">
                        <ShieldCheck className="w-3.5 h-3.5" /> Set
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Not set</span>
                    )}
                  </td>
                  <td className="py-3">
                    {c.isEnabled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-pine/10 text-pine">
                        <span className="w-1.5 h-1.5 rounded-full bg-pine" /> Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Disabled
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(c.updatedAt)}</td>
                  <td className="pr-5 py-3 text-right">
                    <button
                      title="Edit"
                      onClick={() => setEditing(c)}
                      className="w-7 h-7 rounded-[3px] inline-flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <ApiConfigModal
          brokerId={brokerId}
          config={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onFlash={onFlash}
        />
      )}
    </Panel>
  );
}

function ApiConfigModal({ brokerId, config, onClose, onFlash }: {
  brokerId: string;
  config: BrokerApiConfig | null;
  onClose: () => void;
  onFlash: (m: string, t?: "ok" | "err") => void;
}) {
  const upsert = useUpsertBrokerApiConfig();
  const isEdit = !!config;

  const [key, setKey] = useState(config?.key ?? "");
  const [label, setLabel] = useState(config?.label ?? "");
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "");
  const [secret, setSecret] = useState("");
  const [metadataText, setMetadataText] = useState(
    config?.metadata ? JSON.stringify(config.metadata, null, 2) : "",
  );
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? true);
  const [error, setError] = useState<string | null>(null);

  const keyValid = API_KEY_RE.test(key);

  const save = () => {
    if (!keyValid) { setError("Key must be A–Z, 0–9 or _, 2–40 characters."); return; }
    let metadata: Record<string, unknown> | undefined;
    if (metadataText.trim()) {
      try {
        metadata = JSON.parse(metadataText);
      } catch {
        setError("Metadata must be valid JSON.");
        return;
      }
    }
    setError(null);
    upsert.mutate(
      {
        brokerId,
        input: {
          key: key.trim(),
          label: label.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          // Write-only secret — only sent when a new value was typed.
          ...(secret ? { secret } : {}),
          ...(metadata !== undefined ? { metadata } : {}),
          isEnabled,
        },
      },
      {
        onSuccess: () => { onClose(); onFlash("API configuration saved."); },
        onError: (e: any) => setError(e?.message ?? "Save failed."),
      },
    );
  };

  return (
    <Modal title={isEdit ? `Edit ${config!.key}` : "Add API configuration"} onClose={onClose}>
      <div className="space-y-3.5">
        <FormField label="Key">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            disabled={isEdit}
            className={`form-input font-mono uppercase ${key && !keyValid ? "!border-rose" : ""} ${isEdit ? "opacity-60 cursor-not-allowed" : ""}`}
            placeholder="e.g. MSE_TRADING"
            maxLength={40}
            spellCheck={false}
          />
          {!isEdit && (
            <div className={`text-[11px] mt-1 ${key && !keyValid ? "text-rose" : "text-muted-foreground"}`}>
              A–Z, 0–9 or _, 2–40 characters. Identifies the integration.
            </div>
          )}
        </FormField>
        <FormField label="Label (optional)">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="form-input" placeholder="Human-readable name" />
        </FormField>
        <FormField label="Base URL (optional)">
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="form-input" placeholder="https://…" />
        </FormField>
        <FormField label={config?.secretSet ? "Secret · set ✓" : "Secret (optional)"}>
          <input
            type="password"
            autoComplete="new-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="form-input"
            placeholder={config?.secretSet ? "leave blank to keep current" : "API key / secret"}
          />
        </FormField>
        <FormField label="Metadata (JSON, optional)">
          <textarea
            value={metadataText}
            onChange={(e) => setMetadataText(e.target.value)}
            rows={4}
            spellCheck={false}
            className="form-input !h-auto py-2 font-mono text-xs resize-y"
            placeholder='{ "timeoutMs": 5000 }'
          />
        </FormField>
        <ToggleRow checked={isEnabled} onChange={setIsEnabled} label="Enabled" hint="Integration is live for this broker" />
        {error && <p className="text-xs text-rose">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted/40">Cancel</button>
          <button
            onClick={save}
            disabled={!keyValid || upsert.isPending}
            className="h-8 px-4 rounded-[3px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 disabled:opacity-40 flex items-center gap-1.5"
          >
            {upsert.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save configuration
          </button>
        </div>
      </div>
      <FormStyles />
    </Modal>
  );
}

/* ── Investors ────────────────────────────────────────────────────────────── */

function InvestorsPanel({ brokerId }: { brokerId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data, isLoading, isError } = useBrokerUsers(brokerId, { page, limit });

  const kycBadge = (status: string) => {
    const s = status?.toUpperCase?.() ?? "";
    if (s === "APPROVED") return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-pine/10 text-pine">Verified</span>;
    if (s === "PENDING") return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber/10 text-amber">Pending</span>;
    if (s === "REJECTED") return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose/10 text-rose">Rejected</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Not submitted</span>;
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <Panel
      title="Investors"
      subtitle={data ? `${data.total.toLocaleString()} investors registered with this broker · click a row to open the investor.` : "Investors registered with this broker."}
      bodyClassName="!p-0"
    >
      {isLoading ? (
        <LoadingBlock />
      ) : isError ? (
        <div className="py-10 text-center text-sm text-rose">Failed to load investors.</div>
      ) : (data?.users ?? []).length === 0 ? (
        <div className="py-14 text-center">
          <Users className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground">No investors yet.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <th className="pl-5 py-2.5 text-left font-medium">Investor</th>
                  <th className="py-2.5 text-left font-medium">Phone</th>
                  <th className="py-2.5 text-left font-medium">KYC</th>
                  <th className="py-2.5 text-left font-medium">Status</th>
                  <th className="py-2.5 text-left font-medium">Selected broker</th>
                  <th className="pr-5 py-2.5 text-left font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate({ to: "/users/$userId", params: { userId: u.id } })}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="pl-5 py-3">
                      <div className="min-w-0">
                        <div className="font-medium text-[13px] truncate hover:text-pine transition-colors">{u.firstName} {u.lastName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{u.email || "—"}</div>
                      </div>
                    </td>
                    <td className="py-3 text-[12px] text-muted-foreground whitespace-nowrap">{u.phone || "—"}</td>
                    <td className="py-3">{kycBadge(u.kycStatus)}</td>
                    <td className="py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pine">
                          <span className="w-1.5 h-1.5 rounded-full bg-pine" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(u.brokerSelectedAt)}</td>
                    <td className="pr-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-[11px] text-muted-foreground">
              Page {data?.page ?? page} of {totalPages} · {data?.total.toLocaleString() ?? 0} investors
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 px-2 rounded-[3px] border border-border text-[11px] text-muted-foreground hover:bg-muted/40 disabled:opacity-40 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-7 px-2 rounded-[3px] border border-border text-[11px] text-muted-foreground hover:bg-muted/40 disabled:opacity-40 inline-flex items-center gap-1"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ── Small local pieces (news.tsx / mobile-themes.tsx patterns) ───────────── */

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground break-words">{hint}</p>}
    </div>
  );
}

function ToggleRow({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint: string;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-left">
      <div className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${checked ? "bg-pine" : "bg-muted"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </div>
      <div>
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      </div>
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md rounded-[4px] bg-card border border-border p-5 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-[3px] hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormStyles() {
  return (
    <style>{`.form-input{width:100%;height:38px;padding:0 12px;border:1px solid var(--border,#e5e7eb);border-radius:3px;background:transparent;font-size:14px;color:var(--foreground)}.form-input:focus{outline:none;border-color:rgba(22,73,81,.5)}select.form-input{appearance:auto}textarea.form-input{height:auto}`}</style>
  );
}
