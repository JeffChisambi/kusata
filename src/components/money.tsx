/**
 * Abbreviated money that reveals the TRUE full value on hover — both as a
 * native tooltip and a styled popover, so brokers can always verify the exact
 * figure behind a rounded display.
 *
 * Shared: the overview, the withdrawals queue and the activity drawer all show
 * the same amounts and must abbreviate them identically.
 */
export const fmtMoney = (n: number) => {
  if (n >= 1_000_000_000) return `MK ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `MK ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `MK ${(n / 1_000).toFixed(1)}K`;
  return `MK ${n}`;
};

/** Exact unrounded figure, for hover tooltips on abbreviated amounts. */
export const fmtExact = (n: number) =>
  `MWK ${n.toLocaleString("en-MW", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export function Money({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={className}>—</span>;
  return (
    <span className={`relative group/money cursor-help ${className}`} title={fmtExact(value)}>
      {fmtMoney(value)}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 hidden group-hover/money:block whitespace-nowrap rounded-[4px] border border-border bg-card px-2.5 py-1.5 text-[11px] font-mono font-medium text-foreground shadow-lg">
        {fmtExact(value)}
      </span>
    </span>
  );
}
