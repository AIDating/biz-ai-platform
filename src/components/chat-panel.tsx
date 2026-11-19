"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/i18n/ro";

type Message = { id: string; role: string; content: string; createdAt: string };
type Slot = { startsAt: string; label: string; timeLabel: string };
type Visitor = { name: string; phone: string; email: string };

export function ChatPanel({
  publicKey,
  copy,
  locale,
}: {
  publicKey: string;
  copy: Dictionary["chat"];
  locale: "ro" | "en";
}) {
  const visitorKey = useRef("");
  const scroller = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [greeting, setGreeting] = useState("");
  const [offline, setOffline] = useState(false);
  const [mock, setMock] = useState(false);
  const [services, setServices] = useState<{ name: string }[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [visitor, setVisitor] = useState<Visitor>({ name: "", phone: "", email: "" });
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", service: "" });

  useEffect(() => {
    const storageKey = `redline:${publicKey}`;
    let key = localStorage.getItem(storageKey);
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(storageKey, key);
    }
    visitorKey.current = key;
    void fetch(`/api/widget/${publicKey}?visitorKey=${encodeURIComponent(key)}`)
      .then(async (response) => {
        if (!response.ok) {
          setMissing(true);
          return;
        }
        const data = await response.json();
        setBusinessName(data.config.businessName);
        setGreeting(data.config.greeting);
        setOffline(!data.config.enabled);
        setMock(Boolean(data.config.mock));
        setServices(data.config.services ?? []);
        setMessages(data.messages ?? []);
        setVisitor(data.visitor ?? { name: "", phone: "", email: "" });
      })
      .catch(() => setMissing(true))
      .finally(() => setReady(true));
  }, [publicKey]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, slots, pendingSlot, pending]);

  async function send(extra?: {
    message?: string;
    slotStartsAt?: string | null;
    contact?: { name: string; phone: string; email: string; service?: string };
  }) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/widget/${publicKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorKey: visitorKey.current,
        message: extra?.message ?? text,
        slotStartsAt: extra?.slotStartsAt ?? null,
        locale,
        contact: extra?.contact,
      }),
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
    setSlots(data.slots ?? []);
    setVisitor(data.visitor ?? visitor);
    setOffline(Boolean(data.offline));
    setMock(Boolean(data.mock));
    setText("");
    if (data.needContact && extra?.slotStartsAt) setPendingSlot(extra.slotStartsAt);
    else setPendingSlot(null);
  }

  function chooseSlot(startsAt: string) {
    const known = visitor.name && (visitor.phone || visitor.email);
    if (!known) {
      setPendingSlot(startsAt);
      setContact((current) => ({ ...current, name: visitor.name, phone: visitor.phone, email: visitor.email }));
      return;
    }
    void send({ message: "", slotStartsAt: startsAt });
  }

  if (!ready) {
    return <p className="grid h-full place-items-center text-sm text-muted-foreground">{copy.placeholder}</p>;
  }
  if (missing) {
    return <p className="grid h-full place-items-center px-6 text-center text-sm">{copy.unavailable}</p>;
  }

  const showGreeting = messages.length === 0 && greeting;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex items-center gap-2.5 border-b px-4 py-3">
        <LogoMark className="h-8 w-8 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#E10600]">{copy.desk}</p>
          <p className="truncate text-sm font-medium leading-tight">{businessName}</p>
        </div>
      </header>
      {offline ? (
        <p className="border-l-2 border-[#E10600] px-4 py-2 text-xs text-muted-foreground">
          {copy.offlineReply.replaceAll("{business}", businessName)}
        </p>
      ) : null}
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {showGreeting ? <Bubble role="assistant" copy={copy}>{greeting}</Bubble> : null}
        {messages.map((message) => (
          <Bubble key={message.id} role={message.role} copy={copy}>
            {message.content}
          </Bubble>
        ))}
        {slots.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{copy.slots}</p>
            <div className="flex flex-col gap-1.5">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => chooseSlot(slot.startsAt)}
                  className="rounded-2xl border bg-white px-3 py-2 text-left text-sm hover:border-primary"
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {pendingSlot ? (
          <form
            className="space-y-2 rounded-2xl border bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send({
                message: contact.service ? `${copy.service}: ${contact.service}` : "",
                slotStartsAt: pendingSlot,
                contact,
              });
            }}
          >
            <p className="text-sm font-medium">{copy.contactTitle}</p>
            <Input
              required
              placeholder={copy.name}
              value={contact.name}
              onChange={(event) => setContact({ ...contact, name: event.target.value })}
            />
            <Input
              placeholder={copy.phone}
              value={contact.phone}
              onChange={(event) => setContact({ ...contact, phone: event.target.value })}
            />
            <Input
              placeholder={copy.email}
              value={contact.email}
              onChange={(event) => setContact({ ...contact, email: event.target.value })}
            />
            {services.length > 0 ? (
              <select
                className="h-11 w-full rounded-xl border bg-card px-3 text-sm"
                value={contact.service}
                onChange={(event) => setContact({ ...contact, service: event.target.value })}
              >
                <option value="">{copy.service}</option>
                {services.map((service) => (
                  <option key={service.name} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
            ) : null}
            <p className="text-xs text-muted-foreground">{copy.contactHint}</p>
            <Button type="submit" disabled={pending} className="w-full">
              {copy.confirm}
            </Button>
          </form>
        ) : null}
        {pending ? <p className="text-xs text-muted-foreground">{copy.desk}…</p> : null}
      </div>
      {error ? <p className="px-3 text-xs text-destructive">{error}</p> : null}
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          void send({ message: text });
        }}
      >
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={copy.placeholder}
          maxLength={2000}
          aria-label={copy.placeholder}
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          {copy.send}
        </Button>
      </form>
      {mock ? <p className="px-3 pb-3 text-[11px] leading-4 text-muted-foreground">{copy.mock}</p> : null}
    </div>
  );
}

function Bubble({ role, children, copy }: { role: string; children: string; copy: Dictionary["chat"] }) {
  const mine = role === "visitor" || role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div className={mine ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-[85%] rounded-2xl rounded-bl-md border bg-white px-3 py-2 text-sm"}>
        <p className="mb-1 text-[10px] uppercase tracking-wide opacity-70">{mine ? copy.you : copy.desk}</p>
        <p className="whitespace-pre-wrap">{children}</p>
      </div>
    </div>
  );
}
