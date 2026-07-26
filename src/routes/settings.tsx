import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  User, Lock, Bell, Shield, Eye, EyeOff, CheckCircle2,
  AlertTriangle, Smartphone, LogOut, Mail, Phone,
  ChevronRight, Save,
} from "lucide-react";
import { BrokerShell } from "@/components/broker-shell";
import { getCurrentUser } from "@/lib/auth";

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

// ─── Small shared components ──────────────────────────────────────────────────

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

function SaveButton({ loading = false, saved = false }: { loading?: boolean; saved?: boolean }) {
  return (
    <button
      type="submit"
      className="flex items-center gap-2 h-9 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 transition-colors disabled:opacity-60"
      disabled={loading}
    >
      {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
      {saved ? "Saved" : loading ? "Saving…" : "Save changes"}
    </button>
  );
}

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const user = getCurrentUser();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName,  setLastName]  = useState(user?.lastName ?? "");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <SettingsCard title="Profile" description="Your public-facing broker profile information.">
      <form onSubmit={handleSave}>
        <FieldRow label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </FieldRow>
        <FieldRow label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </FieldRow>
        <FieldRow label="Email address">
          <div className="flex items-center gap-2">
            <Input value={user?.email ?? "—"} disabled />
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pine bg-pine/10 px-2 py-1 rounded-full whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3" /> Verified
            </span>
          </div>
        </FieldRow>
        <FieldRow label="Role">
          <Input value={user?.role?.replace(/_/g, " ") ?? "BROKER"} disabled />
        </FieldRow>
        <div className="pt-4">
          <SaveButton saved={saved} />
        </div>
      </form>
    </SettingsCard>
  );
}

// ─── Change password section ──────────────────────────────────────────────────

function PasswordSection() {
  const [current,  setCurrent]  = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!current) { setError("Please enter your current password."); return; }
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setError("Passwords do not match."); return; }
    setSaved(true);
    setCurrent(""); setNext(""); setConfirm("");
    setTimeout(() => setSaved(false), 2500);
  };

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

        {error && (
          <div className="flex items-center gap-2 text-[13px] text-rose mt-3">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="pt-4">
          <SaveButton saved={saved} />
        </div>
      </form>
    </SettingsCard>
  );
}

// ─── MFA section ─────────────────────────────────────────────────────────────

function MfaSection() {
  const [mfaEnabled, setMfaEnabled] = useState(true);

  return (
    <SettingsCard title="Two-Factor Authentication" description="Add an extra layer of security to your account.">
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
          <div className="mt-3">
            <button
              onClick={() => setMfaEnabled((v) => !v)}
              className={`h-8 px-3 rounded-[3px] text-sm border transition-colors ${
                mfaEnabled
                  ? "border-rose/30 text-rose hover:bg-rose/5"
                  : "border-pine/30 bg-pine text-primary-foreground hover:bg-pine/90"
              }`}
            >
              {mfaEnabled ? "Disable 2FA" : "Enable 2FA"}
            </button>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${mfaEnabled ? "bg-pine/10 text-pine" : "bg-muted text-muted-foreground"}`}>
          {mfaEnabled ? "Active" : "Off"}
        </span>
      </div>
    </SettingsCard>
  );
}

// ─── Notification preferences ─────────────────────────────────────────────────

type NotifKey = "order_filled" | "order_failed" | "kyc_update" | "login_alert" | "daily_summary";

const NOTIFS: { key: NotifKey; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "order_filled",    label: "Order filled",           description: "When a client order is executed",              icon: CheckCircle2 },
  { key: "order_failed",    label: "Order failed / rejected", description: "When an order cannot be filled",              icon: AlertTriangle },
  { key: "kyc_update",      label: "KYC status change",       description: "Approvals, rejections and requests",          icon: Shield },
  { key: "login_alert",     label: "New login detected",      description: "When your account is accessed from a new device", icon: Smartphone },
  { key: "daily_summary",   label: "Daily summary email",     description: "End-of-day volume and activity digest",       icon: Mail },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<NotifKey, boolean>>({
    order_filled: true, order_failed: true, kyc_update: true, login_alert: true, daily_summary: false,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <SettingsCard title="Notifications" description="Choose which events send you alerts.">
      <form onSubmit={handleSave}>
        <div className="space-y-0">
          {NOTIFS.map((n) => {
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
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, [n.key]: !p[n.key] }))}
                  className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${prefs[n.key] ? "bg-pine" : "bg-muted"}`}
                  role="switch"
                  aria-checked={prefs[n.key]}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs[n.key] ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
            );
          })}
        </div>
        <div className="pt-4">
          <SaveButton saved={saved} />
        </div>
      </form>
    </SettingsCard>
  );
}

// ─── Sessions section ─────────────────────────────────────────────────────────

function SessionsSection() {
  const sessions = [
    { device: "Chrome · macOS", location: "Lilongwe, MW", ip: "196.44.128.9", last: "Active now", current: true },
    { device: "iPhone 15 · iOS 18.2", location: "Lilongwe, MW", ip: "196.44.128.9", last: "2h ago", current: false },
  ];

  return (
    <SettingsCard title="Active Sessions" description="Devices currently signed in to your account.">
      <ul className="space-y-2">
        {sessions.map((s, i) => (
          <li key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
            <div className="w-8 h-8 rounded-[3px] bg-muted flex items-center justify-center shrink-0">
              <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-2">
                {s.device}
                {s.current && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-pine/10 text-pine font-semibold">Current</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{s.location} · {s.ip} · {s.last}</div>
            </div>
            {!s.current && (
              <button className="flex items-center gap-1 text-xs text-rose hover:text-rose/80 transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="pt-4">
        <button className="flex items-center gap-1.5 text-sm text-rose hover:text-rose/80 transition-colors">
          <LogOut className="w-4 h-4" /> Sign out all other sessions
        </button>
      </div>
    </SettingsCard>
  );
}

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "profile",       label: "Profile",      icon: User },
  { key: "security",      label: "Security",     icon: Lock },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "sessions",      label: "Sessions",     icon: Smartphone },
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
