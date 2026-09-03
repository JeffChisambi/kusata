import { useEffect, useMemo, useState } from "react";
import {
  Loader2, CheckCircle2, AlertTriangle, Plus, Trash2, Save, Percent,
  Landmark, Info,
} from "lucide-react";
import {
  useFeeConfig, useUpdateFeeConfig, type CommissionTier,
} from "@/hooks/useFees";

/**
 * Settings → Fees & Charges.
 *
 * The broker's OWN fee schedule — the single source every fee calculation
 * reads (mobile order review, execution engine, deposit flow all consume
 * the same backend policy):
 *
 *   - Deposit processing fee (fixed or percentage, per deposit)
 *   - Tiered trading commissions (by gross order value)
 *
 * Statutory SEC/MSE levies are fixed by regulation and shown read-only.
 */

const fmtMWK = (n: number) => `MK ${n.toLocaleString()}`;

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
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 group"
      aria-pressed={checked}
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-pine" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
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
        type="number"
        min={0}
        step="any"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 pr-9 rounded-[3px] bg-background border border-border text-sm font-mono focus:outline-none focus:border-pine/50 focus:ring-1 focus:ring-pine/20 transition-colors"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Tier row under edit — strings so blank fields are representable. */
type TierDraft = { minAmount: string; maxAmount: string; ratePct: string; minFee: string };

const toDraft = (t: CommissionTier): TierDraft => ({
  minAmount: String(t.minAmount),
  maxAmount: t.maxAmount == null ? "" : String(t.maxAmount),
  ratePct: String(t.ratePct),
  minFee: t.minFee == null ? "" : String(t.minFee),
});

const fromDraft = (d: TierDraft): CommissionTier => ({
  minAmount: Number(d.minAmount || 0),
  maxAmount: d.maxAmount.trim() === "" ? null : Number(d.maxAmount),
  ratePct: Number(d.ratePct || 0),
  ...(d.minFee.trim() === "" ? {} : { minFee: Number(d.minFee) }),
});

export function FeesSection() {
  const { data: config, isLoading, error } = useFeeConfig();
  const update = useUpdateFeeConfig();

  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositKind, setDepositKind] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [depositValue, setDepositValue] = useState("0");
  const [depositDesc, setDepositDesc] = useState("");
  const [commissionEnabled, setCommissionEnabled] = useState(true);
  const [tiers, setTiers] = useState<TierDraft[]>([]);
  const [secLevy, setSecLevy] = useState("0.1");
  const [mseLevy, setMseLevy] = useState("0.1");
  const [withholding, setWithholding] = useState("0");
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setDepositEnabled(config.depositFeeEnabled);
    setDepositKind(config.depositFeeKind);
    setDepositValue(String(config.depositFeeValue));
    setDepositDesc(config.depositFeeDescription ?? "");
    setCommissionEnabled(config.commissionEnabled);
    setTiers(config.commissionTiers.map(toDraft));
    setSecLevy(String(config.statutory.secLevyPct));
    setMseLevy(String(config.statutory.mseLevyPct));
    setWithholding(String(config.statutory.withholdingTaxPct ?? 0));
  }, [config]);

  const forbidden = (error as any)?.status === 403;

  const tierProblem = useMemo(() => {
    const parsed = tiers.map(fromDraft).sort((a, b) => a.minAmount - b.minAmount);
    for (let i = 0; i < parsed.length; i++) {
      const t = parsed[i];
      if (t.maxAmount != null && t.maxAmount <= t.minAmount)
        return `Tier ${i + 1}: "to" must be greater than "from".`;
      if (i < parsed.length - 1) {
        if (t.maxAmount == null) return `Tier ${i + 1}: only the last tier may be open-ended.`;
        if (parsed[i + 1].minAmount < t.maxAmount)
          return `Tiers ${i + 1} and ${i + 2} overlap.`;
      }
      if (t.ratePct < 0 || t.ratePct > 100) return `Tier ${i + 1}: rate must be 0–100%.`;
    }
    return null;
  }, [tiers]);

  const levyProblem = useMemo(() => {
    const rates: Array<[string, string]> = [
      ["SEC levy", secLevy], ["MSE levy", mseLevy], ["Withholding tax", withholding],
    ];
    for (const [label, raw] of rates) {
      const n = Number(raw);
      if (raw.trim() === "" || Number.isNaN(n)) return `${label}: enter a rate.`;
      if (n < 0 || n > 100) return `${label}: must be between 0 and 100%.`;
    }
    return null;
  }, [secLevy, mseLevy, withholding]);

  const onSave = async () => {
    setLocalError(null);
    if (commissionEnabled && tiers.length === 0) {
      setLocalError("Add at least one commission tier, or disable commissions.");
      return;
    }
    if (tierProblem) { setLocalError(tierProblem); return; }
    if (levyProblem) { setLocalError(levyProblem); return; }
    try {
      await update.mutateAsync({
        depositFeeEnabled: depositEnabled,
        depositFeeKind: depositKind,
        depositFeeValue: Number(depositValue || 0),
        depositFeeDescription: depositDesc.trim() || undefined,
        commissionEnabled,
        commissionTiers: tiers.map(fromDraft).sort((a, b) => a.minAmount - b.minAmount),
        secLevyPct: Number(secLevy || 0),
        mseLevyPct: Number(mseLevy || 0),
        withholdingTaxPct: Number(withholding || 0),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setLocalError(e?.message ?? "Failed to save fee configuration");
    }
  };

  if (forbidden) {
    return (
      <SectionCard title="Fees & Charges">
        <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Fee schedules belong to the owning broker. Platform administrators
            observe broker operations but cannot configure another broker's fees.
          </p>
        </div>
      </SectionCard>
    );
  }

  if (isLoading) {
    return (
      <SectionCard title="Fees & Charges">
        <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading fee configuration…
        </div>
      </SectionCard>
    );
  }

  const previewAmount = 100_000;
  const previewDeposit =
    depositEnabled
      ? depositKind === "PERCENT"
        ? Math.round(previewAmount * (Number(depositValue || 0) / 100) * 100) / 100
        : Math.min(Number(depositValue || 0), previewAmount)
      : 0;

  return (
    <div className="space-y-5">
      {/* ── Deposit processing fee ── */}
      <SectionCard
        title="Deposit Processing Fee"
        description="Charged when a client deposits. The client pays the gross amount; their wallet is credited net of this fee. Recorded on every deposit transaction as a payment cost."
      >
        <div className="space-y-4">
          <Toggle
            checked={depositEnabled}
            onChange={setDepositEnabled}
            label={depositEnabled ? "Enabled — applied to every deposit" : "Disabled — deposits credit in full"}
          />

          {depositEnabled && (
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Fee type</label>
                <div className="flex rounded-[3px] border border-border overflow-hidden">
                  {(["PERCENT", "FIXED"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setDepositKind(k)}
                      className={`flex-1 h-9 text-sm flex items-center justify-center gap-1.5 transition-colors ${
                        depositKind === k
                          ? "bg-pine text-primary-foreground font-medium"
                          : "bg-background text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {k === "PERCENT" ? <Percent className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />}
                      {k === "PERCENT" ? "Percentage" : "Fixed amount"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  {depositKind === "PERCENT" ? "Rate" : "Amount"}
                </label>
                <NumInput
                  value={depositValue}
                  onChange={setDepositValue}
                  suffix={depositKind === "PERCENT" ? "%" : "MWK"}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Description shown to clients (optional)
                </label>
                <input
                  value={depositDesc}
                  onChange={(e) => setDepositDesc(e.target.value)}
                  maxLength={300}
                  placeholder="e.g. Card processing fee"
                  className="w-full h-9 px-3 rounded-[3px] bg-background border border-border text-sm focus:outline-none focus:border-pine/50 focus:ring-1 focus:ring-pine/20"
                />
              </div>
              <div className="sm:col-span-2 rounded-[3px] bg-muted/40 border border-border px-3.5 py-2.5 text-xs text-muted-foreground">
                Example: a {fmtMWK(previewAmount)} deposit → fee {fmtMWK(previewDeposit)} →
                wallet credited <span className="font-semibold text-foreground">{fmtMWK(previewAmount - previewDeposit)}</span>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Trading commissions ── */}
      <SectionCard
        title="Trading Commissions"
        description="Your commission per executed order, by gross order value (price × quantity). Applied identically to buys and sells; recorded on every trade as broker revenue. Statutory levies are set separately below and always added on top."
      >
        <div className="space-y-4">
          <Toggle
            checked={commissionEnabled}
            onChange={setCommissionEnabled}
            label={commissionEnabled ? "Enabled — commission charged per trade" : "Disabled — no broker commission (levies still apply)"}
          />

          {commissionEnabled && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-3 font-medium text-[11px] uppercase tracking-wider text-muted-foreground">From (MWK)</th>
                      <th className="py-2 pr-3 font-medium text-[11px] uppercase tracking-wider text-muted-foreground">To (MWK)</th>
                      <th className="py-2 pr-3 font-medium text-[11px] uppercase tracking-wider text-muted-foreground">Rate</th>
                      <th className="py-2 pr-3 font-medium text-[11px] uppercase tracking-wider text-muted-foreground">Min fee (MWK)</th>
                      <th className="py-2 w-9"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((t, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3">
                          <NumInput value={t.minAmount} onChange={(v) => setTiers(ts => ts.map((x, j) => j === i ? { ...x, minAmount: v } : x))} className="w-32" />
                        </td>
                        <td className="py-2 pr-3">
                          <NumInput value={t.maxAmount} placeholder="∞ (no limit)" onChange={(v) => setTiers(ts => ts.map((x, j) => j === i ? { ...x, maxAmount: v } : x))} className="w-32" />
                        </td>
                        <td className="py-2 pr-3">
                          <NumInput value={t.ratePct} suffix="%" onChange={(v) => setTiers(ts => ts.map((x, j) => j === i ? { ...x, ratePct: v } : x))} className="w-24" />
                        </td>
                        <td className="py-2 pr-3">
                          <NumInput value={t.minFee} placeholder="none" onChange={(v) => setTiers(ts => ts.map((x, j) => j === i ? { ...x, minFee: v } : x))} className="w-28" />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setTiers(ts => ts.filter((_, j) => j !== i))}
                            className="w-8 h-8 rounded-[3px] flex items-center justify-center text-muted-foreground hover:bg-rose/10 hover:text-rose transition-colors"
                            title="Delete tier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tiers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                          No tiers configured — add one below.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => {
                  const last = tiers.map(fromDraft).sort((a, b) => a.minAmount - b.minAmount).at(-1);
                  const nextMin = last?.maxAmount != null ? last.maxAmount : (last ? last.minAmount + 100_000 : 0);
                  setTiers(ts => [...ts, { minAmount: String(nextMin), maxAmount: "", ratePct: "1.7", minFee: "" }]);
                }}
                className="flex items-center gap-1.5 h-8 px-3 rounded-[3px] border border-dashed border-border text-xs text-muted-foreground hover:text-pine hover:border-pine/40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add tier
              </button>

              {tierProblem && (
                <div className="flex items-center gap-2 text-[13px] text-amber">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {tierProblem}
                </div>
              )}
            </>
          )}
        </div>
      </SectionCard>

      {/* ── Statutory levies ── */}
      <SectionCard
        title="Statutory Levies"
        description="Regulator-set charges added on top of every executed trade. You collect them and remit them — they are never your revenue, and they are reported separately on the overview. Change them only when the regulator does."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-5">
            <LevyField
              label="SEC levy"
              hint="Securities & Exchange Commission, on gross trade value"
              value={secLevy}
              onChange={setSecLevy}
            />
            <LevyField
              label="MSE levy"
              hint="Malawi Stock Exchange, on gross trade value"
              value={mseLevy}
              onChange={setMseLevy}
            />
            <LevyField
              label="Withholding tax"
              hint="Capital gains — applied to SELL orders only"
              value={withholding}
              onChange={setWithholding}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            A trade of {fmtMWK(previewAmount)} carries{" "}
            <span className="font-semibold text-foreground">
              {fmtMWK((previewAmount * (Number(secLevy || 0) + Number(mseLevy || 0))) / 100)}
            </span>{" "}
            in levies on a buy
            {Number(withholding || 0) > 0 && (
              <>
                , and{" "}
                <span className="font-semibold text-foreground">
                  {fmtMWK((previewAmount * (Number(secLevy || 0) + Number(mseLevy || 0) + Number(withholding || 0))) / 100)}
                </span>{" "}
                on a sell
              </>
            )}
            .
          </div>

          {levyProblem && (
            <div className="flex items-center gap-2 text-[13px] text-amber">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {levyProblem}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Save ── */}
      {localError && (
        <div className="flex items-center gap-2 text-[13px] text-rose">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {localError}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={update.isPending}
          className="flex items-center gap-2 h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 transition-colors disabled:opacity-60"
        >
          {update.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "Saved — live immediately" : update.isPending ? "Saving…" : "Save fee schedule"}
        </button>
      </div>
    </div>
  );
}

/** One statutory rate: a percent input with its own label and explanation. */
function LevyField({
  label, hint, value, onChange,
}: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <label className="min-w-[190px]">
      <div className="text-xs font-medium text-foreground">{label}</div>
      <div className="mt-1.5">
        <NumInput value={value} suffix="%" onChange={onChange} className="w-28" />
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div>
    </label>
  );
}
