"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/i18n/ro";

type Message = { id: string; role: string; content: string; createdAt: string };
type ActionBadge = { summary: string; href?: string; ok: boolean };

export function DashboardOwnerChat({
  copy,
  locale,
}: {
  copy: Dictionary["ownerChat"];
  locale: "ro" | "en";
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<ActionBadge[]>([]);
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    void fetch("/api/dashboard/owner-chat")
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        const data = await response.json();
        setMessages(data.messages ?? []);
        setBusinessName(data.businessName ?? "");
      })
      .catch(() => setError(copy.loadFailed))
      .finally(() => setReady(true));
  }, [copy.loadFailed]);

  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, open, actions]);

  async function send() {
    const message = text.trim();
    if (!message || pending) return;
    setPending(true);
    setError("");
    setOpen(true);
    const response = await fetch("/api/dashboard/owner-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, locale }),
    });
    setPending(false);
    if (response.status === 429) {
      setError(copy.rate);
      return;
    }
    if (!response.ok) {
      setError(copy.sendFailed);
      return;
    }
    const data = await response.json();
    setMessages(data.messages ?? []);
    setActions(data.actions ?? []);
    setText("");
    router.refresh();
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="pointer-events-auto border-t border-[#111] bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
        {open ? (
          <div className="mx-auto flex h-[min(52vh,28rem)] max-w-5xl flex-col">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2 sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-[#E10600] uppercase">{copy.kicker}</p>
                <p className="truncate text-sm font-medium">
                  {copy.title}
                  {businessName ? ` · ${businessName}` : ""}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label={copy.collapse}>
                <ChevronDown className="h-4 w-4" />
                {copy.collapse}
              </Button>
            </div>
            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-6">
              {!ready ? <p className="text-sm text-muted-foreground">{copy.loading}</p> : null}
              {ready && messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">{copy.empty}</p>
              ) : null}
              {messages.map((message) => {
                const mine = message.role === "owner" || message.role === "user" || message.role === "visitor";
                return (
                  <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        mine
                          ? "max-w-[90%] bg-[#111] px-3 py-2 text-sm text-white"
                          : "max-w-[90%] border border-border bg-[#fafafa] px-3 py-2 text-sm"
                      }
                    >
                      <p className="mb-1 text-[10px] tracking-wide uppercase opacity-70">
                        {mine ? copy.you : copy.assistant}
                      </p>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                );
              })}
              {actions.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {actions.map((action, index) =>
                    action.href ? (
                      <Link
                        key={`${action.summary}-${index}`}
                        href={action.href}
                        className="inline-flex items-center border border-[#E10600] px-2 py-1 text-[11px] font-medium text-[#E10600]"
                      >
                        {action.summary}
                      </Link>
                    ) : (
                      <span
                        key={`${action.summary}-${index}`}
                        className="inline-flex items-center border border-[#dedede] px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        {action.summary}
                      </span>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <form
          className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-[#111] text-[#111]"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? copy.collapse : copy.expand}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          </button>
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={copy.placeholder}
            maxLength={2000}
            aria-label={copy.placeholder}
            className="h-11"
          />
          <Button type="submit" variant="brass" disabled={pending || !text.trim()} className="shrink-0">
            {pending ? copy.sending : copy.send}
          </Button>
          {!open ? (
            <Button type="button" variant="outline" size="sm" className="hidden shrink-0 sm:inline-flex" onClick={() => setOpen(true)}>
              <ChevronUp className="h-4 w-4" />
              {copy.expand}
            </Button>
          ) : null}
        </form>
        {error ? <p className="mx-auto max-w-5xl px-4 pb-3 text-xs text-[#E10600] sm:px-6">{error}</p> : null}
      </div>
    </div>
  );
}
