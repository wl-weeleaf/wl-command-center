import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LeafyAvatar } from "@/components/wl/brand-mark";
import { listChat, sendChat } from "@/lib/wl/fns";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Hvad kræver min godkendelse i dag?",
  "Vis mig de ubetalte fakturaer.",
  "Forbered en opfølgningsmail til TAMU.",
  "Hvad mangler vi på Life 1.0?",
  "Opsummér denne uges administrative opgaver.",
];

export function LeafyChat({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { data: messages = [] } = useQuery({ queryKey: ["chat"], queryFn: () => listChat() });
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const send = useMutation({
    mutationFn: (message: string) => sendChat({ data: { message } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["chat"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["proposals"] });
      if (res.proposalIds.length) {
        toast.success("Leafy lagde et forslag i godkendelsescenteret.");
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Kunne ikke sende."),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, send.isPending]);

  function submit(value = text) {
    const message = value.trim();
    if (!message || send.isPending) return;
    setText("");
    send.mutate(message);
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", compact && "rounded-xl shadow-(--shadow-card)")}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <LeafyAvatar size={44} />
        <div className="min-w-0">
          <div className="font-display text-base leading-tight">Leafy</div>
          <p className="truncate text-xs text-muted-foreground">Grok som hjerne. Forbereder — I godkender.</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !send.isPending && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Spørg om dagsopgaver, godkendelser, TAMU, Life 1.0 eller ugens arbejde. Leafy bruger kun registrerede data.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-lg bg-muted px-3 py-2 text-left text-sm text-foreground hover:bg-border"
                  onClick={() => submit(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.proposalId && (
                <Link
                  to="/admin/approvals"
                  className="mt-2 inline-block text-xs underline underline-offset-2"
                >
                  Åbn godkendelsescenter
                </Link>
              )}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Leafy tænker…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Skriv til Leafy…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={send.isPending || !text.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
