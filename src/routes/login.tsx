import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, KeyRound, Smartphone, Copy, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { LoginResponse, MfaSetupResponse } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Pine Broker Admin" },
      { name: "description", content: "Sign in to the Pine broker administration portal." },
    ],
  }),
  component: LoginPage,
});

type Step = 'credentials' | 'mfa-setup' | 'mfa-verify' | 'recovery-codes';

function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyMfa, setupMfa, confirmMfaSetup, verifyRecoveryCode } = useAuth();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // MFA state
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const result = await login(email, password);
      setMfaToken(result.mfaToken);

      if (result.mfaRequired === 'setup') {
        // Need to set up MFA first
        const setup = await setupMfa(result.mfaToken);
        setSetupData(setup);
        setStep('mfa-setup');
      } else {
        setStep('mfa-verify');
      }
    } catch (err: any) {
      setError(err?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!mfaCode || mfaCode.length < 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      if (useRecovery) {
        await verifyRecoveryCode(mfaToken, mfaCode);
      } else {
        await verifyMfa(mfaToken, mfaCode);
      }
      const user = getCurrentUser();
      navigate({ to: user?.role === 'BROKER' ? '/broker' : '/' });
    } catch (err: any) {
      setError(err?.message || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSetupConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!mfaCode || mfaCode.length < 6) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    setLoading(true);
    try {
      const result = await confirmMfaSetup(mfaToken, mfaCode);
      setRecoveryCodes(result.recoveryCodes);
      setStep('recovery-codes');
    } catch (err: any) {
      setError(err?.message || "Invalid code. Please check your authenticator app.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleFinish = () => {
    const user = getCurrentUser();
    navigate({ to: user?.role === 'BROKER' ? '/broker' : '/' });
  };

  return (
    <div className="flex h-screen bg-background">

      {/* ── Left: brand panel ── */}
      <div className="hidden lg:flex lg:w-[46%] flex-col bg-[#45B369] relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute bottom-[-80px] right-[-80px] w-[380px] h-[380px] rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03]" />

        <div className="relative z-10 flex flex-col h-full px-14 py-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <img src="/logo.png" alt="Pine" className="w-6 h-6 object-contain brightness-0 invert" />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-none">Pine</div>
              <div className="text-white/60 text-[9px] tracking-[0.2em] mt-0.5">BROKER ADMIN</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-white text-[2.4rem] font-bold leading-tight tracking-tight">
              The control tower<br />for your brokerage.
            </h1>
            <p className="text-white/70 text-[15px] mt-4 leading-relaxed max-w-xs">
              Manage users, trades, compliance, and operations — all from one secure platform.
            </p>

            <div className="flex flex-wrap gap-2 mt-8">
              {["KYC Verification", "Trade Monitoring", "AML Alerts", "Ledger & Reporting"].map((f) => (
                <span
                  key={f}
                  className="text-[12px] font-medium text-white/90 bg-white/10 border border-white/15 px-3 py-1.5 rounded-full"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-white/50 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secured with TOTP MFA · Admin access only
          </div>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <img src="/logo.png" alt="Pine" className="w-8 h-8 object-contain" />
            <div>
              <div className="font-bold text-[15px] leading-none">Pine</div>
              <div className="text-[9px] tracking-[0.18em] text-muted-foreground mt-0.5">BROKER ADMIN</div>
            </div>
          </div>

          {/* ── Step: Credentials ── */}
          {step === 'credentials' && (
            <>
              <h2 className="text-[22px] font-bold text-foreground">Welcome back</h2>
              <p className="text-sm text-muted-foreground mt-1">Sign in to your admin account</p>

              <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-foreground mb-1.5">Email address</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@pine.mw"
                    className="w-full h-10 px-3.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-medium text-foreground">Password</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-3.5 pr-10 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-[13px] text-rose bg-rose/8 border border-rose/20 rounded-lg px-3.5 py-2.5">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-[3px] bg-pine text-white text-sm font-semibold hover:bg-pine/90 active:bg-pine/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>

              {/* ── Dev-only: quick login buttons (no MFA) ── */}
              {import.meta.env.DEV && (
                <div className="mt-6 pt-5 border-t border-dashed border-border">
                  <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-3">
                    Dev Quick Login
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem('pine_admin_access_token', 'dev-admin-token');
                        localStorage.setItem('pine_admin_refresh_token', 'dev-admin-refresh');
                        localStorage.setItem('pine_admin_user', JSON.stringify({
                          id: 'dev-admin-001',
                          email: 'admin@pine.mw',
                          firstName: 'Pine',
                          lastName: 'Admin',
                          role: 'SUPER_ADMIN',
                        }));
                        navigate({ to: '/' });
                      }}
                      className="flex-1 h-9 rounded-[3px] border border-amber/30 bg-amber/10 text-amber text-xs font-semibold hover:bg-amber/20 transition-colors"
                    >
                      🔑 Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem('pine_admin_access_token', 'dev-broker-token');
                        localStorage.setItem('pine_admin_refresh_token', 'dev-broker-refresh');
                        localStorage.setItem('pine_admin_user', JSON.stringify({
                          id: 'dev-broker-001',
                          email: 'broker@pine.mw',
                          firstName: 'Pine',
                          lastName: 'Broker',
                          role: 'BROKER',
                        }));
                        navigate({ to: '/broker' });
                      }}
                      className="flex-1 h-9 rounded-[3px] border border-sky/30 bg-sky/10 text-sky text-xs font-semibold hover:bg-sky/20 transition-colors"
                    >
                      🔑 Broker
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step: MFA Setup ── */}
          {step === 'mfa-setup' && setupData && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-5 h-5 text-pine" />
                <h2 className="text-[22px] font-bold text-foreground">Set up MFA</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>

              {setupData.qrDataUrl && (
                <div className="mt-6 flex justify-center">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-border">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrDataUrl)}`}
                      alt="MFA QR Code"
                      width={200}
                      height={200}
                      className="block"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 bg-card border border-border rounded-xl">
                <p className="text-[11px] text-muted-foreground mb-2 font-medium">MANUAL ENTRY KEY</p>
                <code className="block text-xs font-mono bg-background p-2 rounded break-all select-all border border-border">
                  {setupData.secret}
                </code>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Can't scan? Open your authenticator app → Add account → Enter key manually → Use the key above
                </p>
              </div>

              <form onSubmit={handleMfaSetupConfirm} className="mt-6 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-foreground mb-1.5">
                    Enter the 6-digit code from your app
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full h-12 px-4 rounded-lg border border-border bg-card text-lg text-center font-mono tracking-[0.5em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-[13px] text-rose bg-rose/8 border border-rose/20 rounded-lg px-3.5 py-2.5">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || mfaCode.length < 6}
                  className="w-full h-10 rounded-[3px] bg-pine text-white text-sm font-semibold hover:bg-pine/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</>
                  ) : (
                    "Verify & Enable MFA"
                  )}
                </button>
              </form>
            </>
          )}

          {/* ── Step: MFA Verify ── */}
          {step === 'mfa-verify' && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-5 h-5 text-pine" />
                <h2 className="text-[22px] font-bold text-foreground">
                  {useRecovery ? "Recovery Code" : "Two-Factor Authentication"}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {useRecovery
                  ? "Enter one of your recovery codes"
                  : "Enter the 6-digit code from your authenticator app"
                }
              </p>

              <form onSubmit={handleMfaVerify} className="mt-6 space-y-4">
                <div>
                  <input
                    type="text"
                    inputMode={useRecovery ? "text" : "numeric"}
                    maxLength={useRecovery ? 9 : 6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
                    placeholder={useRecovery ? "XXXX-XXXX" : "000000"}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-card text-lg text-center font-mono tracking-[0.3em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-[13px] text-rose bg-rose/8 border border-rose/20 rounded-lg px-3.5 py-2.5">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || mfaCode.length < (useRecovery ? 9 : 6)}
                  className="w-full h-10 rounded-[3px] bg-pine text-white text-sm font-semibold hover:bg-pine/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</>
                  ) : (
                    "Verify"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setUseRecovery(!useRecovery); setMfaCode(""); setError(""); }}
                  className="w-full text-center text-[13px] text-pine hover:text-pine/80 transition-colors"
                >
                  {useRecovery ? "Use authenticator app instead" : "Use a recovery code"}
                </button>
              </form>
            </>
          )}

          {/* ── Step: Recovery Codes ── */}
          {step === 'recovery-codes' && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-pine" />
                <h2 className="text-[22px] font-bold text-foreground">MFA Enabled!</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Save these recovery codes in a secure place. Each code can only be used once.
              </p>

              <div className="mt-6 p-4 bg-card border border-border rounded-xl">
                <div className="grid grid-cols-2 gap-2">
                  {recoveryCodes.map((code, i) => (
                    <code key={i} className="text-xs font-mono bg-background px-2 py-1.5 rounded border border-border text-center select-all">
                      {code}
                    </code>
                  ))}
                </div>

                <button
                  onClick={handleCopyRecoveryCodes}
                  className="mt-4 w-full flex items-center justify-center gap-2 h-9 rounded-[3px] border border-border bg-background text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  {copiedCodes ? <><CheckCircle2 className="w-3.5 h-3.5 text-pine" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy all codes</>}
                </button>
              </div>

              <button
                onClick={handleFinish}
                className="w-full h-10 rounded-[3px] bg-pine text-white text-sm font-semibold hover:bg-pine/90 transition-colors mt-6 flex items-center justify-center"
              >
                Continue to Dashboard
              </button>
            </>
          )}

          <p className="mt-8 text-center text-[12px] text-muted-foreground">
            Authorised personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
