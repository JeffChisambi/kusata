import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  User, Lock, Bell, Shield, Eye, EyeOff, CheckCircle2,
  AlertTriangle, Smartphone, LogOut, ChevronRight, Save,
  Loader2, KeyRound, Copy, Check, RefreshCw, Monitor,
} from "lucide-react";
import { BrokerShell } from "@/components/broker-shell";
import { getCurrentUser } from "@/lib/auth";
import {
  useProfile, useUpdateProfile,
  useChangePassword,
  useSetupMfa, useConfirmMfa, useDisableMfa,
  useMySessions, useRevokeSession, useRevokeAllSessions,
  useNotifPrefs, useUpdateNotifPrefs,
  type NotifPrefs,
} from "@/hooks/useSettings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Pine Broker Portal" },
      { name: "description", content: "Manage your broker account settings, password, and preferences." },
    ],
  }),
  validateSearch: () => ({}),
  component: SettingsPage,
});

// ─── Shared primitives ────────────────────────────────────────────────────────

function SettingsCard({
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 py-3 border-b border-border last:border-0">
      <label className="text-sm font-medium text-foreground sm:w-40 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-9 px-3 rounded-[3px] bg-background border border-border text-sm focus:outline-none focus:border-pine/50 focus:ring-1 focus:ring-pine/20 transition-colors disabled:bg-muted/40 disabled:text-muted-foreground ${props.className ?? ""}`}
    />
  );
}

function SaveButton({
  loading = false,
  saved = false,
  label,
}: {
  loading?: boolean;
  saved?: boolean;
  label?: string;
}) {
  return (
    <button
      type="submit"
      className="flex items-center gap-2 h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 transition-colors disabled:opacity-60"
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : saved ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <Save className="w-4 h-4" />
      )}
      {saved ? "Saved" : loading ? "Saving…" : (label ?? "Save changes")}
    </button>
  );
}

function ApiErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-rose mt-3">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded-[3px] ${className}`} />;
}

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection() {
  // Prefer live API data; fall back to localStorage user so fields aren't blank
  const localUser = getCurrentUser();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [saved,     setSaved]     = useState(false);

  // Populate fields once data is available
  useEffect(() => {
    const src = profile ?? localUser;
    if (src) {
      setFirstName(src.firstName ?? "");
      setLastName(src.lastName ?? "");
      setPhone((src as any).phone ?? "");
    }
  }, [profile, localUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({ firstName, lastName, phone: phone || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // error shown via updateProfile.error
    }
  };

  const email = profile?.email ?? localUser?.email ?? "";
  const role  = profile?.role  ?? localUser?.role  ?? "BROKER";

  return (
    <SettingsCard title="Profile" description="Your public-facing broker profile information.">
      <form onSubmit={handleSave}>
        <FieldRow label="First name">
          {isLoading
            ? <Skeleton className="h-9" />
            : <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />}
        </FieldRow>
        <FieldRow label="Last name">
          {isLoading
            ? <Skeleton className="h-9" />
            : <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />}
        </FieldRow>
        <FieldRow label="Phone">
          {isLoading
            ? <Skeleton className="h-9" />
            : <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+265 999 000 000" type="tel" />}
        </FieldRow>
        <FieldRow label="Email address">
          <div className="flex items-center gap-2">
            <Input value={email} disabled />
            {email && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pine bg-pine/10 px-2 py-1 rounded-full whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            )}
          </div>
        </FieldRow>
        <FieldRow label="Role">
          <Input value={role.replace(/_/g, " ")} disabled />
        </FieldRow>

        {updateProfile.isError && (
          <ApiErrorBanner message={(updateProfile.error as any)?.message ?? "Failed to save profile."} />
        )}

        <div className="pt-4">
          <SaveButton loading={updateProfile.isPending} saved={saved} />
        </div>
      </form>
    </SettingsCard>
  );
}

// ─── Change password section ──────────────────────────────────────────────────

function PasswordSection() {
  const changePassword = useChangePassword();
  const [current,  setCurrent]  = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [localErr, setLocalErr] = useState("");

  const strength = (() => {
    if (!next) return 0;
    let s = 0;
    if (next.length >= 8) s++;
    if (/[A-Z]/.test(next)) s++;
    if (/[0-9]/.test(next)) s++;
    if (/[^a-zA-Z0-9]/.test(next)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-rose", "bg-amber", "bg-pine/60", "bg-pine"][strength];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr("");
    if (!current) { setLocalErr("Please enter your current password."); return; }
    if (next.length < 8) { setLocalErr("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setLocalErr("Passwords do not match."); return; }

    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      setSaved(true);
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // error shown via changePassword.error
    }
  };

  const errorMsg = localErr || (changePassword.isError ? ((changePassword.error as any)?.message ?? "Failed to change password.") : "");

  return (
    <SettingsCard title="Change Password" description="We recommend using a strong, unique password.">
      <form onSubmit={handleSave}>
        <FieldRow label="Current password">
          <div className="relative">
            <Input
              type={showCur ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Enter current password"
              className="pr-10"
            />
            <button type="button" onClick={() => setShowCur((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </FieldRow>
        <FieldRow label="New password">
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 8 characters"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowNext((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {next && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden flex gap-0.5">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className={`flex-1 h-full rounded-full transition-colors ${i <= strength ? strengthColor : "bg-muted"}`} />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground w-10">{strengthLabel}</span>
              </div>
            )}
          </div>
        </FieldRow>
        <FieldRow label="Confirm password">
          <div className="relative">
            <Input
              type={showConf ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              className={`pr-10 ${confirm && confirm !== next ? "border-rose-400 focus:border-rose-400" : ""}`}
            />
            <button type="button" onClick={() => setShowConf((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </FieldRow>

        {errorMsg && <ApiErrorBanner message={errorMsg} />}

        <div className="pt-4">
          <SaveButton loading={changePassword.isPending} saved={saved} />
        </div>
      </form>
    </SettingsCard>
  );
}

// ─── MFA section ─────────────────────────────────────────────────────────────

type MfaStep = "idle" | "setup" | "codes";

function MfaSection() {
  const { data: profile, isLoading } = useProfile();
  const setupMfa   = useSetupMfa();
  const confirmMfa = useConfirmMfa();
  const disableMfa = useDisableMfa();

  // step: idle → setup (shows QR) → codes (shows recovery codes)
  const [step,   setStep]   = useState<MfaStep>("idle");
  const [code,   setCode]   = useState("");
  const [copied, setCopied] = useState(false);

  const mfaEnabled = profile?.mfaEnabled ?? false;

  const handleEnable = async () => {
    try {
      await setupMfa.mutateAsync();
      setStep("setup");
    } catch { /* error displayed below */ }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    try {
      await confirmMfa.mutateAsync({ code });
      setCode("");
      setStep("codes");
    } catch { /* error displayed below */ }
  };

  const handleDisable = async () => {
    if (!confirm("Are you sure you want to disable two-factor authentication?")) return;
    try {
      await disableMfa.mutateAsync();
    } catch { /* error displayed below */ }
  };

  const copyRecoveryCodes = () => {
    const codes = confirmMfa.data?.recoveryCodes ?? [];
    navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setupError =
    setupMfa.isError   ? ((setupMfa.error as any)?.message   ?? "Failed to start MFA setup.")   :
    confirmMfa.isError ? ((confirmMfa.error as any)?.message ?? "Invalid code. Please try again.") :
    disableMfa.isError ? ((disableMfa.error as any)?.message ?? "Failed to disable 2FA.")       : "";

  const qrData = setupMfa.data;

  return (
    <SettingsCard title="Two-Factor Authentication" description="Add an extra layer of security to your account.">
      {isLoading ? (
        <Skeleton className="h-16" />
      ) : (
        <>
          {/* Status row */}
          <div className="flex items-start gap-4 py-2">
            <div className="w-9 h-9 rounded-[3px] bg-pine/10 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-pine" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Authenticator app</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {mfaEnabled
                  ? "Two-factor authentication is active. Your account is protected."
                  : "Enable TOTP-based two-factor authentication for extra security."}
              </div>
              {step === "idle" && (
                <div className="mt-3">
                  {mfaEnabled ? (
                    <button
                      onClick={handleDisable}
                      disabled={disableMfa.isPending}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-[3px] text-sm border border-rose/30 text-rose hover:bg-rose/5 transition-colors disabled:opacity-60"
                    >
                      {disableMfa.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Disable 2FA
                    </button>
                  ) : (
                    <button
                      onClick={handleEnable}
                      disabled={setupMfa.isPending}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-[3px] text-sm border border-pine/30 bg-pine text-primary-foreground hover:bg-pine/90 transition-colors disabled:opacity-60"
                    >
                      {setupMfa.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Enable 2FA
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${mfaEnabled ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"}`}>
              {mfaEnabled ? "Active" : "Off"}
            </span>
          </div>

          {/* Setup flow — QR code */}
          {step === "setup" && qrData && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.
              </p>
              <div className="flex gap-6 items-start flex-wrap">
                {/* QR image */}
                <div className="w-36 h-36 bg-white rounded-[3px] border border-border flex items-center justify-center shrink-0 overflow-hidden p-1.5">
                  {/* Use the server-generated QR data URL directly — never send
                      the OTP secret or otpauth URI to a third-party QR service. */}
                  <img
                    src={qrData.qrDataUrl}
                    alt="QR code"
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Manual entry */}
                <div className="flex-1 min-w-[200px] space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Manual entry key</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-muted px-2 py-1.5 rounded-[3px] break-all flex-1 select-all">
                        {qrData.secret}
                      </code>
                    </div>
                  </div>
                  {/* Confirm code */}
                  <form onSubmit={handleConfirm} className="space-y-2">
                    <div className="text-xs text-muted-foreground">Enter the 6-digit code from your app</div>
                    <div className="flex gap-2">
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000 000"
                        className="font-mono tracking-widest text-center max-w-[120px]"
                        maxLength={6}
                      />
                      <button
                        type="submit"
                        disabled={code.length !== 6 || confirmMfa.isPending}
                        className="flex items-center gap-1.5 h-9 px-3 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 transition-colors disabled:opacity-60"
                      >
                        {confirmMfa.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Verify
                      </button>
                    </div>
                    {confirmMfa.isError && <ApiErrorBanner message={(confirmMfa.error as any)?.message ?? "Invalid code."} />}
                  </form>
                </div>
              </div>
              {setupError && !confirmMfa.isError && <ApiErrorBanner message={setupError} />}
            </div>
          )}

          {/* Recovery codes */}
          {step === "codes" && (
            <div className="mt-4 pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-pine">
                <CheckCircle2 className="w-4 h-4" /> Two-factor authentication enabled
              </div>
              <p className="text-xs text-muted-foreground">
                Save these recovery codes somewhere safe. Each code can be used once if you lose access to your authenticator app.
              </p>
              <div className="bg-muted rounded-[3px] p-3 font-mono text-xs grid grid-cols-2 gap-1">
                {(confirmMfa.data?.recoveryCodes ?? []).map((c) => (
                  <span key={c} className="select-all">{c}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyRecoveryCodes}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-[3px] text-sm border border-border hover:bg-muted transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-pine" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy all"}
                </button>
                <button
                  onClick={() => setStep("idle")}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-[3px] text-sm bg-pine text-primary-foreground hover:bg-pine/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Top-level errors (disable / initial setup) */}
          {setupError && step === "idle" && <ApiErrorBanner message={setupError} />}
        </>
      )}
    </SettingsCard>
  );
}

// ─── Notification preferences ─────────────────────────────────────────────────

const NOTIF_DEFS: { key: keyof NotifPrefs; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "order_filled",  label: "Order filled",            description: "When a client order is executed",              icon: CheckCircle2 },
  { key: "order_failed",  label: "Order failed / rejected", description: "When an order cannot be filled",              icon: AlertTriangle },
  { key: "kyc_update",    label: "KYC status change",       description: "Approvals, rejections and requests",          icon: Shield },
  { key: "login_alert",   label: "New login detected",      description: "When your account is accessed from a new device", icon: Monitor },
  { key: "daily_summary", label: "Daily summary email",     description: "End-of-day volume and activity digest",       icon: Bell },
];

const DEFAULT_PREFS: NotifPrefs = {
  order_filled: true, order_failed: true, kyc_update: true, login_alert: true, daily_summary: false,
};

function NotificationsSection() {
  const { data: serverPrefs, isLoading } = useNotifPrefs();
  const updatePrefs = useUpdateNotifPrefs();

  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (serverPrefs) setPrefs(serverPrefs);
  }, [serverPrefs]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePrefs.mutateAsync(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* error displayed below */ }
  };

  return (
    <SettingsCard title="Notifications" description="Choose which events send you alerts.">
      <form onSubmit={handleSave}>
        <div className="space-y-0">
          {NOTIF_DEFS.map((n) => {
            const Icon = n.icon;
            return (
              <div key={n.key} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-[3px] bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{n.label}</div>
                  <div className="text-xs text-muted-foreground">{n.description}</div>
                </div>
                {isLoading ? (
                  <Skeleton className="w-10 h-5" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, [n.key]: !p[n.key] }))}
                    className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${prefs[n.key] ? "bg-pine" : "bg-muted"}`}
                    role="switch"
                    aria-checked={prefs[n.key]}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs[n.key] ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {updatePrefs.isError && (
          <ApiErrorBanner message={(updatePrefs.error as any)?.message ?? "Failed to save preferences."} />
        )}

        <div className="pt-4">
          <SaveButton loading={updatePrefs.isPending} saved={saved} />
        </div>
      </form>
    </SettingsCard>
  );
}

// ─── Sessions section ─────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "Active now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SessionsSection() {
  const { data: sessions, isLoading, refetch, isFetching } = useMySessions();
  const revokeOne = useRevokeSession();
  const revokeAll = useRevokeAllSessions();

  const handleRevoke = async (id: string) => {
    await revokeOne.mutateAsync(id);
  };

  const handleRevokeAll = async () => {
    if (!confirm("Sign out all other sessions? You'll stay logged in on this device.")) return;
    await revokeAll.mutateAsync();
  };

  const revokeError =
    revokeOne.isError ? ((revokeOne.error as any)?.message ?? "Failed to revoke session.") :
    revokeAll.isError ? ((revokeAll.error as any)?.message ?? "Failed to revoke sessions.") : "";

  return (
    <SettingsCard title="Active Sessions" description="Devices currently signed in to your account.">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          {sessions?.length ?? 0} active session{sessions?.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3 py-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : sessions && sessions.length > 0 ? (
        <ul className="space-y-0">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
              <div className="w-8 h-8 rounded-[3px] bg-muted flex items-center justify-center shrink-0">
                <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  {s.deviceInfo}
                  {s.current && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-pine/10 text-pine font-semibold">Current</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[s.location, s.ipAddress, relativeTime(s.lastSeenAt)].filter(Boolean).join(" · ")}
                </div>
              </div>
              {!s.current && (
                <button
                  onClick={() => handleRevoke(s.id)}
                  disabled={revokeOne.isPending}
                  className="flex items-center gap-1 text-xs text-rose hover:text-rose/80 transition-colors disabled:opacity-60 shrink-0"
                >
                  {revokeOne.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        /* Fallback: API not available — show informative placeholder */
        <div className="py-6 text-center text-sm text-muted-foreground">
          <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Session data unavailable
        </div>
      )}

      {revokeError && <ApiErrorBanner message={revokeError} />}

      {sessions && sessions.filter((s) => !s.current).length > 0 && (
        <div className="pt-4">
          <button
            onClick={handleRevokeAll}
            disabled={revokeAll.isPending}
            className="flex items-center gap-1.5 text-sm text-rose hover:text-rose/80 transition-colors disabled:opacity-60"
          >
            {revokeAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Sign out all other sessions
          </button>
        </div>
      )}
    </SettingsCard>
  );
}

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "profile",       label: "Profile",       icon: User },
  { key: "security",      label: "Security",      icon: Lock },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "sessions",      label: "Sessions",      icon: Smartphone },
] as const;
type TabKey = typeof TABS[number]["key"];

// ─── Page ─────────────────────────────────────────────────────────────────────

function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("profile");

  return (
    <BrokerShell activeLabel="Settings" title="Settings">
      <div className="pt-6" />

      <div className="flex gap-6 items-start">
        {/* Sidebar nav */}
        <div className="w-48 shrink-0">
          <nav className="rounded-[3px] bg-card border border-border overflow-hidden">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`w-full flex items-center justify-between gap-2.5 px-4 py-3 text-sm text-left border-b border-border last:border-0 transition-colors ${
                    isActive ? "bg-pine/6 text-pine font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-pine" : "text-muted-foreground"}`} />
                    {t.label}
                  </span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-pine shrink-0" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">
          {tab === "profile"       && <ProfileSection />}
          {tab === "security"      && (
            <>
              <PasswordSection />
              <MfaSection />
            </>
          )}
          {tab === "notifications" && <NotificationsSection />}
          {tab === "sessions"      && <SessionsSection />}
        </div>
      </div>
    </BrokerShell>
  );
}
