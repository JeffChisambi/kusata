import { Link } from "@tanstack/react-router";
import { ChevronRight, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/* ─────────────────────────────────────────────────────────────────────────
 * Shared building blocks for the broker "details" pages (user 360 + KYC).
 * A single card-based system — left profile column, centre content, right
 * summary panel — kept consistent across both pages.
 * ──────────────────────────────────────────────────────────────────────── */

/* ── Breadcrumb ── */
export function Breadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs mb-5 flex-wrap">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {it.to && !last ? (
              <Link to={it.to} className="text-muted-foreground hover:text-pine transition-colors">
                {it.label}
              </Link>
            ) : (
              <span className={last ? "text-foreground font-medium" : "text-muted-foreground"}>{it.label}</span>
            )}
            {!last && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
          </span>
        );
      })}
    </nav>
  );
}

/* ── Panel card (titled, with optional right-hand action) ── */
export function Panel({
  title, subtitle, action, children, className = "", bodyClassName = "",
}: {
  title?: string; subtitle?: string; action?: ReactNode;
  children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={`rounded-[6px] bg-card border border-border ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-border">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold truncate">{title}</h3>}
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ── Progress ring (donut) ──
 * Reproduces the screenshot's stat rings. Pass `value`/`max` for a quota
 * ("08 of 12") or a percentage score. Center + legend are configurable. */
export function Ring({
  value, max = 100, color = "var(--pine)", size = 132, stroke = 11,
  centerMain, centerSub, className = "",
}: {
  value: number; max?: number; color?: string; size?: number; stroke?: number;
  centerMain?: ReactNode; centerSub?: ReactNode; className?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const offset = circ * (1 - pct);
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} opacity={0.5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        {centerMain && <div className="text-lg font-bold tabular-nums">{centerMain}</div>}
        {centerSub && <div className="text-[10px] text-muted-foreground mt-1">{centerSub}</div>}
      </div>
    </div>
  );
}

/* ── Ring stat card (ring + title + two-item legend) ── */
export function RingStatCard({
  title, subtitle, value, max, color, centerMain, centerSub, legend,
}: {
  title: string; subtitle?: string; value: number; max: number; color: string;
  centerMain: ReactNode; centerSub?: ReactNode;
  legend?: Array<{ label: string; value: string; dot?: boolean }>;
}) {
  return (
    <div className="rounded-[6px] bg-card border border-border p-5 flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center py-3">
        <Ring value={value} max={max} color={color} centerMain={centerMain} centerSub={centerSub} />
      </div>
      {legend && legend.length > 0 && (
        <div className="flex items-center justify-center gap-5 pt-1">
          {legend.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {l.dot !== false && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
              <span className="text-[11px] text-muted-foreground">{l.label}</span>
              <span className="text-[11px] font-semibold">{l.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── KPI tile ── */
export function Kpi({
  icon, label, value, sub, tone = "default",
}: {
  icon?: ReactNode; label: string; value: ReactNode; sub?: string;
  tone?: "default" | "pine" | "amber" | "rose";
}) {
  const toneCls = {
    default: "text-muted-foreground bg-muted",
    pine: "text-pine bg-pine/10",
    amber: "text-amber bg-amber/10",
    rose: "text-rose bg-rose/10",
  }[tone];
  return (
    <div className="rounded-[6px] bg-card border border-border p-4">
      {icon && (
        <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-3 ${toneCls}`}>{icon}</div>
      )}
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-0.5 truncate">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

/* ── Label/value row (right-aligned value, like the payroll summary) ── */
export function SummaryRow({
  label, value, strong, className = "",
}: { label: string; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 ${className}`}>
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right truncate ${strong ? "text-sm font-bold" : "text-sm font-medium"}`}>{value}</span>
    </div>
  );
}

/* ── Stacked field (label above value) — used inside forms/info cards ── */
export function Field({
  label, value, badge, wide, className = "",
}: {
  label: string; value: ReactNode; badge?: ReactNode; wide?: boolean; className?: string;
}) {
  return (
    <div className={`${wide ? "sm:col-span-2" : ""} ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        {badge}
      </div>
      <div className="text-sm font-medium break-words">{value || <span className="text-muted-foreground/50">—</span>}</div>
    </div>
  );
}

/* ── Document / file row (essential documents list) ── */
export function DocRow({
  name, meta, thumbUrl, onView, downloadUrl,
}: {
  name: string; meta?: string; thumbUrl?: string | null;
  onView?: () => void; downloadUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[4px] border border-border p-2.5 hover:bg-muted/30 transition-colors">
      <div className="w-9 h-9 rounded-[3px] bg-rose/10 text-rose flex items-center justify-center shrink-0 overflow-hidden">
        {thumbUrl ? <img src={thumbUrl} alt="" className="w-full h-full object-cover" /> : <FileText className="w-4 h-4" />}
      </div>
      <button onClick={onView} className="flex-1 min-w-0 text-left" disabled={!onView}>
        <div className="text-sm font-medium truncate hover:text-pine transition-colors">{name}</div>
        {meta && <div className="text-[11px] text-muted-foreground truncate">{meta}</div>}
      </button>
      {downloadUrl ? (
        <a
          href={downloadUrl} target="_blank" rel="noopener noreferrer"
          className="w-7 h-7 rounded-[3px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          title="Open"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ) : (
        <span className="w-7 h-7 rounded-[3px] flex items-center justify-center text-muted-foreground/40 shrink-0">
          <Download className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  );
}

/* ── Avatar (initials) ── */
export function InitialsAvatar({ name, size = 96 }: { name: string; size?: number }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white bg-gradient-to-br from-pine to-teal shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials || "?"}
    </div>
  );
}

/* ── Inline spinner block ── */
export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}
