import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { Card } from "@/components/broker-shell";
import { requireSuperAdmin } from "@/lib/auth";
import {
  useAdminBoard,
  useAdminPointsUser,
  type BoardRow,
} from "@/hooks/usePoints";

export const Route = createFileRoute("/board")({
  head: () => ({ meta: [{ title: "Board — Pine Admin" }] }),
  beforeLoad: () => requireSuperAdmin(),
  component: BoardPage,
});

const PAGE_SIZE = 50;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MEDAL = ["text-[#D4A32C]", "text-[#9AA3AE]", "text-[#B2763F]"];

/**
 * The prize-settling view of the Pine Points competition.
 *
 * Deliberately unmasked, unlike the board investors see: picking winners
 * needs real names and contacts. Reading this page is itself written to the
 * audit log for the same reason.
 */
function BoardPage() {
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openUser, setOpenUser] = useState<BoardRow | null>(null);

  const { data, isLoading, isError, isFetching } = useAdminBoard({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[3px] bg-pine/10 text-pine flex items-center justify-center">
          <Trophy className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Board</h1>
          <p className="text-xs text-muted-foreground">
            {data?.season
              ? `${data.season.name} — ${data.season.closed ? "closed" : "runs to"} ${fmtDate(data.season.endsAt)}`
              : "Pine Points competition"}
          </p>
        </div>
        {isFetching && !isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search */}
      <form onSubmit={apply} className="flex items-end gap-3">
        <div className="min-w-[260px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Find an investor
          </label>
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Name, phone or email"
            className="w-full h-9 px-3 rounded-[3px] border border-border bg-card text-sm focus:outline-none focus:border-pine/40"
          />
        </div>
        <button
          type="submit"
          className="h-9 px-3.5 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 flex items-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearchDraft("");
              setSearch("");
              setPage(1);
            }}
            className="h-9 px-3 rounded-[3px] border border-border text-sm hover:bg-muted flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </form>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="py-16 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-5 h-5" />
            The board could not be loaded.
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {search ? "Nobody matches that search." : "Nobody has scored yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2.5 w-16">Rank</th>
                <th className="text-left font-semibold px-4 py-2.5">Investor</th>
                <th className="text-left font-semibold px-4 py-2.5">Contact</th>
                <th className="text-right font-semibold px-4 py-2.5">Points</th>
                <th className="text-left font-semibold px-4 py-2.5">Mostly from</th>
                <th className="text-left font-semibold px-4 py-2.5 w-32">Last scored</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const top = row.breakdown[0];
                return (
                  <tr
                    key={row.userId}
                    onClick={() => setOpenUser(row)}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40 cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-semibold ${row.rank <= 3 ? MEDAL[row.rank - 1] : "text-muted-foreground"}`}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                        {row.suspicious && (
                          <span
                            title="Almost all of this score comes from one rule — check before paying out"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] bg-amber-500/15 text-amber-600"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Check
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Joined {fmtDate(row.joinedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      <div>{row.phone}</div>
                      {row.email && <div>{row.email}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {row.totalPoints.toLocaleString("en")}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {top
                        ? `${top.ruleKey.toLowerCase().replace(/_/g, " ")} (${Math.round((top.points / Math.max(1, row.totalPoints)) * 100)}%)`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {fmtDate(row.lastAwardAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {data?.total.toLocaleString("en")} investor{data?.total === 1 ? "" : "s"} on the board
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-8 w-8 rounded-[3px] border border-border flex items-center justify-center disabled:opacity-40 hover:bg-muted"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-8 w-8 rounded-[3px] border border-border flex items-center justify-center disabled:opacity-40 hover:bg-muted"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {openUser && <UserDrawer row={openUser} onClose={() => setOpenUser(null)} />}
    </div>
  );
}

/** Everything one investor has earned, and every claim that was refused. */
function UserDrawer({ row, onClose }: { row: BoardRow; onClose: () => void }) {
  const { data, isLoading } = useAdminPointsUser(row.userId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-background border-l border-border overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border px-5 py-3 flex items-center gap-3">
          <div className="flex-1">
            <h2 className="font-semibold">{row.name}</h2>
            <p className="text-xs text-muted-foreground">
              {row.totalPoints.toLocaleString("en")} points · rank {row.rank}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-[3px] border border-border flex items-center justify-center hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Where the points came from
              </h3>
              <div className="space-y-1">
                {(data?.breakdown ?? []).map((b) => (
                  <div key={b.ruleKey} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {b.ruleKey.toLowerCase().replace(/_/g, " ")} &times;{b.count}
                    </span>
                    <span className="font-medium tabular-nums">{b.points}</span>
                  </div>
                ))}
              </div>
            </section>

            {(data?.notificationOpens ?? []).length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Alert claims, including refused ones
                </h3>
                <div className="space-y-1">
                  {data!.notificationOpens.slice(0, 20).map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{fmtDateTime(o.createdAt)}</span>
                      <span className={o.awarded ? "text-pine" : "text-muted-foreground"}>
                        {o.awarded
                          ? `scored in ${(o.latencyMs / 1000).toFixed(1)}s`
                          : (o.rejectedReason ?? "refused").toLowerCase().replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Every award
              </h3>
              <div className="space-y-1">
                {(data?.events ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs">
                    <span>{e.title}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted-foreground">{fmtDateTime(e.createdAt)}</span>
                      <span className={`font-semibold tabular-nums ${e.points >= 0 ? "text-pine" : "text-destructive"}`}>
                        {e.points >= 0 ? "+" : ""}
                        {e.points}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
