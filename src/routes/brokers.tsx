import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2, Plus, Loader2, X, Check, AlertTriangle, CreditCard, Users,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import { requireSuperAdmin } from "@/lib/auth";
import { useBrokersList, useCreateBroker, type BrokerSummary } from "@/hooks/useBrokers";
import { usePlatformCommission, useUpdatePlatformCommission, useBrokerEarnings, type BrokerEarningsRow } from "@/hooks/usePlatform";

const fmtMK = (n: number) =>
  n >= 1_000_000 ? `MK ${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `MK ${(n / 1_000).toFixed(1)}K` : `MK ${n.toLocaleString()}`;
const fmtExact = (n: number) => `MWK ${n.toLocaleString("en-MW", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

/**
 * Pine's platform commission — a percentage of every broker's own trading
 * commission, frozen per trade at execution. Brokers see what they owe on
 * their dashboard; Pine tracks each broker's receivable here.
 */
function PlatformCommissionCard() {
  const { data, isLoading } = usePlatformCommission();
  const update = useUpdatePlatformCommission();
  const { data: report } = useBrokerEarnings();
  const [rate, setRate] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (data) setRate(String(data.platformCommissionPct)); }, [data]);

  const save = async () => {
    setErr(null);
    const n = Number(rate);
    if (!Number.isFinite(n) || n < 0 || n > 100) { setErr("Rate must be between 0 and 100%."); return; }
    try { await update.mutateAsync(n); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    catch (e: any) { setErr(e?.message ?? "Failed to save"); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="rounded-[3px] bg-card border border-border p-4 xl:col-span-1">
        <div className="text-sm font-semibold">Platform Commission</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pine's share of each broker's trading commission. Applied per trade at execution and never changed retroactively.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number" min={0} max={100} step="any" value={rate}
              onChange={(e) => setRate(e.target.value)}
              disabled={isLoading}
              className="w-full h-9 px-3 pr-8 rounded-[3px] bg-background border border-border text-sm font-mono focus:outline-none focus:border-pine/50 focus:ring-1 focus:ring-pine/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <button
            onClick={save} disabled={update.isPending || isLoading}
            className="h-9 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        </div>
        {err && <div className="text-[12px] text-rose mt-2">{err}</div>}
        <div className="text-[11px] text-muted-foreground mt-2">
          Example: broker earns MK 1,000 on a trade at {rate || 0}% → Pine earns MK {((Number(rate) || 0) * 10).toLocaleString()}.
        </div>
      </div>
      {[
        { label: "Owed to Pine (this month)", value: report?.totals.owedThisMonth, sub: `from ${report ? new Date(report.periodStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}` },
        { label: "Broker commissions (this month)", value: report?.totals.commissionsThisMonth, sub: "what brokers earned across Pine" },
        { label: "Owed to Pine (lifetime)", value: report?.totals.owedLifetime, sub: "all-time platform receivable" },
      ].map((s) => (
        <div key={s.label} className="rounded-[3px] bg-card border border-border p-4 xl:col-span-1 first:xl:col-span-1">
          <div className="text-xs text-muted-foreground">{s.label}</div>
          <div className="text-xl font-bold leading-tight mt-0.5 font-mono cursor-help" title={s.value != null ? fmtExact(s.value) : undefined}>
            {s.value == null ? "—" : fmtMK(s.value)}
          </div>
          <div className="text-[11px] text-muted-foreground/60 mt-1">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/brokers")({
  head: () => ({ meta: [{ title: "Brokers — Pine Admin" }] }),
  beforeLoad: () => requireSuperAdmin(),
  component: BrokersPage,
});

const CODE_RE = /^[A-Z0-9_-]{2,20}$/;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function BrokersPage() {
  const { data: brokers, isLoading, isError } = useBrokersList();
  const { data: earnings } = useBrokerEarnings();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const list = brokers ?? [];
  const activeCount = list.filter((b) => b.isActive).length;
  const configuredCount = list.filter((b) => b.paymentConfigured).length;
  const totalUsers = list.reduce((sum, b) => sum + (b.userCount ?? 0), 0);

  return (
    <div className="pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[3px] bg-pine/10 text-pine flex items-center justify-center">
          <Building2 className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Brokers</h1>
          <p className="text-xs text-muted-foreground">
            Manage the brokerage firms on Pine — onboarding, administrators and integrations.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Create broker
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        {[
          { label: "Brokers", value: isLoading ? "—" : String(list.length), sub: `${activeCount} active` },
          { label: "Payments configured", value: isLoading ? "—" : `${configuredCount}/${list.length || 0}`, sub: "payment gateways set up" },
          { label: "Investors", value: isLoading ? "—" : totalUsers.toLocaleString(), sub: "across all brokers" },
        ].map((s) => (
          <div key={s.label} className="flex-1 rounded-[3px] bg-card border border-border p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-xl font-bold leading-tight mt-0.5">{s.value}</div>
            <div className="text-[11px] text-muted-foreground/60 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Platform commission + receivables */}
      <PlatformCommissionCard />

      {/* Table */}
      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-rose flex flex-col items-center gap-2">
            <AlertTriangle className="w-6 h-6" /> Failed to load brokers.
          </div>
        ) : list.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No brokers yet.</p>
            <button onClick={() => setCreating(true)} className="mt-3 text-sm text-pine font-medium">
              Onboard the first broker
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <th className="pl-5 py-2.5 text-left font-medium">Broker</th>
                  <th className="py-2.5 text-left font-medium">Code</th>
                  <th className="py-2.5 text-left font-medium">Status</th>
                  <th className="py-2.5 text-left font-medium">Users</th>
                  <th className="py-2.5 text-right font-medium" title="Broker's trading commissions this month">Earned (mo)</th>
                  <th className="py-2.5 text-right font-medium" title="Platform commission the broker owes Pine this month">Owes Pine (mo)</th>
                  <th className="py-2.5 text-right font-medium" title="All-time platform commission owed">Owes (lifetime)</th>
                  <th className="py-2.5 text-left font-medium">Payments</th>
                  <th className="pr-5 py-2.5 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <BrokerRow
                    key={b.id}
                    broker={b}
                    earnings={earnings?.brokers.find((e) => e.brokerId === b.id)}
                    onOpen={() => navigate({ to: "/brokers/$brokerId", params: { brokerId: b.id } })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && <CreateBrokerModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function BrokerRow({ broker: b, earnings, onOpen }: { broker: BrokerSummary; earnings?: BrokerEarningsRow; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer">
      <td className="pl-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[4px] bg-muted overflow-hidden shrink-0 flex items-center justify-center">
            {b.logoUrl ? (
              <img src={b.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold text-muted-foreground">
                {b.name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[13px] truncate max-w-[280px]">{b.name}</div>
            <div className="text-[11px] text-muted-foreground truncate max-w-[280px]">
              {b.contactEmail || b.description || "—"}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3">
        <code className="text-[11px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{b.code}</code>
      </td>
      <td className="py-3">
        {b.isActive ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-pine/10 text-pine">
            <span className="w-1.5 h-1.5 rounded-full bg-pine" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose/10 text-rose">
            <span className="w-1.5 h-1.5 rounded-full bg-rose" /> Inactive
          </span>
        )}
      </td>
      <td className="py-3 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-muted-foreground/60" /> {b.userCount.toLocaleString()}
        </span>
      </td>
      <td className="py-3 text-right font-mono text-[12px] cursor-help" title={earnings ? fmtExact(earnings.thisMonth.commissions) : undefined}>
        {earnings ? fmtMK(earnings.thisMonth.commissions) : "—"}
      </td>
      <td className="py-3 text-right font-mono text-[12px] font-semibold text-pine cursor-help" title={earnings ? fmtExact(earnings.thisMonth.owedToPlatform) : undefined}>
        {earnings ? fmtMK(earnings.thisMonth.owedToPlatform) : "—"}
      </td>
      <td className="py-3 text-right font-mono text-[12px] text-muted-foreground cursor-help" title={earnings ? fmtExact(earnings.lifetime.owedToPlatform) : undefined}>
        {earnings ? fmtMK(earnings.lifetime.owedToPlatform) : "—"}
      </td>
      <td className="py-3">
        {b.paymentConfigured ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-pine/10 text-pine">
            <CreditCard className="w-3 h-3" />
            Configured{b.paymentProvider ? ` · ${b.paymentProvider}` : ""}{b.paymentEnvironment ? ` (${b.paymentEnvironment})` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Not configured
          </span>
        )}
      </td>
      <td className="pr-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(b.createdAt)}</td>
    </tr>
  );
}

/* ── Create modal ── */
function CreateBrokerModal({ onClose }: { onClose: () => void }) {
  const create = useCreateBroker();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const codeValid = CODE_RE.test(code);
  const canSave = name.trim().length >= 2 && codeValid;

  const save = () => {
    if (!canSave) {
      setError("A name and a valid code (A–Z, 0–9, _ or -, 2–20 characters) are required.");
      return;
    }
    setError(null);
    create.mutate(
      {
        name: name.trim(),
        code: code.trim(),
        description: description.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          onClose();
          if (created?.id) {
            navigate({ to: "/brokers/$brokerId", params: { brokerId: created.id } });
          }
        },
        onError: (e: any) => setError(e?.message ?? "Failed to create the broker."),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-[4px] bg-background border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="font-semibold text-[15px]">Create broker</div>
          <button onClick={onClose} className="w-8 h-8 rounded-[3px] hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" placeholder="e.g. Stockbrokers Malawi" autoFocus />
            </FormField>
            <FormField label="Code">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className={`form-input font-mono uppercase ${code && !codeValid ? "!border-rose" : ""}`}
                placeholder="e.g. SBM"
                maxLength={20}
                spellCheck={false}
              />
              <div className={`text-[11px] mt-1 ${code && !codeValid ? "text-rose" : "text-muted-foreground"}`}>
                A–Z, 0–9, _ or -, 2–20 characters. Cannot be changed later.
              </div>
            </FormField>
          </div>

          <FormField label="Description (optional)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="form-input" placeholder="Short description shown internally" />
          </FormField>

          <FormField label="Logo URL (optional)">
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="form-input" placeholder="https://…" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Contact email (optional)">
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="form-input" placeholder="ops@broker.mw" />
            </FormField>
            <FormField label="Contact phone (optional)">
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="form-input" placeholder="+265…" />
            </FormField>
          </div>

          {error && <p className="text-xs text-rose">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border">
          <button onClick={onClose} className="h-9 px-4 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
          <button
            onClick={save}
            disabled={!canSave || create.isPending}
            className="h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-40 flex items-center gap-1.5"
          >
            {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Create broker
          </button>
        </div>
      </div>

      <style>{`.form-input{width:100%;height:38px;padding:0 12px;border:1px solid var(--border,#e5e7eb);border-radius:3px;background:transparent;font-size:14px}.form-input:focus{outline:none;border-color:rgba(22,73,81,.5)}`}</style>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
