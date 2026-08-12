import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useActivateAccount } from "@/hooks/useBrokers";

export const Route = createFileRoute("/activate")({
  head: () => ({
    meta: [
      { title: "Activate Account — Pine Broker Admin" },
      { name: "description", content: "Activate your Pine broker administrator account with your invitation token." },
    ],
  }),
  component: ActivatePage,
});

const MIN_PASSWORD_LENGTH = 12;

function ActivatePage() {
  const navigate = useNavigate();
  const activate = useActivateAccount();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token.trim()) {
      setError("Please paste your invitation token.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    activate.mutate(
      { token: token.trim(), password },
      {
        onSuccess: () => {
          // Redirect to the sign-in page with a success indicator. The token
          // is never stored — it leaves memory with this component.
          navigate({ to: "/login", search: { activated: "1" } });
        },
        onError: (err: any) => {
          setError(err?.message || "Activation failed. The token may be invalid or expired.");
        },
      },
    );
  };

  return (
    <div className="flex h-screen">
      {/* ── Left: logo panel (mirrors /login) ── */}
      <div className="hidden lg:flex lg:w-[46%] items-center justify-center bg-white">
        <img
          src="/logo.png"
          alt="Pine"
          className="w-[55%] max-w-[336px] object-contain select-none"
          draggable={false}
        />
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex-1 flex items-center justify-center bg-[#45B369] px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-[400px] px-2 py-2">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src="/logo.png" alt="Pine" className="w-9 h-9 object-contain" />
            <div>
              <div className="font-bold text-[15px] leading-none text-white">Pine</div>
              <div className="text-[9px] tracking-[0.18em] text-white/70 mt-0.5">BROKER ADMIN</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-5 h-5 text-pine" />
            <h2 className="text-[22px] font-bold text-white">Activate your account</h2>
          </div>
          <p className="text-sm text-white/80">
            Paste the invitation token you received and choose a password. You'll set up
            two-factor authentication after your first sign-in.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-white mb-1.5">Invitation token</label>
              <textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={3}
                spellCheck={false}
                autoComplete="off"
                placeholder="Paste your one-time invitation token"
                className="w-full px-3.5 py-2.5 rounded-[2px] border border-border bg-card text-xs font-mono text-foreground placeholder:text-muted-foreground/60 placeholder:font-sans placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition resize-none break-all"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-white mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
              {password.length > 0 && password.length < MIN_PASSWORD_LENGTH && (
                <p className="text-[11px] text-white/80 mt-1">
                  {MIN_PASSWORD_LENGTH - password.length} more character{MIN_PASSWORD_LENGTH - password.length === 1 ? "" : "s"} needed.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-white mb-1.5">Confirm password</label>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat the password"
                className="w-full h-10 px-3.5 rounded-[2px] border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine/60 transition"
              />
              {confirm.length > 0 && confirm !== password && (
                <p className="text-[11px] text-white/80 mt-1">Passwords do not match yet.</p>
              )}
            </div>

            {error && (
              <p className="text-[13px] text-rose bg-rose/8 border border-rose/20 rounded-[2px] px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={activate.isPending}
              className="w-full h-10 rounded-[3px] bg-pine text-white text-sm font-semibold hover:bg-pine/90 active:bg-pine/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {activate.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Activating…
                </>
              ) : (
                "Activate account"
              )}
            </button>

            <p className="text-center text-[13px] text-white/80">
              Already activated?{" "}
              <Link to="/login" className="font-semibold text-white hover:underline">
                Sign in
              </Link>
            </p>
          </form>

          <p className="mt-8 text-center text-[12px] text-white/70">
            Authorised personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
