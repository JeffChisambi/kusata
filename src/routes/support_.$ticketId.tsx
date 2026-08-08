import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send, Paperclip, User } from "lucide-react";
import { useDashboardTitle } from "@/components/broker-shell";
import {
  useSupportTicket, useReplyToTicket, useUpdateTicketStatus,
  type SupportStatus, type SupportMessage,
} from "@/hooks/useSupport";

export const Route = createFileRoute("/support_/$ticketId")({
  head: () => ({ meta: [{ title: "Ticket — Pine Broker Admin" }] }),
  component: TicketThreadPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  DEPOSITS: "Deposits", WITHDRAWALS: "Withdrawals", TRADING: "Trading",
  TREASURY: "Treasury", ACCOUNT: "Account", OTHER: "Other",
};

const STATUS_OPTIONS: { value: SupportStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function TicketThreadPage() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const { data: ticket, isLoading, isError } = useSupportTicket(ticketId);
  const reply = useReplyToTicket(ticketId);
  const changeStatus = useUpdateTicketStatus(ticketId);

  useDashboardTitle(ticket ? `#${ticket.reference}` : "Ticket");

  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages?.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || reply.isPending) return;
    setText("");
    try {
      await reply.mutateAsync(body);
    } catch {
      setText(body);
    }
  };

  if (isLoading) {
    return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isError || !ticket) {
    return (
      <div className="py-20 text-center text-sm text-rose">
        Couldn't load this ticket.
        <div className="mt-3">
          <button onClick={() => navigate({ to: "/support" })} className="text-pine font-medium">Back to Support</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-4 max-w-4xl">
      {/* Back + header */}
      <button onClick={() => navigate({ to: "/support" })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Support
      </button>

      <div className="rounded-[6px] bg-card border border-border p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">{ticket.subject}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              #{ticket.reference} · {CATEGORY_LABEL[ticket.category] ?? ticket.category} · opened {fmtWhen(ticket.createdAt)}
            </p>
            {ticket.user && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{ticket.user.name}</span> · {ticket.user.phone}
                {ticket.user.email ? ` · ${ticket.user.email}` : ""}
              </p>
            )}
          </div>
          {/* Status control */}
          <div className="flex items-center gap-1 rounded-[4px] border border-border p-0.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                disabled={changeStatus.isPending}
                onClick={() => ticket.status !== s.value && changeStatus.mutate(s.value)}
                className={`h-7 px-2.5 rounded-[3px] text-xs font-medium transition-colors ${
                  ticket.status === s.value ? "bg-pine text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="rounded-[6px] bg-card border border-border flex flex-col">
        <div className="p-5 space-y-4 max-h-[52vh] overflow-y-auto">
          {ticket.messages.map((m: SupportMessage) => <Message key={m.id} m={m} />)}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
              placeholder="Write a reply to the customer…  (⌘/Ctrl + Enter to send)"
              rows={2}
              className="flex-1 px-3 py-2.5 rounded-[3px] border border-border bg-background text-sm focus:outline-none focus:border-pine/40 resize-none"
            />
            <button
              onClick={send}
              disabled={!text.trim() || reply.isPending}
              className="h-10 px-4 rounded-[3px] bg-pine text-primary-foreground text-sm font-medium hover:bg-pine/90 disabled:opacity-40 flex items-center gap-1.5"
            >
              {reply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Message({ m }: { m: SupportMessage }) {
  if (m.authorType === "SYSTEM") {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-3 py-1">{m.body}</span>
      </div>
    );
  }
  const staff = m.authorType === "ADMIN";
  return (
    <div className={`flex ${staff ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] ${staff ? "items-end" : "items-start"} flex flex-col`}>
        <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground">
          {!staff && <User className="w-3 h-3" />}
          <span className="font-medium text-foreground">{staff ? m.authorName || "Support" : "Customer"}</span>
          <span>· {fmtWhen(m.createdAt)}</span>
        </div>
        <div className={`rounded-[8px] px-3.5 py-2.5 text-sm leading-relaxed ${
          staff ? "bg-pine text-primary-foreground rounded-br-[2px]" : "bg-muted text-foreground rounded-bl-[2px]"
        }`}>
          {m.attachmentUrl && (
            <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="block mb-2">
              <img src={m.attachmentUrl} alt="attachment" className="max-w-[240px] max-h-[200px] rounded-[6px] border border-black/10 object-cover" />
            </a>
          )}
          {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
        </div>
        {m.attachmentUrl && (
          <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Paperclip className="w-3 h-3" /> attachment
          </a>
        )}
      </div>
    </div>
  );
}
