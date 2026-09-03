/**
 * Settings → Migration.
 *
 * Brokers joining Pine arrive with an existing client book. This uploads that
 * sheet, shows exactly what will happen to every row before anything is
 * written, and then emails those clients an invitation to claim their account.
 *
 * What it deliberately does NOT do is create accounts. An imported person has
 * not agreed to Pine's terms, has no password, and has not passed KYC here —
 * none of which a broker can supply for them. The import carries their details
 * across so that when they accept, registration is already filled in.
 *
 * The file is parsed here in the browser rather than uploaded, so a sheet with
 * a bad column never reaches the server and the broker sees the problem
 * against their own rows.
 */
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Loader2, Mail, Send, Trash2, Upload, X,
} from "lucide-react";
import {
  useMigratedInvestors, useImportInvestors, useInviteInvestors, useCancelInvitation,
  type MigratedInvestor, type MigrationRow, type ImportResult,
} from "@/hooks/useMigration";
import { relativeTime } from "@/lib/relative-time";

/** Every column the sheet may carry, and the headings we accept for each. */
const COLUMNS: Array<{ field: keyof MigrationRow; label: string; aliases: string[]; required?: boolean }> = [
  { field: "firstName",   label: "First name",    aliases: ["first name", "firstname", "first", "given name", "givenname"], required: true },
  { field: "lastName",    label: "Last name",     aliases: ["last name", "lastname", "last", "surname", "family name"], required: true },
  { field: "phone",       label: "Phone",         aliases: ["phone", "phone number", "mobile", "msisdn", "cell", "telephone"], required: true },
  { field: "email",       label: "Email",         aliases: ["email", "email address", "e-mail"] },
  { field: "dateOfBirth", label: "Date of birth", aliases: ["date of birth", "dateofbirth", "dob", "birth date", "birthdate"] },
  { field: "gender",      label: "Gender",        aliases: ["gender", "sex"] },
];

type ParsedSheet = {
  fileName: string;
  headers: string[];
  /** Header index → the field it maps to, for the columns we recognised. */
  mapping: Partial<Record<keyof MigrationRow, number>>;
  rows: MigrationRow[];
  unmapped: string[];
};

export function MigrationSection() {
  const { data, isLoading, error } = useMigratedInvestors();
  const importMutation = useImportInvestors();
  const inviteMutation = useInviteInvestors();
  const cancelMutation = useCancelInvitation();

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [inviteSummary, setInviteSummary] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);

  const forbidden = (error as any)?.status === 403;
  const investors = data?.investors ?? [];
  const counts = data?.counts;

  const invitable = useMemo(
    () => investors.filter((i) => i.status !== "CLAIMED" && i.status !== "CANCELLED" && i.email),
    [investors],
  );

  const onFile = async (file: File) => {
    setParseError(null);
    setResult(null);
    try {
      setSheet(await parseSheet(file));
    } catch (e: any) {
      setSheet(null);
      setParseError(e?.message ?? "That file could not be read.");
    }
  };

  const runImport = async () => {
    if (!sheet) return;
    try {
      const res = await importMutation.mutateAsync(sheet.rows);
      setResult(res);
      setSheet(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (e: any) {
      setParseError(e?.message ?? "The import failed.");
    }
  };

  const runInvite = async (ids?: string[]) => {
    setInviteSummary(null);
    try {
      const res = await inviteMutation.mutateAsync(ids);
      const parts = [`${res.sent} invitation${res.sent === 1 ? "" : "s"} sent`];
      if (res.skippedNoEmail > 0) parts.push(`${res.skippedNoEmail} skipped (no email address)`);
      if (res.failed > 0) parts.push(`${res.failed} could not be delivered`);
      setInviteSummary(parts.join(" · "));
      setSelected(new Set());
    } catch (e: any) {
      setInviteSummary(e?.message ?? "Invitations could not be sent.");
    }
  };

  if (forbidden) {
    return (
      <Card title="Migration">
        <p className="text-sm text-muted-foreground">
          A client book belongs to the broker who holds it. Platform administrators
          cannot import or invite another broker's investors.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Upload ── */}
      <Card
        title="Import your client book"
        description="Upload a CSV or spreadsheet exported from your previous system. Nothing is saved until you review what it contains."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
              className="hidden"
              id="migration-file"
            />
            <label
              htmlFor="migration-file"
              className="flex items-center gap-2 h-9 px-4 rounded-[3px] border border-border text-sm font-medium cursor-pointer hover:bg-muted/40 transition-colors"
            >
              <Upload className="w-4 h-4" /> Choose file
            </label>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-[13px] text-pine hover:underline"
            >
              Download a template
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Required columns: <strong className="text-foreground">first name</strong>,{" "}
            <strong className="text-foreground">last name</strong>,{" "}
            <strong className="text-foreground">phone</strong>. Optional:{" "}
            email, date of birth, gender. Column headings are matched loosely —
            "Mobile", "MSISDN" and "Phone Number" all work.
          </p>

          {parseError && (
            <div className="flex items-start gap-2 text-[13px] text-rose">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {parseError}
            </div>
          )}

          {sheet && (
            <SheetPreview
              sheet={sheet}
              busy={importMutation.isPending}
              onCancel={() => { setSheet(null); if (fileInput.current) fileInput.current.value = ""; }}
              onImport={runImport}
            />
          )}

          {result && <ImportSummary result={result} onDismiss={() => setResult(null)} />}
        </div>
      </Card>

      {/* ── Imported investors ── */}
      <Card
        title="Imported investors"
        description="Each person here has been invited, or is waiting to be. They create their own password and complete KYC themselves — their imported details only save them the typing."
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : investors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing imported yet. Upload your client book above to begin.
          </p>
        ) : (
          <div className="space-y-4">
            {counts && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
                <Stat label="Waiting to be invited" value={counts.pending} />
                <Stat label="Invited" value={counts.invited} />
                <Stat label="Registered" value={counts.claimed} />
                {counts.cancelled > 0 && <Stat label="Cancelled" value={counts.cancelled} />}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void runInvite(selected.size ? [...selected] : undefined)}
                disabled={inviteMutation.isPending || invitable.length === 0}
                className="flex items-center gap-2 h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-50 transition-colors"
              >
                {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {selected.size > 0
                  ? `Send ${selected.size} invitation${selected.size === 1 ? "" : "s"}`
                  : `Invite everyone (${invitable.length})`}
              </button>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-[13px] text-muted-foreground hover:text-foreground"
                >
                  Clear selection
                </button>
              )}
              {inviteSummary && (
                <span className="text-[13px] text-muted-foreground">{inviteSummary}</span>
              )}
            </div>

            <InvestorTable
              investors={investors}
              selected={selected}
              onToggle={(id) =>
                setSelected((s) => {
                  const next = new Set(s);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })
              }
              onCancel={(id) => cancelMutation.mutate(id)}
              cancelling={cancelMutation.isPending}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Card({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-muted-foreground">
      {label} <strong className="text-foreground font-mono">{value.toLocaleString()}</strong>
    </span>
  );
}

function SheetPreview({
  sheet, busy, onCancel, onImport,
}: { sheet: ParsedSheet; busy: boolean; onCancel: () => void; onImport: () => void }) {
  const missing = COLUMNS.filter((c) => c.required && sheet.mapping[c.field] === undefined);
  const preview = sheet.rows.slice(0, 5);

  return (
    <div className="rounded-[3px] border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate">{sheet.fileName}</div>
          <div className="text-[11px] text-muted-foreground">
            {sheet.rows.length.toLocaleString()} row{sheet.rows.length === 1 ? "" : "s"} ·{" "}
            {Object.keys(sheet.mapping).length} column{Object.keys(sheet.mapping).length === 1 ? "" : "s"} recognised
          </div>
        </div>
        <button onClick={onCancel} className="w-7 h-7 rounded-[3px] hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Discard file">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {missing.length > 0 ? (
          <div className="flex items-start gap-2 text-[13px] text-rose">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              No column matched {missing.map((c) => c.label.toLowerCase()).join(" or ")}. Rename the
              heading in your sheet, or download the template above.
            </span>
          </div>
        ) : (
          <>
            {sheet.unmapped.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Kept for reference but not used by Pine: {sheet.unmapped.join(", ")}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 text-left font-medium">Name</th>
                    <th className="py-2 text-left font-medium">Phone</th>
                    <th className="py-2 text-left font-medium">Email</th>
                    <th className="py-2 text-left font-medium">Born</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}</td>
                      <td className="py-2 font-mono">{r.phone || "—"}</td>
                      <td className="py-2 text-muted-foreground">{r.email || "—"}</td>
                      <td className="py-2 text-muted-foreground">{r.dateOfBirth || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sheet.rows.length > preview.length && (
              <p className="text-[11px] text-muted-foreground">
                …and {(sheet.rows.length - preview.length).toLocaleString()} more.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onImport}
                disabled={busy}
                className="flex items-center gap-2 h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-60 transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Import {sheet.rows.length.toLocaleString()} row{sheet.rows.length === 1 ? "" : "s"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ImportSummary({ result, onDismiss }: { result: ImportResult; onDismiss: () => void }) {
  const skipped = result.results.filter((r) => r.outcome === "skipped");
  return (
    <div className="rounded-[3px] border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <CheckCircle2 className="w-4 h-4 text-pine" />
          {result.imported} imported
          {result.updated > 0 && ` · ${result.updated} updated`}
          {result.skipped > 0 && ` · ${result.skipped} skipped`}
        </span>
        <button onClick={onDismiss} className="w-7 h-7 rounded-[3px] hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {skipped.length > 0 && (
        <div className="p-4">
          {/* Naming the row number matters: a broker fixing a 900-row export
              needs to find the line, not just be told the count. */}
          <p className="text-[11px] text-muted-foreground mb-2">
            These rows were left out. Correct them in your sheet and upload it again —
            re-importing updates people rather than duplicating them.
          </p>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {skipped.map((r) => (
              <li key={r.row} className="text-[12px] flex gap-2">
                <span className="text-muted-foreground font-mono shrink-0">Row {r.row}</span>
                <span className="text-foreground truncate">{r.name}</span>
                <span className="text-amber truncate">— {r.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<MigratedInvestor["status"], { label: string; cls: string }> = {
  PENDING:   { label: "Not invited", cls: "text-muted-foreground" },
  INVITED:   { label: "Invited",     cls: "text-amber" },
  CLAIMED:   { label: "Registered",  cls: "text-pine" },
  CANCELLED: { label: "Cancelled",   cls: "text-muted-foreground" },
};

function InvestorTable({
  investors, selected, onToggle, onCancel, cancelling,
}: {
  investors: MigratedInvestor[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onCancel: (id: string) => void;
  cancelling: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="py-2 w-8"></th>
            <th className="py-2 text-left font-medium">Investor</th>
            <th className="py-2 text-left font-medium">Email</th>
            <th className="py-2 text-left font-medium">Status</th>
            <th className="py-2 text-right font-medium w-10"></th>
          </tr>
        </thead>
        <tbody>
          {investors.map((i) => {
            const status = STATUS_LABEL[i.status];
            const selectable = i.status !== "CLAIMED" && i.status !== "CANCELLED" && !!i.email;
            return (
              <tr key={i.id} className="border-b border-border last:border-0">
                <td className="py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(i.id)}
                    onChange={() => onToggle(i.id)}
                    disabled={!selectable}
                    className="accent-pine disabled:opacity-30"
                    aria-label={`Select ${i.firstName} ${i.lastName}`}
                  />
                </td>
                <td className="py-2.5">
                  <div className="font-medium">{i.firstName} {i.lastName}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{i.phone}</div>
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {i.email ?? (
                    <span className="inline-flex items-center gap-1 text-amber">
                      <Mail className="w-3 h-3" /> none on file
                    </span>
                  )}
                </td>
                <td className="py-2.5">
                  <span className={`text-[11px] font-medium ${status.cls}`}>{status.label}</span>
                  {i.status === "INVITED" && i.invitedAt && (
                    <div className="text-[10px] text-muted-foreground">
                      {relativeTime(i.invitedAt)}
                      {i.inviteCount > 1 && ` · ${i.inviteCount} times`}
                    </div>
                  )}
                  {i.status === "CLAIMED" && i.claimedAt && (
                    <div className="text-[10px] text-muted-foreground">{relativeTime(i.claimedAt)}</div>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  {i.status !== "CLAIMED" && i.status !== "CANCELLED" && (
                    <button
                      onClick={() => onCancel(i.id)}
                      disabled={cancelling}
                      title="Cancel the invitation and revoke its link"
                      className="w-7 h-7 rounded-[3px] inline-flex items-center justify-center text-muted-foreground hover:bg-rose/10 hover:text-rose disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sheet parsing ────────────────────────────────────────────────────────────

/**
 * Read a CSV/TSV file into rows.
 *
 * Real exports contain quoted fields with commas and embedded quotes inside
 * them, so this is a proper character-by-character parse rather than a split
 * on commas — a client named "Banda, John" must not become two columns.
 */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }  // escaped quote
        else quoted = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

async function parseSheet(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    // Honest refusal rather than a broken import: a real .xlsx is a zip of XML
    // and cannot be read as text. Excel exports CSV in two clicks.
    throw new Error(
      "Excel files can't be read directly. In Excel choose File → Save As → CSV, then upload that.",
    );
  }

  const text = await file.text();
  const delimiter = name.endsWith(".tsv") || text.split("\n")[0].includes("\t") ? "\t" : ",";
  const grid = parseDelimited(text, delimiter);
  if (grid.length < 2) {
    throw new Error("That file has no rows beneath its heading line.");
  }

  const headers = grid[0].map((h) => h.trim());
  const normalised = headers.map((h) => h.toLowerCase().replace(/[_-]+/g, " ").trim());

  const mapping: Partial<Record<keyof MigrationRow, number>> = {};
  for (const col of COLUMNS) {
    const idx = normalised.findIndex((h) => col.aliases.includes(h));
    if (idx !== -1) mapping[col.field] = idx;
  }

  const mappedIdx = new Set(Object.values(mapping));
  const unmapped = headers.filter((_, i) => !mappedIdx.has(i)).filter(Boolean);

  const rows: MigrationRow[] = grid.slice(1).map((cells) => {
    const row: MigrationRow = {};
    for (const col of COLUMNS) {
      const idx = mapping[col.field];
      if (idx !== undefined) {
        const value = (cells[idx] ?? "").trim();
        if (value) row[col.field] = value as never;
      }
    }
    // Unrecognised columns ride along verbatim — an account number from the
    // old system is worth keeping even though Pine does nothing with it.
    const extra: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (!mappedIdx.has(i) && h && (cells[i] ?? "").trim()) extra[h] = cells[i].trim();
    });
    if (Object.keys(extra).length > 0) row.extra = extra;
    return row;
  });

  return { fileName: file.name, headers, mapping, rows, unmapped };
}

function downloadTemplate() {
  const csv =
    "First Name,Last Name,Phone,Email,Date of Birth,Gender\n" +
    "John,Banda,0991234567,john.banda@example.com,1988-04-12,M\n" +
    "Grace,Phiri,+265881234567,grace.phiri@example.com,1995-11-02,F\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "pine-investor-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}
