import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Palette, Loader2, RotateCcw, Check, Smartphone } from "lucide-react";
import { Card } from "@/components/broker-shell";
import { requireSuperAdmin } from "@/lib/auth";
import {
  useMobileTheme, useUpdateMobileTheme, useResetMobileTheme,
  BRAND_KEYS, type BrandKey, type ThemeColors,
} from "@/hooks/useMobileTheme";

export const Route = createFileRoute("/mobile-themes")({
  head: () => ({ meta: [{ title: "Mobile Themes — Pine Broker Admin" }] }),
  beforeLoad: () => requireSuperAdmin(),
  component: MobileThemesPage,
});

const TOKENS: { key: BrandKey; label: string; hint: string; group: "brand" | "surface" }[] = [
  { key: "primary", label: "Primary", hint: "Brand color — headers, primary buttons (both modes)", group: "brand" },
  { key: "accent", label: "Accent", hint: "Call-to-action green (both modes)", group: "brand" },
  { key: "destructive", label: "Danger", hint: "Destructive actions & errors (both modes)", group: "brand" },
  { key: "background", label: "Background", hint: "Screen background (light mode)", group: "surface" },
  { key: "card", label: "Card surface", hint: "Cards, rows, inputs (light mode)", group: "surface" },
  { key: "text", label: "Text", hint: "Primary text (light mode)", group: "surface" },
  { key: "mutedForeground", label: "Muted text", hint: "Secondary text & icons (light mode)", group: "surface" },
  { key: "border", label: "Border", hint: "Dividers & outlines (light mode)", group: "surface" },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function MobileThemesPage() {
  const { data, isLoading, isError } = useMobileTheme();
  const update = useUpdateMobileTheme();
  const reset = useResetMobileTheme();

  const defaults = data?.defaults;
  const [draft, setDraft] = useState<Record<BrandKey, string> | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);

  // Initialize the editor from the active theme (falling back to Pine defaults).
  useEffect(() => {
    if (data && !draft) {
      const base = { ...(data.defaults), ...(data.colors ?? {}) } as Record<BrandKey, string>;
      setDraft(base);
    }
  }, [data, draft]);

  const flash = (msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2500);
  };

  const activeMerged = useMemo(
    () => (data ? ({ ...data.defaults, ...(data.colors ?? {}) } as Record<BrandKey, string>) : null),
    [data],
  );
  const isDirty = useMemo(() => {
    if (!draft || !activeMerged) return false;
    return BRAND_KEYS.some((k) => (draft[k] ?? "").toLowerCase() !== (activeMerged[k] ?? "").toLowerCase());
  }, [draft, activeMerged]);

  const setColor = (key: BrandKey, value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const onSave = () => {
    if (!draft) return;
    const payload: ThemeColors = {};
    for (const k of BRAND_KEYS) if (HEX_RE.test(draft[k] ?? "")) payload[k] = draft[k];
    update.mutate(payload, {
      onSuccess: () => flash("Theme saved — live on the app."),
      onError: (e: any) => flash(e?.message ?? "Save failed.", "err"),
    });
  };

  const onReset = () => {
    reset.mutate(undefined, {
      onSuccess: (res) => { setDraft({ ...res.defaults }); flash("Reset to the Pine theme."); },
      onError: (e: any) => flash(e?.message ?? "Reset failed.", "err"),
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[3px] bg-pine/10 text-pine flex items-center justify-center">
          <Palette className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Mobile Themes</h1>
          <p className="text-xs text-muted-foreground">Change the colors of the Pine mobile app. Saved changes apply to every user.</p>
        </div>
        <button
          onClick={onReset}
          disabled={reset.isPending}
          className="h-9 px-3.5 rounded-[3px] border border-border text-sm font-medium text-muted-foreground hover:bg-muted/40 flex items-center gap-1.5 disabled:opacity-50"
        >
          {reset.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reset to Pine
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty || update.isPending}
          className="h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-40 flex items-center gap-1.5"
        >
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save changes
        </button>
      </div>

      {isLoading || !draft ? (
        <Card><div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></Card>
      ) : isError ? (
        <Card><div className="py-16 text-center text-sm text-rose">Failed to load the mobile theme.</div></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          {/* Editor */}
          <div className="space-y-5">
            <Card title="Brand colors" subtitle="Applied across both light and dark mode.">
              <div className="space-y-1">
                {TOKENS.filter((t) => t.group === "brand").map((t) => (
                  <Swatch key={t.key} token={t} value={draft[t.key]} onChange={(v) => setColor(t.key, v)} isDefault={defaults?.[t.key] === draft[t.key]} />
                ))}
              </div>
            </Card>
            <Card title="Surfaces & text" subtitle="Applied to light mode. Dark mode keeps its adaptive surfaces so it always stays readable.">
              <div className="space-y-1">
                {TOKENS.filter((t) => t.group === "surface").map((t) => (
                  <Swatch key={t.key} token={t} value={draft[t.key]} onChange={(v) => setColor(t.key, v)} isDefault={defaults?.[t.key] === draft[t.key]} />
                ))}
              </div>
            </Card>
          </div>

          {/* Live preview */}
          <div className="lg:sticky lg:top-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Live preview
            </div>
            <PhonePreview c={draft} />
            <p className="text-[11px] text-muted-foreground text-center mt-3 leading-relaxed">
              An approximation of the app's Home screen with your colors.
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-4 right-4 z-[70] rounded-[4px] px-4 py-2.5 text-sm shadow-lg ${
          toast.tone === "ok" ? "bg-pine text-primary-foreground" : "bg-rose text-white"
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}

function Swatch({ token, value, onChange, isDefault }: {
  token: { key: BrandKey; label: string; hint: string };
  value: string; onChange: (v: string) => void; isDefault?: boolean;
}) {
  const valid = HEX_RE.test(value ?? "");
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <label className="relative w-9 h-9 rounded-[6px] border border-border overflow-hidden shrink-0 cursor-pointer" style={{ background: valid ? value : "#fff" }}>
        <input type="color" value={valid ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium flex items-center gap-2">
          {token.label}
          {!isDefault && <span className="text-[9px] uppercase tracking-wide text-pine bg-pine/10 rounded px-1.5 py-0.5">changed</span>}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{token.hint}</div>
      </div>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className={`w-[92px] h-8 px-2 rounded-[3px] border bg-background text-xs font-mono uppercase focus:outline-none ${valid ? "border-border focus:border-pine/40" : "border-rose text-rose"}`}
      />
    </div>
  );
}

/** A small approximation of the mobile Home screen using the draft colors. */
function PhonePreview({ c }: { c: Record<BrandKey, string> }) {
  return (
    <div className="mx-auto w-[260px] rounded-[26px] border-[6px] border-neutral-800 bg-neutral-800 shadow-xl overflow-hidden">
      <div style={{ background: c.background }} className="h-[440px] flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <div>
            <div style={{ color: c.mutedForeground }} className="text-[10px]">Good morning</div>
            <div style={{ color: c.text }} className="text-[15px] font-bold">Jeffrey</div>
          </div>
          <div style={{ background: c.primary }} className="w-8 h-8 rounded-full" />
        </div>

        {/* Balance card */}
        <div className="px-4">
          <div style={{ background: c.primary }} className="rounded-[16px] p-4">
            <div className="text-white/70 text-[10px]">Total balance</div>
            <div className="text-white text-[22px] font-bold mt-1">K 250,000</div>
            <div className="flex gap-2 mt-3">
              <div style={{ background: c.accent }} className="flex-1 text-center text-white text-[11px] font-semibold rounded-[8px] py-1.5">Deposit</div>
              <div className="flex-1 text-center text-white text-[11px] font-semibold rounded-[8px] py-1.5 border border-white/30">Withdraw</div>
            </div>
          </div>
        </div>

        {/* Section */}
        <div className="px-4 mt-4">
          <div style={{ color: c.text }} className="text-[13px] font-bold mb-2">Invest</div>
          <div style={{ background: c.card, borderColor: c.border }} className="rounded-[12px] border divide-y" >
            {["Buy shares", "Treasury bills", "Watchlist"].map((t, i) => (
              <div key={t} className="flex items-center justify-between px-3 py-2.5" style={{ borderColor: c.border, borderTopWidth: i === 0 ? 0 : 1 }}>
                <div className="flex items-center gap-2">
                  <div style={{ background: c.accent }} className="w-6 h-6 rounded-[7px] opacity-90" />
                  <span style={{ color: c.text }} className="text-[12px] font-medium">{t}</span>
                </div>
                <span style={{ color: c.mutedForeground }} className="text-[16px] leading-none">›</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA + danger */}
        <div className="px-4 mt-auto mb-4">
          <div style={{ background: c.accent }} className="text-center text-white text-[12px] font-semibold rounded-[20px] py-2.5">Send a report</div>
          <div style={{ color: c.destructive }} className="text-center text-[11px] font-medium mt-2">Delete account</div>
        </div>
      </div>
    </div>
  );
}
