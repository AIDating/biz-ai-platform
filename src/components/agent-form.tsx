"use client";

import { useActionState, useState } from "react";
import { saveAgentAction, type ActionState } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/ro";

type Row = { key: string; name: string; detail: string };
type Opening = { dayOfWeek: number; enabled: boolean; start: string; end: string };

const initialState: ActionState = { ok: false, error: "" };

export function AgentForm({
  dict,
  businessName,
  description,
  greeting,
  tone,
  customInstructions,
  slotMinutes,
  timezone,
  enabled,
  services,
  openings,
  tones,
  timezones,
  slotLengths,
}: {
  dict: Dictionary;
  businessName: string;
  description: string;
  greeting: string;
  tone: string;
  customInstructions: string;
  slotMinutes: number;
  timezone: string;
  enabled: boolean;
  services: { name: string; detail: string }[];
  openings: Opening[];
  tones: { value: string; label: string }[];
  timezones: readonly string[];
  slotLengths: readonly number[];
}) {
  const [state, action, pending] = useActionState(saveAgentAction, initialState);
  const [rows, setRows] = useState<Row[]>(
    services.length
      ? services.map((service, index) => ({ key: `s-${index}`, ...service }))
      : [{ key: "s-0", name: "", detail: "" }],
  );

  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-display text-2xl">{dict.agent.identity}</h2>
        <Field label={dict.agent.businessName}>
          <Input name="businessName" defaultValue={businessName} required minLength={2} maxLength={80} />
        </Field>
        <Field label={dict.agent.description}>
          <Textarea name="description" defaultValue={description} maxLength={2000} />
        </Field>
        <Field label={dict.agent.greeting}>
          <Input name="greeting" defaultValue={greeting} maxLength={300} />
        </Field>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{dict.agent.services}</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRows((current) => [...current, { key: `s-${Date.now()}`, name: "", detail: "" }])}
          >
            {dict.agent.addService}
          </Button>
        </div>
        {rows.map((row) => (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input name="serviceName" defaultValue={row.name} placeholder={dict.agent.serviceName} maxLength={80} />
            <Input name="serviceDetail" defaultValue={row.detail} placeholder={dict.agent.serviceDetail} maxLength={160} />
            <Button type="button" variant="ghost" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
              {dict.agent.remove}
            </Button>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.agent.tone}>
          <select name="tone" defaultValue={tone} className="h-11 w-full rounded-xl border bg-card px-3 text-sm">
            {tones.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={dict.agent.slot}>
          <select name="slotMinutes" defaultValue={slotMinutes} className="h-11 w-full rounded-xl border bg-card px-3 text-sm">
            {slotLengths.map((length) => (
              <option key={length} value={length}>
                {length} {dict.agent.minutes}
              </option>
            ))}
          </select>
        </Field>
        <Field label={dict.agent.timezone}>
          <select name="timezone" defaultValue={timezone} className="h-11 w-full rounded-xl border bg-card px-3 text-sm">
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-end gap-3 pb-2 text-sm">
          <input type="checkbox" name="agentEnabled" defaultChecked={enabled} className="h-4 w-4 accent-[#E10600]" />
          {dict.agent.enabled}
        </label>
      </section>

      <Field label={dict.agent.instructions} hint={dict.agent.instructionsHint}>
        <Textarea name="customInstructions" defaultValue={customInstructions} maxLength={4000} />
      </Field>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">{dict.agent.hours}</h2>
        <div className="space-y-2">
          {openings.map((opening) => (
            <div key={opening.dayOfWeek} className="grid grid-cols-[1.4fr_auto_auto] items-center gap-2 sm:grid-cols-[10rem_auto_8rem_8rem]">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="openDays"
                  value={opening.dayOfWeek}
                  defaultChecked={opening.enabled}
                  className="h-4 w-4 accent-[#E10600]"
                />
                {dict.days[opening.dayOfWeek]}
              </label>
              <span className="hidden sm:block" />
              <Input type="time" name={`start-${opening.dayOfWeek}`} defaultValue={opening.start} />
              <Input type="time" name={`end-${opening.dayOfWeek}`} defaultValue={opening.end} />
            </div>
          ))}
        </div>
      </section>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm">{dict.agent.saved}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? dict.common.loading : dict.agent.save}
      </Button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
