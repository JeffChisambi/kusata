/**
 * First sign-in for staff on a temporary password.
 *
 * The root guard sends anyone with mustChangePassword here and nowhere else,
 * so the temporary password from the invitation email is good for exactly
 * one thing: choosing a real one. Once that succeeds the stored user is
 * updated and they continue to whichever section they may open first.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { useChangePassword } from "@/hooks/useSettings";
import { getCurrentUser, updateStoredUser } from "@/lib/auth";
import { homePathFor } from "@/lib/sections";

export const Route = createFileRoute("/change-password")({
  head: () => ({
    meta: [{ title: "Choose your password — Pine" }],
  }),
  component: ChangePasswordPage,
});

const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;

function ChangePasswordPage() {
  const navigate = useNavigate();
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const problem =
    next && !POLICY.test(next)
      ? "At least 8 characters, with an upper-case letter, a lower-case letter, a number and a symbol."
      : confirm && confirm !== next
        ? "The two passwords do not match."
        : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!current || !next || problem) return;
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      updateStoredUser({ mustChangePassword: false });
      navigate({ to: homePathFor(getCurrentUser()) as never });
    } catch (err: any) {
      setError(err?.message ?? "The password could not be changed.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-[4px] bg-card border border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-pine/10 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-pine" />
          </span>
          <div>
            <h1 className="text-base font-semibold">Choose your password</h1>
            <p className="text-xs text-muted-foreground">
              The temporary password from your invitation only works once. Set your own to continue.
            </p>
          </div>
        </div>

        <Field label="Temporary password" value={current} onChange={setCurrent} autoFocus />
        <Field label="New password" value={next} onChange={setNext} />
        <Field label="Confirm new password" value={confirm} onChange={setConfirm} />

        {(problem || error) && (
          <p className="text-[13px] text-rose">{problem ?? error}</p>
        )}

        <button
          type="submit"
          disabled={change.isPending || !current || !next || !!problem || confirm !== next}
          className="w-full h-10 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {change.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save and continue
        </button>
      </form>
    </div>
  );
}

function Field({
  label, value, onChange, autoFocus,
}: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete={label.startsWith("Temporary") ? "current-password" : "new-password"}
        className="mt-1.5 w-full h-10 px-3 rounded-[3px] border border-border bg-transparent text-sm focus:outline-none focus:border-pine/40"
      />
    </label>
  );
}
