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
    <div className="flex h-screen">

      {/* ── Left: logo panel — white background, oversized mark, nothing else ── */}
      <div className="hidden lg:flex lg:w-[46%] items-center justify-center bg-white">
        <img
          src="/logo.png"
          alt="Pine"
          className="w-[55%] max-w-[336px] object-contain select-none"
          draggable={false}
        />
      </div>

      {/* ── Right: form panel — green background, transparent card ── */}
      <div className="flex-1 flex items-center justify-center bg-[#45B369] px-6 py-12">
        <div className="w-full max-w-[400px] px-2 py-2">

          {/* Mobile logo (shown only when left panel is hidden) */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src="/logo.png" alt="Pine" className="w-9 h-9 object-contain" />
            <div>
              <div className="font-bold text-[15px] leading-none text-white">Pine</div>
              <div className="text-[9px] tracking-[0.18em] text-white/70 mt-0.5">BROKER ADMIN</div>
            </div>
          </div>

          {/* ── Step: Credentials ── */}
          {step === 'credentials' && (
            <>
              <h2 className="text-[22px] font-bold text-white">Welcome back</h2>
              <p className="text-sm text-white/80 mt-1">Sign in to your admin account</p>

              <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-white mb-1.5">Email address</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@pine.mw"
                    className="w-full h-10 px-3.5 rounded-[2px] border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-medium text-white">Password</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-3.5 pr-10 rounded-[2px] border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-white/70 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-[13px] text-rose bg-rose/8 border border-rose/20 rounded-[2px] px-3.5 py-2.5">
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

            </>
          )}

          {/* ── Step: MFA Setup ── */}
          {step === 'mfa-setup' && setupData && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-5 h-5 text-pine" />
                <h2 className="text-[22px] font-bold text-white">Set up MFA</h2>
              </div>
              <p className="text-sm text-white/80">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>

              {setupData.qrDataUrl && (
                <div className="mt-6 flex justify-center">
                  <div className="bg-white p-4 rounded-[2px] shadow-sm border border-border">
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

              <div className="mt-4 p-4 bg-card border border-border rounded-[2px]">
                <p className="text-[11px] text-white/70 mb-2 font-medium">MANUAL ENTRY KEY</p>
                <code className="block text-xs font-mono bg-background p-2 rounded-sm break-all select-all border border-border">
                  {setupData.secret}
                </code>
                <p className="text-[11px] text-white/70 mt-3">
                  Can't scan? Open your authenticator app → Add account → Enter key manually → Use the key above
                </p>
              </div>

              <form onSubmit={handleMfaSetupConfirm} className="mt-6 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-white mb-1.5">
                    Enter the 6-digit code from your app
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full h-12 px-4 rounded-[2px] border border-border bg-card text-lg text-center font-mono tracking-[0.5em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-[13px] text-rose bg-rose/8 border border-rose/20 rounded-[2px] px-3.5 py-2.5">{error}</p>
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
                <h2 className="text-[22px] font-bold text-white">
                  {useRecovery ? "Recovery Code" : "Two-Factor Authentication"}
                </h2>
              </div>
              <p className="text-sm text-white/80">
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
                    className="w-full h-12 px-4 rounded-[2px] border border-border bg-card text-lg text-center font-mono tracking-[0.3em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-[13px] text-rose bg-rose/8 border border-rose/20 rounded-[2px] px-3.5 py-2.5">{error}</p>
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
                  className="w-full text-center text-[13px] text-white/80 hover:text-white transition-colors"
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
                <h2 className="text-[22px] font-bold text-white">MFA Verification</h2>
              </div>
              <p className="text-sm text-white/80">
                Save these recovery codes in a secure place. Each code can only be used once.
              </p>

              <div className="mt-6 p-4 bg-card border border-border rounded-[2px]">
                <div className="grid grid-cols-2 gap-2">
                  {recoveryCodes.map((code, i) => (
                    <code key={i} className="text-xs font-mono bg-background px-2 py-1.5 rounded-sm border border-border text-center select-all">
                      {code}
                    </code>
                  ))}
                </div>

                <button
                  onClick={handleCopyRecoveryCodes}
                  className="mt-4 w-full flex items-center justify-center gap-2 h-9 rounded-[3px] border border-border bg-background text-sm font-medium text-white hover:bg-accent hover:text-foreground transition-colors"
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

          <p className="mt-8 text-center text-[12px] text-white/70">
            Authorised personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
