"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  appointmentStatusAction,
  createAppointmentAction,
  updateAppointmentAction,
  type ActionState,
} from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarDay, CalendarAppointment } from "@/lib/calendar";
import type { Dictionary } from "@/i18n/ro";
import { cn } from "@/lib/cn";

const initial: ActionState = { ok: false, error: "" };

export function CalendarBoard({
  days,
  prevWeek,
  nextWeek,
  weekStart,
  services,
  dict,
}: {
  days: CalendarDay[];
  prevWeek: string;
  nextWeek: string;
  weekStart: string;
  services: { name: string; priceLabel: string; display: string }[];
  dict: Dictionary;
}) {
  const [createSlot, setCreateSlot] = useState<{ startsAt: string; timeLabel: string; day: string } | null>(null);
  const [editing, setEditing] = useState<CalendarAppointment & { startsAt: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/programari?week=${prevWeek}`}>{dict.appointments.prev}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/programari">{dict.appointments.thisWeek}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/programari?week=${nextWeek}`}>{dict.appointments.next}</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{weekStart}</p>
      </div>
      <p className="text-sm text-muted-foreground">{dict.appointments.pick}</p>
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => (
          <section
            key={day.date}
            className={cn("rounded-3xl border bg-card p-3", day.isToday && "border-primary")}
          >
            <h3 className="mb-2 text-sm font-medium capitalize">{day.label}</h3>
            {day.closed && day.slots.length === 0 ? (
              <p className="text-xs text-muted-foreground">{dict.appointments.closed}</p>
            ) : null}
            <div className="space-y-1.5">
              {day.slots.map((slot) =>
                slot.appointment ? (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setEditing({ ...slot.appointment!, startsAt: slot.startsAt })}
                    className="w-full rounded-2xl bg-primary px-2 py-2 text-left text-xs text-primary-foreground"
                  >
                    <span className="block font-medium">{slot.timeLabel}</span>
                    <span className="block truncate">{slot.appointment.clientName}</span>
                  </button>
                ) : (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setCreateSlot({ startsAt: slot.startsAt, timeLabel: slot.timeLabel, day: day.label })}
                    className="w-full rounded-2xl border border-dashed px-2 py-2 text-left text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    {slot.timeLabel}
                  </button>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={Boolean(createSlot)} onOpenChange={(open) => !open && setCreateSlot(null)}>
        <DialogContent closeLabel={dict.common.close}>
          <DialogHeader>
            <DialogTitle>{dict.appointments.bookTitle}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {createSlot?.day} · {createSlot?.timeLabel}
            </p>
          </DialogHeader>
          {createSlot ? (
            <BookingForm
              key={createSlot.startsAt}
              mode="create"
              startsAt={createSlot.startsAt}
              services={services}
              dict={dict}
              onDone={() => setCreateSlot(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent closeLabel={dict.common.close}>
          <DialogHeader>
            <DialogTitle>{dict.appointments.editTitle}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <Badge tone={editing.status === "completed" ? "good" : "warn"}>
                {dict.status[editing.status as "booked" | "completed"]}
              </Badge>
              <BookingForm
                key={editing.id}
                mode="edit"
                id={editing.id}
                startsAt={editing.startsAt}
                services={services}
                dict={dict}
                defaults={editing}
                onDone={() => setEditing(null)}
              />
              <div className="flex flex-wrap gap-2">
                <form action={appointmentStatusAction}>
                  <input type="hidden" name="id" value={editing.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <Button type="submit" variant="destructive" size="sm">
                    {dict.appointments.cancelBooking}
                  </Button>
                </form>
                <form action={appointmentStatusAction}>
                  <input type="hidden" name="id" value={editing.id} />
                  <input type="hidden" name="status" value="completed" />
                  <Button type="submit" variant="secondary" size="sm">
                    {dict.appointments.complete}
                  </Button>
                </form>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingForm({
  mode,
  id,
  startsAt,
  services,
  dict,
  defaults,
  onDone,
}: {
  mode: "create" | "edit";
  id?: string;
  startsAt: string;
  services: { name: string; priceLabel: string; display: string }[];
  dict: Dictionary;
  defaults?: CalendarAppointment;
  onDone: () => void;
}) {
  const action = mode === "create" ? createAppointmentAction : updateAppointmentAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const [service, setService] = useState(defaults?.service ?? "");
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="space-y-3">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="startsAt" value={startsAt} />
      <Field label={dict.appointments.name}>
        <Input name="clientName" required defaultValue={defaults?.clientName ?? ""} maxLength={80} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={dict.appointments.phone}>
          <Input name="clientPhone" defaultValue={defaults?.clientPhone ?? ""} maxLength={40} />
        </Field>
        <Field label={dict.appointments.email}>
          <Input name="clientEmail" type="email" defaultValue={defaults?.clientEmail ?? ""} maxLength={120} />
        </Field>
      </div>
      <Field label={dict.appointments.service}>
        <Input name="service" value={service} onChange={(event) => setService(event.target.value)} maxLength={80} />
        {services.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {services.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setService(item.name)}
                className="rounded-full border px-2.5 py-1 text-xs hover:border-[#E10600]"
              >
                {item.priceLabel ? `${item.name} · ${item.priceLabel}` : item.name}
              </button>
            ))}
          </div>
        ) : null}
      </Field>
      <Field label={dict.appointments.notes}>
        <Textarea name="notes" defaultValue={defaults?.notes ?? ""} maxLength={500} />
      </Field>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? dict.common.loading : dict.appointments.save}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
