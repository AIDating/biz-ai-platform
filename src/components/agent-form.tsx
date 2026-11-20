"use client";

import { useActionState, useState } from "react";
import { saveAgentAction, type ActionState } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FxQuote, ServiceCurrency } from "@/lib/fx";
import {
  defaultNewServicePrice,
  displayPriceAmount,
  formatEditablePrice,
  type ServiceItem,
} from "@/lib/services";
import type { Dictionary } from "@/i18n/ro";

type Row = {
  key: string;
  name: string;
  duration: string;
  typedPrice: string;
  note: string;
  sourcePrice: number | null;
  sourceCurrency: ServiceCurrency;
  priceTouched: boolean;
  isNew: boolean;
};
type Opening = { dayOfWeek: number; enabled: boolean; start: string; end: string };

const initialState: ActionState = { ok: false, error: "" };
const MAX_SERVICES = 30;

export function AgentForm({
  dict,
  locale,
  businessName,
  description,
  greeting,
  tone,
  customInstructions,
  slotMinutes,
  timezone,
  enabled,
  services,
  quote,
  openings,
  tones,
  timezones,
  slotLengths,
}: {
  dict: Dictionary;
  locale: "ro" | "en";
  businessName: string;
  description: string;
  greeting: string;
  tone: string;
  customInstructions: string;
  slotMinutes: number;
  timezone: string;
  enabled: boolean;
  services: ServiceItem[];
  quote: FxQuote;
  openings: Opening[];
  tones: { value: string; label: string }[];
  timezones: readonly string[];
  slotLengths: readonly number[];
}) {
  const [state, action, pending] = useActionState(saveAgentAction, initialState);
  const [rows, setRows] = useState<Row[]>(() =>
    services.length ? services.map((service, index) => toRow(service, index)) : [newRow("s-0")],
  );

  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-display text-2xl">{dict.agent.identity}</h2>
        <Field label={dict.agent.businessName}>
          <Input name="businessName" defaultValue={businessName} placeholder={dict.agent.businessNamePlaceholder} required minLength={2} maxLength={80} />
        </Field>
        <Field label={dict.agent.description}>
          <Textarea name="description" defaultValue={description} placeholder={dict.agent.descriptionPlaceholder} maxLength={2000} />
        </Field>
        <Field label={dict.agent.greeting}>
          <Input name="greeting" defaultValue={greeting} placeholder={dict.agent.greetingPlaceholder} maxLength={300} />
        </Field>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{dict.agent.services}</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={rows.length >= MAX_SERVICES}
            onClick={() => setRows((current) => (current.length >= MAX_SERVICES ? current : [...current, newRow(`s-${Date.now()}`)]))}
          >
            {dict.agent.addService}
          </Button>
        </div>
        {rows.length >= MAX_SERVICES ? <p className="text-xs text-muted-foreground">{dict.agent.limit}</p> : null}
        {rows.map((row) => {
          const unit = locale === "en" ? "£" : "RON";
          const price = shownPrice(row, locale, quote.ronPerGbp);
          return (
            <div key={row.key} className="space-y-2 rounded-2xl border p-3">
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_8rem_minmax(8rem,11rem)_auto] lg:items-end">
                <Field label={dict.agent.serviceName}>
                  <Input
                    name="serviceName"
                    value={row.name}
                    placeholder={dict.agent.serviceNamePlaceholder}
                    maxLength={80}
                    onChange={(event) => updateRow(row.key, { name: event.target.value })}
                  />
                </Field>
                <Field label={dict.agent.duration}>
                  <Input
                    name="serviceDuration"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1440}
                    step={1}
                    value={row.duration}
                    placeholder={dict.agent.durationPlaceholder}
                    onChange={(event) => updateRow(row.key, { duration: event.target.value })}
                  />
                </Field>
                <Field label={dict.agent.price}>
                  <div className="flex">
                    <Input
                      name="servicePrice"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={price}
                      placeholder={dict.agent.pricePlaceholder}
                      className="rounded-r-none"
                      aria-describedby={`${row.key}-currency`}
                      onChange={(event) => updateRow(row.key, { typedPrice: event.target.value, priceTouched: true })}
                    />
                    <span
                      id={`${row.key}-currency`}
                      className="flex h-11 shrink-0 items-center rounded-r-md border border-l-0 bg-white px-3 text-sm"
                    >
                      {unit}
                    </span>
                  </div>
                </Field>
                <Button type="button" variant="ghost" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                  {dict.agent.remove}
                </Button>
              </div>
              <input type="hidden" name="servicePriceTouched" value={row.priceTouched ? "1" : "0"} />
              <input type="hidden" name="serviceIsNew" value={row.isNew ? "1" : "0"} />
              <input type="hidden" name="serviceSourcePrice" value={row.sourcePrice == null ? "" : formatEditablePrice(row.sourcePrice)} />
              <input type="hidden" name="serviceSourceCurrency" value={row.sourceCurrency} />
              {row.note ? (
                <Field label={dict.agent.note}>
                  <Input
                    name="serviceNote"
                    value={row.note}
                    placeholder={dict.agent.notePlaceholder}
                    maxLength={160}
                    onChange={(event) => updateRow(row.key, { note: event.target.value })}
                  />
                </Field>
              ) : (
                <input type="hidden" name="serviceNote" value="" />
              )}
            </div>
          );
        })}
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
        <Textarea
          name="customInstructions"
          defaultValue={customInstructions}
          placeholder={dict.agent.instructionsPlaceholder}
          maxLength={4000}
        />
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

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }
}

function shownPrice(row: Row, locale: "ro" | "en", ronPerGbp: number) {
  if (row.priceTouched) return row.typedPrice;
  if (row.isNew) return String(defaultNewServicePrice(locale).price);
  return displayPriceAmount(row.sourcePrice, row.sourceCurrency, locale, ronPerGbp);
}

function toRow(service: ServiceItem, index: number): Row {
  return {
    key: `s-${index}`,
    name: service.name,
    duration: service.durationMin == null ? "" : String(service.durationMin),
    typedPrice: "",
    note: service.note,
    sourcePrice: service.price,
    sourceCurrency: service.currency,
    priceTouched: false,
    isNew: false,
  };
}

function newRow(key: string): Row {
  return {
    key,
    name: "",
    duration: "",
    typedPrice: "",
    note: "",
    sourcePrice: null,
    sourceCurrency: "RON",
    priceTouched: false,
    isNew: true,
  };
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
