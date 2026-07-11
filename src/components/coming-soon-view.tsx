import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/** Floating diamond fragments that orbit the main pine cone */
const FRAGS: {
  size: number; top: string; left: string;
  dur: string; delay: string; op: number; color: string;
}[] = [
  // ── top cluster ──
  { size: 22, top: "12%", left: "30%",  dur: "4.4s", delay: "0s",    op: 0.22, color: "#45B369" },
  { size: 12, top: "7%",  left: "47%",  dur: "3.6s", delay: "0.9s",  op: 0.16, color: "#7DD99A" },
  { size: 16, top: "10%", left: "63%",  dur: "5.0s", delay: "0.4s",  op: 0.20, color: "#45B369" },
  // ── right cluster ──
  { size: 10, top: "28%", left: "74%",  dur: "4.1s", delay: "1.2s",  op: 0.18, color: "#7DD99A" },
  { size: 20, top: "44%", left: "78%",  dur: "3.8s", delay: "0.3s",  op: 0.14, color: "#45B369" },
  { size: 14, top: "60%", left: "72%",  dur: "4.7s", delay: "0.7s",  op: 0.20, color: "#7DD99A" },
  // ── bottom cluster ──
  { size: 18, top: "76%", left: "58%",  dur: "5.2s", delay: "0.1s",  op: 0.18, color: "#45B369" },
  { size: 10, top: "80%", left: "42%",  dur: "3.9s", delay: "1.0s",  op: 0.14, color: "#7DD99A" },
  { size: 24, top: "74%", left: "28%",  dur: "4.3s", delay: "0.5s",  op: 0.16, color: "#45B369" },
  // ── left cluster ──
  { size: 14, top: "58%", left: "18%",  dur: "3.7s", delay: "0.8s",  op: 0.20, color: "#7DD99A" },
  { size: 18, top: "40%", left: "14%",  dur: "4.9s", delay: "0.2s",  op: 0.18, color: "#45B369" },
  { size: 10, top: "24%", left: "22%",  dur: "4.0s", delay: "1.3s",  op: 0.14, color: "#7DD99A" },
  // ── far corners (very faint) ──
  { size: 8,  top: "5%",  left: "82%",  dur: "6.0s", delay: "0.6s",  op: 0.10, color: "#45B369" },
  { size: 8,  top: "88%", left: "18%",  dur: "5.5s", delay: "1.4s",  op: 0.10, color: "#7DD99A" },
];

export function ComingSoonView() {
  return (
    <div className="min-h-screen bg-background flex flex-col select-none">

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes pine-float {
          0%, 100% { transform: rotate(45deg) translateY(0px)  scale(1);    }
          50%       { transform: rotate(45deg) translateY(-14px) scale(1.08); }
        }
        @keyframes pine-breathe {
          0%, 100% { transform: scale(1)    translateY(0px); opacity: 0.95; filter: drop-shadow(0  0px  0px rgba(69,179,105,0));   }
          50%       { transform: scale(1.06) translateY(-8px); opacity: 1;    filter: drop-shadow(0 12px 28px rgba(69,179,105,0.28)); }
        }
        @keyframes pine-scan {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>

      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-8 py-5 border-b border-border shrink-0">
        <img src="/logo.png" alt="Pine" className="w-7 h-7 object-contain" />
        <div>
          <div className="text-[15px] font-bold leading-none">Pine</div>
          <div className="text-[9px] tracking-[0.18em] text-muted-foreground mt-0.5">BROKER ADMIN</div>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden px-6 py-16">

        {/* Floating fragments */}
        {FRAGS.map((f, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: f.top,
              left: f.left,
              width: f.size,
              height: f.size,
              background: f.color,
              opacity: f.op,
              borderRadius: "3px",
              animation: `pine-float ${f.dur} ${f.delay} ease-in-out infinite`,
            }}
          />
        ))}

        {/* Centre content */}
        <div className="relative z-10 text-center max-w-sm">

          {/* Animated logo */}
          <div style={{ animation: "pine-breathe 4s ease-in-out infinite", display: "inline-block" }}>
            <img
              src="/logo.png"
              alt="Pine"
              className="w-36 h-36 object-contain mx-auto"
            />
          </div>

          {/* Headline with shimmer */}
          <h1
            className="mt-8 text-[2.8rem] font-extrabold tracking-tight text-foreground leading-none"
            style={{
              background: "linear-gradient(90deg, #45B369 0%, #2d8a4e 30%, #45B369 50%, #7DD99A 70%, #45B369 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "pine-scan 3.5s linear infinite",
            }}
          >
            Coming Soon
          </h1>

          <p className="mt-3 text-[17px] font-medium text-foreground/80 leading-snug">
            This branch is still growing.
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
            We're cultivating this section of the platform. It will be ready before the next market session.
          </p>

          {/* Subtle divider dots */}
          <div className="flex items-center justify-center gap-1.5 mt-6">
            {[0, 0.4, 0.8].map((d, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-pine"
                style={{ opacity: 0.5, animation: `pine-breathe ${1.2 + i * 0.3}s ${d}s ease-in-out infinite` }}
              />
            ))}
          </div>

          {/* Back button */}
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pine/8 border border-pine/20 text-pine text-sm font-semibold hover:bg-pine/14 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </Link>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="shrink-0 text-center pb-6 text-[11px] text-muted-foreground/50">
        Pine Broker Admin · Admin access only
      </footer>
    </div>
  );
}
