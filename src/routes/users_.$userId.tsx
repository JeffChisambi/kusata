import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Mail, Phone, Calendar, Copy, ShieldCheck, Snowflake, Ban, LogOut,
  Trash2, RefreshCw, Wallet, Activity, Smartphone, CheckCircle2, XCircle,
  ArrowUpRight, ArrowDownRight, FileText, User as UserIcon, CreditCard, Building2,
  BadgeCheck, ExternalLink,
} from "lucide-react";
import { CashIcon } from "@/components/pine-icons";
import {
  Breadcrumb, Panel, RingStatCard, Kpi, SummaryRow, Field, DocRow, InitialsAvatar, LoadingBlock,
} from "@/components/detail-kit";
import {
  useUserWorkspace, useUpdateUserStatus, useRevokeUserSessions, useDeleteUser, useNotifyUser,
} from "@/hooks/useUsers";
import { useKycApplication, type KycDocument } from "@/hooks/useKyc";

export const Route = createFileRoute("/users_/$userId")({
  head: () => ({ meta: [{ title: "User details — Pine Broker Admin" }] }),
  component: UserDetailPage,
});

const MWK = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}B` :
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : Math.round(n).toString();

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

function fmtWhen(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const DOC_LABEL: Record<string, string> = {
  ID_FRONT: "ID (front)", NATIONAL_ID: "National ID", PASSPORT: "Passport", PASSPORT_FRONT: "Passport (front)",
  DRIVERS_LICENSE_FRONT: "Licence (front)", ID_BACK: "ID (back)", NATIONAL_ID_BACK: "National ID (back)",
  PASSPORT_BACK: "Passport (back)", DRIVERS_LICENSE_BACK: "Licence (back)",
  SELFIE: "Selfie", LIVENESS: "Liveness selfie",
  PROOF_OF_RESIDENCE: "Proof of residence", UTILITY_BILL: "Utility bill", BANK_STATEMENT: "Bank statement",
};

function UserDetailPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { data: ws, isLoading } = useUserWorkspace(userId);

  const latestKycId = ws?.kycApplications?.[0]?.id ?? null;
  const { data: kyc } = useKycApplication(latestKycId);

  const updateStatus = useUpdateUserStatus();
  const revokeSessions = useRevokeUserSessions();
  const deleteUser = useDeleteUser();
  const notifyUser = useNotifyUser();

  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);
  const [showMessage, setShowMessage] = useState(false);

  const showToast = (msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const name = ws ? `${ws.firstName} ${ws.lastName}`.trim() : "User";
  const frozen = ws?.wallet?.isFrozen ?? false;
  const active = ws?.isActive ?? true;

  // Server-computed financial summary — the single source of truth (same
  // formulas the mobile app is served). No client-side valuation math.
  const fin = ws?.financialSummary ?? null;
  const portfolioValue = fin?.portfolioValue ?? 0;
  const cash = fin?.cash.total ?? (ws?.wallet ? Number(ws.wallet.balance) : 0);
  const cashAvailable = fin?.cash.available ?? cash;
  const cashReserved = fin?.cash.reserved ?? 0;
  const pendingWithdrawals = fin?.cash.pendingWithdrawals ?? 0;
  const totalWorth = fin?.totalAssets ?? portfolioValue + cash;
  const holdingsCount = ws?.holdings?.length ?? 0;
  const trades = ws?._count?.orders ?? 0;
  const mfaEnabled = ws?.mfaConfig?.isEnabled ?? false;
  const devices = (ws?.devices ?? []).filter((d) => !d.isRevoked);
  const trustedDevices = devices.filter((d) => d.trustLevel === "TRUSTED").length;
  const banks = ws?.linkedBanks ?? [];
  const txns = ws?.wallet?.transactions ?? [];
  const reg = kyc?.application?.registration ?? null;
  const docs: KycDocument[] = kyc?.documents ?? [];
  const kycStatus = (ws?.kycStatus ?? "PENDING").toUpperCase();

  // KYC verification progress (of 6 canonical steps)
  const kycSteps = useMemo(() => {
    const hasDoc = (pred: (t: string) => boolean) => docs.some((d) => d.imageUrl && pred(d.type));
    return [
      { label: "Email verified", ok: reg?.emailVerified ?? false },
      { label: "Phone verified", ok: reg?.phoneVerified ?? false },
      { label: "ID document", ok: hasDoc((t) => /ID_FRONT|NATIONAL_ID|PASSPORT|LICENSE/.test(t)) },
      { label: "Selfie / liveness", ok: hasDoc((t) => /SELFIE|LIVENESS/.test(t)) },
      { label: "Proof of address", ok: hasDoc((t) => /RESIDENCE|UTILITY|STATEMENT|ADDRESS/.test(t)) },
      { label: "Identity approved", ok: kycStatus === "APPROVED" },
    ];
  }, [docs, reg, kycStatus]);
  const kycDone = kycSteps.filter((s) => s.ok).length;

  const investedPct = totalWorth > 0 ? Math.round((portfolioValue / totalWorth) * 100) : 0;

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { showToast(e?.message ?? "Error", "err"); } finally { setBusy(null); }
  };
  const handleFreeze = () => act("freeze", async () => {
    await updateStatus.mutateAsync({ userId, status: frozen ? "active" : "frozen" });
    showToast(frozen ? "Wallet unfrozen" : "Wallet frozen");
  });
  const handleSuspend = () => {
    if (!confirm(`Suspend ${name}? They will be unable to log in.`)) return;
    act("suspend", async () => { await updateStatus.mutateAsync({ userId, status: "deactivated" }); showToast("User suspended"); });
  };
  const handleRevoke = () => act("revoke", async () => {
    await revokeSessions.mutateAsync(userId); showToast("All sessions revoked");
  });
  const handleDelete = () => {
    if (!confirm(`PERMANENTLY DELETE ${name}?\n\nThis cannot be undone.`)) return;
    act("delete", async () => { await deleteUser.mutateAsync(userId); showToast("User deleted"); navigate({ to: "/users" }); });
  };

  // Keep the breadcrumb/header frame while the workspace loads so drilling in
  // from the list doesn't blank the page.
  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto pb-16">
        <div className="flex items-center justify-between gap-3">
          <Breadcrumb items={[{ label: "Dashboard", to: "/" }, { label: "Users", to: "/users" }, { label: "User" }]} />
          <button
            onClick={() => navigate({ to: "/users" })}
            className="h-8 px-3 rounded-[4px] border border-border text-xs text-muted-foreground hover:bg-muted/50 flex items-center gap-1.5 mb-5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[6px] bg-card border border-border p-4 animate-pulse">
              <div className="w-8 h-8 rounded-md bg-muted mb-3" />
              <div className="h-3 w-20 rounded bg-muted mb-2" />
              <div className="h-5 w-28 rounded bg-muted" />
            </div>
          ))}
        </div>
        <LoadingBlock />
      </div>
    );
  }

  const statusBadge = frozen
    ? { cls: "bg-amber/10 text-amber", label: "Frozen" }
    : active
      ? { cls: "bg-pine/10 text-pine", label: "Active" }
      : { cls: "bg-rose/10 text-rose", label: "Suspended" };

  return (
    <div className="max-w-[1400px] mx-auto pb-16">
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] rounded-[4px] px-3.5 py-2 text-xs font-medium border shadow-lg ${
          toast.tone === "ok" ? "bg-pine/10 text-pine border-pine/30" : "bg-rose/10 text-rose border-rose/30"
        }`}>{toast.msg}</div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Breadcrumb items={[{ label: "Dashboard", to: "/" }, { label: "Users", to: "/users" }, { label: name }]} />
        <button
          onClick={() => navigate({ to: "/users" })}
          className="h-8 px-3 rounded-[4px] border border-border text-xs text-muted-foreground hover:bg-muted/50 flex items-center gap-1.5 mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      </div>

      {/* ── Top KPI row (full width) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi icon={<Wallet className="w-4 h-4" />} label="Portfolio value" value={`MWK ${MWK(portfolioValue)}`} tone="pine" sub="holdings at latest market price" />
        <Kpi icon={<CashIcon className="w-4 h-4" />} label="Client cash" value={`MWK ${MWK(cash)}`} sub={`MWK ${MWK(cashAvailable)} available${cashReserved > 0 ? ` · ${MWK(cashReserved)} reserved` : ""}${pendingWithdrawals > 0 ? ` · ${MWK(pendingWithdrawals)} withdrawing` : ""}`} />
        <Kpi icon={<Activity className="w-4 h-4" />} label="Total assets" value={`MWK ${MWK(totalWorth)}`} sub="cash + portfolio value" />
        <Kpi icon={<ArrowUpRight className="w-4 h-4" />} label="Total trades" value={trades} sub={`${holdingsCount} open ${holdingsCount === 1 ? "position" : "positions"}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_320px] gap-5 items-start">
        {/* ── LEFT: profile + info + documents ── */}
        <div className="flex flex-col gap-5">
          <section className="rounded-[6px] bg-card border border-border p-5 text-center">
            <div className="flex justify-center mb-3"><InitialsAvatar name={name} size={92} /></div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-base font-semibold">{name}</h1>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusBadge.cls}`}>{statusBadge.label}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
              <span>Investor</span><span>·</span>
              <span className="font-mono">{userId.slice(0, 8)}…</span>
              <button onClick={() => { navigator.clipboard.writeText(userId); showToast("User ID copied"); }} className="hover:text-foreground"><Copy className="w-3 h-3" /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-px bg-border rounded-[4px] overflow-hidden text-left">
              <div className="bg-card p-2.5">
                <div className="text-[10px] text-muted-foreground">KYC</div>
                <div className="text-xs font-semibold mt-0.5 capitalize">{kycStatus.toLowerCase().replace(/_/g, " ")}</div>
              </div>
              <div className="bg-card p-2.5">
                <div className="text-[10px] text-muted-foreground">Joined</div>
                <div className="text-xs font-semibold mt-0.5">{fmtDate(ws?.createdAt)}</div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-left">
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{ws?.email || "—"}</span>
                {ws?.email && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(ws.email!); showToast("Email copied"); }}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    title="Copy email"
                    aria-label="Copy email"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{ws?.phone || "—"}</span>
                {ws?.phone && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(ws.phone); showToast("Phone copied"); }}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    title="Copy phone"
                    aria-label="Copy phone"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowMessage(true)}
              className="mt-4 w-full h-9 rounded-[4px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 flex items-center justify-center gap-1.5"
            >
              <Mail className="w-4 h-4" /> Message user
            </button>
          </section>

          {/* Account actions */}
          <Panel title="Account actions">
            <div className="grid grid-cols-2 gap-2">
              <ActionBtn icon={frozen ? ShieldCheck : Snowflake} label={frozen ? "Unfreeze" : "Freeze"} tone="amber" busy={busy === "freeze"} onClick={handleFreeze} />
              <ActionBtn icon={LogOut} label="Revoke sessions" tone="amber" busy={busy === "revoke"} onClick={handleRevoke} />
              <ActionBtn icon={Ban} label="Suspend" tone="rose" busy={busy === "suspend"} onClick={handleSuspend} />
              <ActionBtn icon={Trash2} label="Delete" tone="rose" busy={busy === "delete"} onClick={handleDelete} />
            </div>
          </Panel>

          {/* Account information */}
          <Panel title="Account information">
            <div className="space-y-3">
              <Field label="Gender" value={reg?.gender === "M" ? "Male" : reg?.gender === "F" ? "Female" : reg?.gender || "—"} />
              <Field label="Date of birth" value={fmtDate(reg?.dateOfBirth)} />
              <Field label="Account status" value={active ? "Active" : "Deactivated"} />
              <Field label="Wallet" value={frozen ? "Frozen" : "Active"} />
              <Field label="Two-factor auth" value={mfaEnabled ? "Enabled" : "Not enabled"} />
            </div>
          </Panel>

          {/* Essential documents */}
          <Panel title="Essential documents" subtitle={docs.length ? `${docs.length} uploaded` : undefined}>
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No documents uploaded.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((d) => (
                  <DocRow
                    key={d.id}
                    name={DOC_LABEL[d.type] ?? d.type.replace(/_/g, " ")}
                    meta={d.uploadedAt ? `Uploaded ${fmtDate(d.uploadedAt)}` : undefined}
                    thumbUrl={d.imageUrl}
                    downloadUrl={d.imageUrl}
                    onView={d.imageUrl ? () => window.open(d.imageUrl!, "_blank") : undefined}
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ── CENTRE: rings, holdings, activity ── */}
        <div className="flex flex-col gap-5 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <RingStatCard
              title="KYC verification" subtitle="Onboarding steps completed"
              value={kycDone} max={kycSteps.length}
              color={kycDone === kycSteps.length ? "var(--pine)" : "var(--amber)"}
              centerMain={<span className="text-2xl">{kycDone}</span>}
              centerSub={`of ${kycSteps.length}`}
              legend={[{ label: "Done", value: String(kycDone) }, { label: "Left", value: String(kycSteps.length - kycDone) }]}
            />
            <RingStatCard
              title="Portfolio allocation" subtitle="Market value invested vs client cash"
              value={investedPct} max={100} color="var(--sky)"
              centerMain={<span className="text-2xl">{investedPct}%</span>}
              centerSub="invested"
              legend={[{ label: "Invested", value: `MWK ${MWK(portfolioValue)}` }, { label: "Cash", value: `MWK ${MWK(cash)}` }]}
            />
          </div>

          {/* Holdings breakdown */}
          <Panel title="Holdings" subtitle={holdingsCount ? `${holdingsCount} ${holdingsCount === 1 ? "position" : "positions"}` : undefined}>
            {holdingsCount === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No open positions.</p>
            ) : (
              <div className="space-y-3">
                {(ws?.holdings ?? []).map((h, i) => {
                  const costBasis = Number(h.quantity) * Number(h.averageCost);
                  const totalCost = (ws?.holdings ?? []).reduce((s2, x) => s2 + Number(x.quantity) * Number(x.averageCost), 0);
                  const pct = totalCost > 0 ? (costBasis / totalCost) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium truncate">{h.stock.symbol} <span className="text-muted-foreground font-normal">· {h.stock.name}</span></span>
                        <span className="font-mono text-xs shrink-0 ml-3" title="Cost basis (quantity × average cost incl. fees)">MWK {MWK(costBasis)} <span className="text-muted-foreground font-sans">at cost</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-pine" style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums w-16 text-right">{Number(h.quantity)} sh · {pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Recent activity */}
          <Panel title="Recent activity" subtitle="Latest wallet transactions">
            {txns.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No recent activity.</p>
            ) : (
              <ol className="space-y-3.5">
                {txns.map((t) => {
                  const credit = /DEPOSIT|CREDIT|DIVIDEND|SELL/.test(t.type);
                  const Icon = credit ? ArrowUpRight : ArrowDownRight;
                  const tone = credit ? "bg-pine/10 text-pine" : "bg-amber/10 text-amber";
                  const label = t.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <li key={t.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight">{label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          MWK {MWK(Number(t.amount))}{t.description ? ` · ${t.description}` : ""} · {t.status.toLowerCase()}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground shrink-0">{fmtWhen(t.createdAt)}</div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        {/* ── RIGHT: summary ── */}
        <div className="flex flex-col gap-5">
          {/* "Wallet & portfolio" panel removed — it duplicated the stat
              cards at the top of the page (portfolio value, cash, holdings). */}
          {fin && (
            <Panel title="Fees paid" subtitle="Lifetime, from trade & deposit records">
              <SummaryRow label="Trading commissions" value={`MWK ${MWK(fin.lifetimeFees.commissionsPaid)}`} />
              <SummaryRow label="Statutory levies" value={`MWK ${MWK(fin.lifetimeFees.leviesPaid)}`} />
              <SummaryRow label="Deposit processing fees" value={`MWK ${MWK(fin.lifetimeFees.depositFeesPaid)}`} />
              <SummaryRow label="Total trading fees" value={<span className="font-semibold">MWK {MWK(fin.lifetimeFees.totalTradingFees)}</span>} />
            </Panel>
          )}
          <Panel title="Security">
            <SummaryRow label="Two-factor auth" value={<span className={mfaEnabled ? "text-pine" : "text-amber"}>{mfaEnabled ? "Enabled" : "Off"}</span>} />
            <SummaryRow label="Active devices" value={devices.length} />
            <SummaryRow label="Trusted devices" value={trustedDevices} />
            {devices[0] && (
              <div className="mt-2 pt-3 border-t border-border flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0"><Smartphone className="w-4 h-4 text-muted-foreground" /></div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{[devices[0].platform, devices[0].osVersion].filter(Boolean).join(" · ") || "Device"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">Last seen {fmtWhen(devices[0].lastSeenAt)}</div>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Linked banks" subtitle={banks.length ? `${banks.length} linked` : undefined}>
            {banks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No linked bank accounts.</p>
            ) : (
              <div className="space-y-2">
                {banks.map((b) => {
                  const isMobile = /airtel|mpamba|money|tnm/i.test(b.bankName);
                  const Icon = isMobile ? CreditCard : Building2;
                  return (
                    <div key={b.id} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-muted-foreground" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate flex items-center gap-1.5">{b.bankName}{b.isPrimary && <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">Primary</span>}</div>
                        {/* Full account number, not masked — the broker needs it
                            to open the investor's CSD trading account. */}
                        <div className="text-[11px] text-foreground font-mono select-all">{b.accountNumber ?? b.accountNumberMasked}</div>
                        {b.accountName && <div className="text-[10px] text-muted-foreground truncate">{b.accountName}</div>}
                      </div>
                      {b.isVerified
                        ? <BadgeCheck className="w-4 h-4 text-pine shrink-0" />
                        : <span className="text-[10px] text-amber shrink-0">Unverified</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {latestKycId && (
            <button
              onClick={() => navigate({ to: "/kyc/$applicationId", params: { applicationId: latestKycId } })}
              className="w-full h-10 rounded-[6px] border border-pine/40 text-pine text-sm font-medium hover:bg-pine/5 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" /> Open KYC review
            </button>
          )}
        </div>
      </div>

      {showMessage && (
        <MessageDialog
          userName={name}
          sending={notifyUser.isPending}
          onClose={() => setShowMessage(false)}
          onSend={async (title, message, channel) => {
            await notifyUser.mutateAsync({ userId, title, message, channel });
            showToast("Message sent"); setShowMessage(false);
          }}
        />
      )}
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, tone, onClick, busy,
}: { icon: React.ComponentType<{ className?: string }>; label: string; tone?: "amber" | "rose"; onClick?: () => void; busy?: boolean }) {
  const cls = tone === "rose" ? "hover:bg-rose/10 hover:text-rose hover:border-rose/30"
    : tone === "amber" ? "hover:bg-amber/10 hover:text-amber hover:border-amber/30" : "hover:bg-muted/40";
  return (
    <button onClick={onClick} disabled={busy}
      className={`flex items-center justify-center gap-1.5 py-2 rounded-[4px] border border-border text-xs text-muted-foreground transition-colors disabled:opacity-50 ${cls}`}>
      {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />} {label}
    </button>
  );
}

function MessageDialog({
  userName, onClose, onSend, sending,
}: {
  userName: string; onClose: () => void;
  onSend: (title: string, message: string, channel: string) => Promise<void>; sending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("IN_APP");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-[6px] bg-card border border-border p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-1">Message {userName}</h3>
        <p className="text-xs text-muted-foreground mb-4">Sends a direct notification to this user.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[["IN_APP", "In-app"], ["PUSH", "Push"]].map(([v, l]) => (
            <button key={v} onClick={() => setChannel(v)}
              className={`h-9 rounded-[4px] border text-xs font-medium ${channel === v ? "border-pine/50 bg-pine/5 text-pine" : "border-border text-muted-foreground hover:bg-muted/40"}`}>{l}</button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)"
          className="w-full h-9 px-3 rounded-[4px] border border-border bg-transparent text-sm focus:outline-none focus:border-pine/40 mb-2" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Message…"
          className="w-full px-3 py-2.5 rounded-[4px] border border-border bg-transparent text-sm resize-none focus:outline-none focus:border-pine/40" />
        {err && <p className="text-xs text-rose mt-2">{err}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="h-8 px-3 rounded-[4px] border border-border text-xs text-muted-foreground hover:bg-muted/40">Cancel</button>
          <button disabled={!message.trim() || sending}
            onClick={async () => { setErr(null); try { await onSend(title.trim(), message.trim(), channel); } catch (e: any) { setErr(e?.message ?? "Failed to send."); } }}
            className="h-8 px-4 rounded-[4px] bg-pine text-primary-foreground text-xs font-medium hover:bg-pine/90 disabled:opacity-50 flex items-center gap-1.5">
            {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Send
          </button>
        </div>
      </div>
    </div>
  );
}
