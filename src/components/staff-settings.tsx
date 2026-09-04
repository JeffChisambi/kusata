/**
 * Settings → Staff.
 *
 * A broker administrator invites colleagues and decides, checkbox by
 * checkbox, which sections of the dashboard each may use. The list below is
 * exactly the sidebar: what is unticked is what the person will not see, and
 * - because the API enforces the same list - what they cannot reach by URL.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, Plus, UserX, UserCheck, X } from "lucide-react";
import {
  useStaffList, useInviteStaff, useUpdateStaffSections, useSetStaffActive, useResetStaffPassword,
  type StaffMember,
} from "@/hooks/useStaff";
import { DASHBOARD_SECTIONS, type DashboardSection } from "@/lib/sections";
import { relativeTime } from "@/lib/relative-time";

export function StaffSection() {
  const { data, isLoading, error } = useStaffList();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [notice, setNotice] = useState<{ text: string; secret?: string } | null>(null);

  const forbidden = (error as any)?.status === 403;
  const staff = data?.staff ?? [];

  if (forbidden) {
    return (
      <Card title="Staff">
        <p className="text-sm text-muted-foreground">
          Only a broker administrator can manage staff accounts.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card
        title="Staff"
        description="Colleagues who can sign in to this dashboard. Each sees only the sections you grant - and the API refuses everything else, so an unticked section cannot be reached by typing its address."
        action={
          <button
            type="button"
            onClick={() => setInviting(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90"
          >
            <Plus className="w-4 h-4" /> Invite staff member
          </button>
        }
      >
        {notice && <Notice notice={notice} onDismiss={() => setNotice(null)} />}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No staff yet. Invite a colleague and choose what they can see.
          </p>
        ) : (
          <StaffTable staff={staff} onEdit={setEditing} onNotice={setNotice} />
        )}
      </Card>

      {inviting && (
        <InviteDialog
          onClose={() => setInviting(false)}
          onDone={(n) => { setInviting(false); setNotice(n); }}
        />
      )}
      {editing && (
        <EditSectionsDialog
          member={editing}
          onClose={() => setEditing(null)}
          onDone={(n) => { setEditing(null); setNotice(n); }}
        />
      )}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function StaffTable({
  staff, onEdit, onNotice,
}: {
  staff: StaffMember[];
  onEdit: (m: StaffMember) => void;
  onNotice: (n: { text: string; secret?: string }) => void;
}) {
  const setActive = useSetStaffActive();
  const reset = useResetStaffPassword();
  const busy = setActive.isPending || reset.isPending;

  const labelFor = (key: DashboardSection) => DASHBOARD_SECTIONS.find((s) => s.key === key)?.label ?? key;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="py-2 text-left font-medium">Person</th>
            <th className="py-2 text-left font-medium">Can access</th>
            <th className="py-2 text-left font-medium">Status</th>
            <th className="py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((m) => (
            <tr key={m.id} className="border-b border-border last:border-0 align-top">
              <td className="py-3 pr-4">
                <div className="font-medium">{m.firstName} {m.lastName}</div>
                <div className="text-[11px] text-muted-foreground">{m.email}</div>
              </td>
              <td className="py-3 pr-4">
                <div className="flex flex-wrap gap-1">
                  {m.sections.map((s) => (
                    <span key={s} className="text-[11px] px-1.5 py-0.5 rounded-[3px] border border-border text-foreground">
                      {labelFor(s)}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(m)}
                  className="mt-1.5 text-[11px] text-pine hover:underline"
                >
                  Change access
                </button>
              </td>
              <td className="py-3 pr-4">
                {!m.isActive ? (
                  <span className="text-[11px] font-medium text-muted-foreground">Deactivated</span>
                ) : m.mustChangePassword ? (
                  <span className="text-[11px] font-medium text-amber">Invited · not yet signed in</span>
                ) : (
                  <span className="text-[11px] font-medium text-pine">Active</span>
                )}
                {m.lastSignInAt && (
                  <div className="text-[10px] text-muted-foreground">last sign-in {relativeTime(m.lastSignInAt)}</div>
                )}
              </td>
              <td className="py-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  disabled={busy || !m.isActive}
                  title="Email a new temporary password"
                  onClick={async () => {
                    try {
                      const r = await reset.mutateAsync(m.id);
                      onNotice(r.emailSent
                        ? { text: `A new temporary password was emailed to ${m.email}.` }
                        : { text: `The email could not be sent. Give ${m.firstName} this temporary password - it is shown once.`, secret: r.temporaryPassword });
                    } catch (e: any) {
                      onNotice({ text: e?.message ?? "The password could not be reset." });
                    }
                  }}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-[3px] text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  <KeyRound className="w-3 h-3" /> Reset password
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await setActive.mutateAsync({ id: m.id, isActive: !m.isActive });
                      onNotice({ text: m.isActive ? `${m.firstName} can no longer sign in.` : `${m.firstName} can sign in again.` });
                    } catch (e: any) {
                      onNotice({ text: e?.message ?? "That change could not be saved." });
                    }
                  }}
                  className={`ml-1 inline-flex items-center gap-1 h-7 px-2 rounded-[3px] text-[11px] disabled:opacity-40 ${
                    m.isActive ? "text-rose hover:bg-rose/10" : "text-pine hover:bg-pine/10"
                  }`}
                >
                  {m.isActive ? <><UserX className="w-3 h-3" /> Deactivate</> : <><UserCheck className="w-3 h-3" /> Reactivate</>}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Section picker ───────────────────────────────────────────────────────────

function SectionPicker({
  value, onChange,
}: { value: Set<DashboardSection>; onChange: (next: Set<DashboardSection>) => void }) {
  const toggle = (key: DashboardSection) => {
    const next = new Set(value);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };
  const all = value.size === DASHBOARD_SECTIONS.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground">Sections they can use</span>
        <button
          type="button"
          onClick={() => onChange(all ? new Set() : new Set(DASHBOARD_SECTIONS.map((s) => s.key)))}
          className="text-[11px] text-pine hover:underline"
        >
          {all ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {DASHBOARD_SECTIONS.map((s) => (
          <label
            key={s.key}
            className={`flex items-start gap-2.5 px-3 py-2 rounded-[3px] border cursor-pointer transition-colors ${
              value.has(s.key) ? "border-pine/40 bg-pine/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <input
              type="checkbox"
              checked={value.has(s.key)}
              onChange={() => toggle(s.key)}
              className="accent-pine mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{s.label}</span>
              <span className="block text-[11px] text-muted-foreground">{s.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function InviteDialog({
  onClose, onDone,
}: { onClose: () => void; onDone: (n: { text: string; secret?: string }) => void }) {
  const invite = useInviteStaff();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [sections, setSections] = useState<Set<DashboardSection>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const valid = firstName.trim() && lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && sections.size > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await invite.mutateAsync({
        firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), sections: [...sections],
      });
      onDone(r.emailSent
        ? { text: `${firstName} has been emailed a temporary password and a link to sign in.` }
        : { text: `The account was created but the email could not be sent. Give ${firstName} this temporary password - it is shown once and cannot be retrieved.`, secret: r.temporaryPassword });
    } catch (err: any) {
      setError(err?.message ?? "The invitation could not be sent.");
    }
  };

  return (
    <Dialog title="Invite a staff member" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={setFirstName} autoFocus />
          <Input label="Last name" value={lastName} onChange={setLastName} />
        </div>
        <Input label="Email address" value={email} onChange={setEmail} type="email" hint="They sign in with this. A temporary password is emailed to it." />
        <SectionPicker value={sections} onChange={setSections} />
        {error && <p className="text-[13px] text-rose flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-9 px-3 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
          <button
            type="submit"
            disabled={!valid || invite.isPending}
            className="h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-50 flex items-center gap-2"
          >
            {invite.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Send invitation
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function EditSectionsDialog({
  member, onClose, onDone,
}: { member: StaffMember; onClose: () => void; onDone: (n: { text: string }) => void }) {
  const update = useUpdateStaffSections();
  const [sections, setSections] = useState<Set<DashboardSection>>(new Set(member.sections));
  const [error, setError] = useState<string | null>(null);
  const changed = useMemo(
    () => sections.size !== member.sections.length || member.sections.some((s) => !sections.has(s)),
    [sections, member.sections],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({ id: member.id, sections: [...sections] });
      onDone({ text: `${member.firstName}'s access has been updated. It applies within a few seconds.` });
    } catch (err: any) {
      setError(err?.message ?? "The change could not be saved.");
    }
  };

  return (
    <Dialog title={`Access for ${member.firstName} ${member.lastName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <SectionPicker value={sections} onChange={setSections} />
        {error && <p className="text-[13px] text-rose flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-9 px-3 rounded-[3px] border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
          <button
            type="submit"
            disabled={!changed || sections.size === 0 || update.isPending}
            className="h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-50 flex items-center gap-2"
          >
            {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save access
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Notice({ notice, onDismiss }: { notice: { text: string; secret?: string }; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-4 rounded-[3px] border border-border bg-muted/30 px-4 py-3 flex items-start gap-3">
      <CheckCircle2 className="w-4 h-4 text-pine mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 text-[13px]">
        <p>{notice.text}</p>
        {notice.secret && (
          <div className="mt-2 flex items-center gap-2">
            <code className="px-2 py-1 rounded-[3px] bg-card border border-border font-mono text-sm tracking-wider">{notice.secret}</code>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(notice.secret!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="inline-flex items-center gap-1 text-[11px] text-pine hover:underline"
            >
              <Copy className="w-3 h-3" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
      <button onClick={onDismiss} className="w-6 h-6 rounded-[3px] hover:bg-muted flex items-center justify-center text-muted-foreground shrink-0" aria-label="Dismiss">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-lg rounded-[4px] bg-card border border-border p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-[3px] hover:bg-muted/60 flex items-center justify-center text-muted-foreground" aria-label="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, type = "text", hint, autoFocus,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="mt-1.5 w-full h-9 px-3 rounded-[3px] border border-border bg-transparent text-sm focus:outline-none focus:border-pine/40"
      />
      {hint && <span className="block mt-1 text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Card({
  title, description, action, children,
}: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[3px] bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-sm">{title}</div>
          {description && <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
