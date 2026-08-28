import { useEffect, useMemo, useState } from "react";
import {
  Loader2, CheckCircle2, AlertTriangle, Plus, Trash2, Save, Info, PieChart,
} from "lucide-react";
import { useRiskConfig, useUpdateRiskConfig, type DepositRule } from "@/hooks/useRisk";

/**
 * Settings → Risk & Limits.
 *
 * The broker's OWN risk constraints — enforced SERVER-SIDE on every order
 * and deposit of this broker's investors (the mobile app only displays
 * them; it never defines or bypasses them):
 *
 *   - Portfolio concentration: max % per stock (post-order), buys only.
 *   - Deposit limits: per-transaction / daily / monthly / velocity, by
 *     payment method and KYC status. Where several bounds apply, the
 *     MOST RESTRICTIVE wins. All changes are audited.
 */

function SectionCard({
  title, description, children,
}: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[3px] bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="font-semibold text-sm">{title}</div>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5" aria-pressed={checked}>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-pine" : "bg-muted-foreground/30"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
      <span className="text-sm text-foreground">{label}</span>
    </button>
  );
}

function NumInput({
  value, onChange, placeholder, suffix, className = "",
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; suffix?: string; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="number" min={0} step="any" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 pr-9 rounded-[3px] bg-background border border-border text-sm font-mono focus:outline-none focus:border-pine/50 focus:ring-1 focus:ring-pine/20 transition-colors"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{suffix}</span>
      )}
    </div>
  );
}

function Select({
  value, onChange, options, className = "",
}: {
  value: string; onChange: (v: string) => void;
  options: [string, string][]; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 px-2 rounded-[3px] bg-background border border-border text-sm focus:outline-none focus:border-pine/50 ${className}`}
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/** Editable rule row — strings so blank fields are representable. */
type RuleDraft = {
  id: string; label: string; enabled: boolean;
  method: string; kycStatus: string;
  perTransactionMax: string; dailyMax: string; monthlyMax: string;
  velocityMaxCount: string; velocityWindowMinutes: string;
};

const toDraft = (r: DepositRule): RuleDraft => ({
  id: r.id,
  label: r.label ?? "",
  enabled: r.enabled,
  method: r.method ?? "ANY",
  kycStatus: r.kycStatus ?? "ANY",
  perTransactionMax: r.perTransactionMax == null ? "" : String(r.perTransactionMax),
  dailyMax: r.dailyMax == null ? "" : String(r.dailyMax),
  monthlyMax: r.monthlyMax == null ? "" : String(r.monthlyMax),
  velocityMaxCount: r.velocityMaxCount == null ? "" : String(r.velocityMaxCount),
  velocityWindowMinutes: r.velocityWindowMinutes == null ? "" : String(r.velocityWindowMinutes),
});

const fromDraft = (d: RuleDraft): DepositRule => {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    id: d.id,
    label: d.label.trim() || undefined,
    enabled: d.enabled,
    method: d.method === "ANY" ? null : (d.method as DepositRule["method"]),
    kycStatus: d.kycStatus === "ANY" ? null : (d.kycStatus as DepositRule["kycStatus"]),
    perTransactionMax: num(d.perTransactionMax),
    dailyMax: num(d.dailyMax),
    monthlyMax: num(d.monthlyMax),
    velocityMaxCount: num(d.velocityMaxCount),
    velocityWindowMinutes: num(d.velocityWindowMinutes),
  };
};

export function RiskSection() {
  const { data: config, isLoading, error } = useRiskConfig();
  const update = useUpdateRiskConfig();

  const [concEnabled, setConcEnabled] = useState(false);
  const [maxPct, setMaxPct] = useState("25");
  const [warnPct, setWarnPct] = useState("");
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setConcEnabled(config.concentrationEnabled);
    setMaxPct(String(config.maxPositionPct));
    setWarnPct(config.warnPositionPct == null ? "" : String(config.warnPositionPct));
    setRules(config.depositRules.map(toDraft));
  }, [config]);

  const forbidden = (error as any)?.status === 403;

  const problem = useMemo(() => {
    if (concEnabled) {
      const max = Number(maxPct);
      if (!Number.isFinite(max) || max < 1 || max > 100) return "Max position must be 1–100%.";
      if (warnPct.trim() !== "") {
        const warn = Number(warnPct);
        if (!Number.isFinite(warn) || warn < 1 || warn > 100) return "Warning threshold must be 1–100%.";
        if (warn >= max) return "Warning threshold must be below the maximum.";
      }
    }
    for (const [i, d] of rules.entries()) {
      const r = fromDraft(d);
      const hasBound =
        r.perTransactionMax != null || r.dailyMax != null || r.monthlyMax != null ||
        (r.velocityMaxCount != null && r.velocityWindowMinutes != null);
      if (!hasBound) return `Rule ${i + 1}: set at least one limit.`;
      if ((r.velocityMaxCount != null) !== (r.velocityWindowMinutes != null))
        return `Rule ${i + 1}: velocity needs both a count and a window.`;
      if (r.dailyMax != null && r.monthlyMax != null && r.monthlyMax < r.dailyMax)
        return `Rule ${i + 1}: monthly limit cannot be below daily limit.`;
    }
    return null;
  }, [concEnabled, maxPct, warnPct, rules]);

  const onSave = async () => {
    setLocalError(null);
    if (problem) { setLocalError(problem); return; }
    try {
      await update.mutateAsync({
        concentrationEnabled: concEnabled,
        maxPositionPct: Number(maxPct || 100),
        warnPositionPct: warnPct.trim() === "" ? null : Number(warnPct),
        depositRules: rules.map(fromDraft),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setLocalError(e?.message ?? "Failed to save risk configuration");
    }
  };

  if (forbidden) {
    return (
      <SectionCard title="Risk & Limits">
        <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Risk constraints belong to the owning broker. Platform administrators observe but cannot configure another broker's limits.</p>
        </div>
      </SectionCard>
    );
  }

  if (isLoading) {
    return (
      <SectionCard title="Risk & Limits">
        <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading risk configuration…
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Portfolio concentration ── */}
      <SectionCard
        title="Portfolio Concentration Limit"
        description="Caps how much of an investor's stock portfolio a single position may reach, measured after the order fills. Applies to BUY orders only — clients can always sell. Enforced server-side on every order."
      >
        <div className="space-y-4">
          <Toggle
            checked={concEnabled}
            onChange={setConcEnabled}
            label={concEnabled ? "Enabled — buys exceeding the cap are rejected" : "Disabled — no concentration cap"}
          />
          {concEnabled && (
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Maximum per stock (blocks the order)
                </label>
                <NumInput value={maxPct} onChange={setMaxPct} suffix="% of portfolio" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Warning threshold (optional — order proceeds with a caution)
                </label>
                <NumInput value={warnPct} onChange={setWarnPct} placeholder="none" suffix="%" />
              </div>
              <div className="sm:col-span-2 flex items-start gap-2 rounded-[3px] bg-muted/40 border border-border px-3.5 py-2.5 text-xs text-muted-foreground">
                <PieChart className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Example: with a {maxPct || "25"}% cap, an investor whose portfolio is worth MK 1,000,000
                  cannot end up holding more than MK {(Number(maxPct || 25) * 10_000).toLocaleString()} of any single stock.
                  The Review Order screen shows them their current and post-order exposure before they confirm.
                </span>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Deposit limits ── */}
      <SectionCard
        title="Deposit Limits"
        description="Per-transaction, daily, monthly, and velocity caps on client deposits. Rules can target a payment method or KYC status; blank = applies to all. Where several rules (or the platform-wide limit) overlap, the MOST RESTRICTIVE bound applies. Enforced server-side on every deposit."
      >
        <div className="space-y-4">
          {rules.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No broker deposit rules — only the platform-wide daily limit applies. Add a rule below.
            </p>
          )}

          {rules.map((r, i) => (
            <div key={r.id} className="rounded-[3px] border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Toggle
                  checked={r.enabled}
                  onChange={(v) => setRules(rs => rs.map((x, j) => j === i ? { ...x, enabled: v } : x))}
                  label=""
                />
                <input
                  value={r.label}
                  placeholder={`Rule ${i + 1} — e.g. "Card deposits"`}
                  maxLength={120}
                  onChange={(e) => setRules(rs => rs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  className="flex-1 h-9 px-3 rounded-[3px] bg-background border border-border text-sm focus:outline-none focus:border-pine/50"
                />
                <button
                  type="button"
                  onClick={() => setRules(rs => rs.filter((_, j) => j !== i))}
                  className="w-8 h-8 rounded-[3px] flex items-center justify-center text-muted-foreground hover:bg-rose/10 hover:text-rose transition-colors shrink-0"
                  title="Delete rule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">Payment method</label>
                  <Select
                    value={r.method}
                    onChange={(v) => setRules(rs => rs.map((x, j) => j === i ? { ...x, method: v } : x))}
                    options={[["ANY", "Any method"], ["CARD", "Card"], ["BANK", "Bank"], ["MOBILE_MONEY", "Mobile money"]]}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">KYC status</label>
                  <Select
                    value={r.kycStatus}
                    onChange={(v) => setRules(rs => rs.map((x, j) => j === i ? { ...x, kycStatus: v } : x))}
                    options={[["ANY", "Any status"], ["APPROVED", "Approved"], ["PENDING", "Pending"], ["NOT_SUBMITTED", "Not submitted"]]}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">Per transaction</label>
                  <NumInput value={r.perTransactionMax} placeholder="no cap" suffix="MWK"
                    onChange={(v) => setRules(rs => rs.map((x, j) => j === i ? { ...x, perTransactionMax: v } : x))} />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">Daily total</label>
                  <NumInput value={r.dailyMax} placeholder="no cap" suffix="MWK"
                    onChange={(v) => setRules(rs => rs.map((x, j) => j === i ? { ...x, dailyMax: v } : x))} />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">Monthly total</label>
                  <NumInput value={r.monthlyMax} placeholder="no cap" suffix="MWK"
                    onChange={(v) => setRules(rs => rs.map((x, j) => j === i ? { ...x, monthlyMax: v } : x))} />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">Max deposits</label>
                  <NumInput value={r.velocityMaxCount} placeholder="∞"
                    onChange={(v) => setRules(rs => rs.map((x, j) => j === i ? { ...x, velocityMaxCount: v } : x))} />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">…per window</label>
                  <NumInput value={r.velocityWindowMinutes} placeholder="minutes" suffix="min"
                    onChange={(v) => setRules(rs => rs.map((x, j) => j === i ? { ...x, velocityWindowMinutes: v } : x))} />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setRules(rs => [...rs, {
              id: `rule-${Date.now().toString(36)}`,
              label: "", enabled: true, method: "ANY", kycStatus: "ANY",
              perTransactionMax: "", dailyMax: "", monthlyMax: "",
              velocityMaxCount: "", velocityWindowMinutes: "",
            }])}
            className="flex items-center gap-1.5 h-8 px-3 rounded-[3px] border border-dashed border-border text-xs text-muted-foreground hover:text-pine hover:border-pine/40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add deposit rule
          </button>
        </div>
      </SectionCard>

      {/* ── Save ── */}
      {(localError || problem) && (
        <div className="flex items-center gap-2 text-[13px] text-rose">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {localError ?? problem}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Every change is recorded in the audit log with the before/after configuration.
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={update.isPending}
          className="flex items-center gap-2 h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 transition-colors disabled:opacity-60 shrink-0"
        >
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved — live immediately" : update.isPending ? "Saving…" : "Save risk limits"}
        </button>
      </div>
    </div>
  );
}
