import { tenantDb } from "@/lib/tenant-db";
import {
  minutesToTime,
  startOfZonedDay,
  addZonedDays,
  zonedParts,
  zonedWallTime,
  zonedWeekday,
  formatWhen,
  formatTime,
} from "@/lib/time";

export type Opening = {
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  enabled: boolean;
};

export type Slot = {
  startsAt: Date;
  endsAt: Date;
};

export type BusyRange = {
  startsAt: Date;
  endsAt: Date;
};

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export function generateSlots(options: {
  from: Date;
  to: Date;
  timezone: string;
  slotMinutes: number;
  openings: Opening[];
  busy: BusyRange[];
  now?: Date;
  includePast?: boolean;
}) {
  const slotMinutes = options.slotMinutes;
  if (slotMinutes < 10 || slotMinutes > 240) return [];
  const now = options.now ?? new Date();
  const slots: Slot[] = [];
  let cursor = startOfZonedDay(options.from, options.timezone);
  const horizon = options.to;
  let guard = 0;

  while (cursor < horizon && guard < 40) {
    guard += 1;
    const parts = zonedParts(cursor, options.timezone);
    const weekday = zonedWeekday(cursor, options.timezone);
    const rule = options.openings.find((item) => item.dayOfWeek === weekday);
    if (rule?.enabled && rule.endMin > rule.startMin) {
      for (let minute = rule.startMin; minute + slotMinutes <= rule.endMin; minute += slotMinutes) {
        const startsAt = zonedWallTime(
          parts.year,
          parts.month,
          parts.day,
          Math.floor(minute / 60),
          minute % 60,
          options.timezone,
        );
        const endsAt = new Date(startsAt.getTime() + slotMinutes * 60_000);
        if (startsAt < options.from || startsAt >= horizon) continue;
        if (!options.includePast && startsAt <= now) continue;
        const overlaps = options.busy.some((busy) =>
          rangesOverlap(startsAt, endsAt, busy.startsAt, busy.endsAt),
        );
        if (!overlaps) slots.push({ startsAt, endsAt });
      }
    }
    cursor = addZonedDays(cursor, 1, options.timezone);
  }

  return slots;
}

export function describeSlot(slot: Slot, timezone: string, locale: "ro" | "en") {
  return {
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    label: formatWhen(slot.startsAt, timezone, locale),
    timeLabel: formatTime(slot.startsAt, timezone, locale),
    clock: minutesToTime(
      zonedParts(slot.startsAt, timezone).hour * 60 + zonedParts(slot.startsAt, timezone).minute,
    ),
  };
}

export async function getAvailableSlots(
  tenantId: string,
  options?: { from?: Date; to?: Date; limit?: number; ignoreAppointmentId?: string; now?: Date },
) {
  const db = tenantDb(tenantId);
  const agent = await db.agentProfile.findFirst();
  if (!agent) return [];
  const openings = await db.availabilityRule.findMany();
  const from = options?.from ?? new Date();
  const to = options?.to ?? new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
  const rows = await db.appointment.findMany({
    where: {
      status: { not: "cancelled" },
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    select: { id: true, startsAt: true, endsAt: true },
  });
  const busy = rows
    .filter((row) => row.id !== options?.ignoreAppointmentId)
    .map((row) => ({ startsAt: row.startsAt, endsAt: row.endsAt }));
  const slots = generateSlots({
    from,
    to,
    timezone: agent.timezone,
    slotMinutes: agent.slotMinutes,
    openings,
    busy,
    now: options?.now ?? new Date(),
  });
  return options?.limit ? slots.slice(0, options.limit) : slots;
}
