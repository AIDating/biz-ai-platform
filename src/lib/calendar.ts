import { tenantDb } from "@/lib/tenant-db";
import { parseServices } from "@/lib/services";
import { generateSlots } from "@/lib/slots";
import {
  addZonedDays,
  dayKey,
  formatDay,
  formatTime,
  parseDayKey,
  startOfZonedDay,
  zonedWeekday,
} from "@/lib/time";

export type CalendarAppointment = {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  service: string;
  notes: string;
  status: string;
};

export type CalendarSlot = {
  startsAt: string;
  endsAt: string;
  timeLabel: string;
  appointment: CalendarAppointment | null;
};

export type CalendarDay = {
  date: string;
  label: string;
  closed: boolean;
  isToday: boolean;
  slots: CalendarSlot[];
};

export async function buildWeek(tenantId: string, weekParam: string | undefined, locale: "ro" | "en") {
  const db = tenantDb(tenantId);
  const agent = await db.agentProfile.findFirst();
  if (!agent) return null;
  const openings = await db.availabilityRule.findMany();
  const timezone = agent.timezone;
  const requested = weekParam ? parseDayKey(weekParam, timezone) : null;
  const anchor = startOfWeek(requested ?? new Date(), timezone);
  const end = addZonedDays(anchor, 7, timezone);
  const slots = generateSlots({
    from: anchor,
    to: end,
    timezone,
    slotMinutes: agent.slotMinutes,
    openings,
    busy: [],
    includePast: true,
  });
  const appointments = await db.appointment.findMany({
    where: {
      status: { not: "cancelled" },
      startsAt: { gte: anchor, lt: end },
    },
    orderBy: { startsAt: "asc" },
  });
  const byStart = new Map(appointments.map((item) => [item.startsAt.toISOString(), item]));
  const today = dayKey(new Date(), timezone);
  const days: CalendarDay[] = [];

  for (let index = 0; index < 7; index += 1) {
    const day = addZonedDays(anchor, index, timezone);
    const key = dayKey(day, timezone);
    const weekday = zonedWeekday(day, timezone);
    const rule = openings.find((item) => item.dayOfWeek === weekday);
    const closed = !rule?.enabled;
    const daySlots = slots
      .filter((slot) => dayKey(slot.startsAt, timezone) === key)
      .map((slot) => {
        const appointment = byStart.get(slot.startsAt.toISOString()) ?? null;
        if (appointment) byStart.delete(slot.startsAt.toISOString());
        return {
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          timeLabel: formatTime(slot.startsAt, timezone, locale),
          appointment: appointment ? toCard(appointment) : null,
        };
      });
    for (const appointment of appointments) {
      if (dayKey(appointment.startsAt, timezone) !== key) continue;
      if (daySlots.some((slot) => slot.appointment?.id === appointment.id)) continue;
      daySlots.push({
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        timeLabel: formatTime(appointment.startsAt, timezone, locale),
        appointment: toCard(appointment),
      });
    }
    daySlots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    days.push({
      date: key,
      label: formatDay(day, timezone, locale),
      closed,
      isToday: key === today,
      slots: daySlots,
    });
  }

  return {
    timezone,
    weekStart: dayKey(anchor, timezone),
    prevWeek: dayKey(addZonedDays(anchor, -7, timezone), timezone),
    nextWeek: dayKey(addZonedDays(anchor, 7, timezone), timezone),
    services: parseServices(agent.servicesJson),
    days,
  };
}

function startOfWeek(date: Date, timeZone: string) {
  const start = startOfZonedDay(date, timeZone);
  const weekday = zonedWeekday(start, timeZone);
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addZonedDays(start, delta, timeZone);
}

function toCard(appointment: {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  service: string;
  notes: string;
  status: string;
}): CalendarAppointment {
  return {
    id: appointment.id,
    clientName: appointment.clientName,
    clientPhone: appointment.clientPhone,
    clientEmail: appointment.clientEmail,
    service: appointment.service,
    notes: appointment.notes,
    status: appointment.status,
  };
}
