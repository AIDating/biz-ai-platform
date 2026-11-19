import { addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const DAY_INDEX = [0, 1, 2, 3, 4, 5, 6] as const;

export function minutesToTime(minutes: number) {
  const safe = Math.max(0, Math.min(24 * 60, Math.floor(minutes)));
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    weekday: parts.weekday ?? "",
  };
}

/** UTC instant for a wall-clock time in `timeZone`. The process timezone should be UTC. */
export function zonedWallTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  return fromZonedTime(new Date(year, month - 1, day, hour, minute, 0), timeZone);
}

export function startOfZonedDay(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return zonedWallTime(parts.year, parts.month, parts.day, 0, 0, timeZone);
}

export function addZonedDays(date: Date, amount: number, timeZone: string) {
  const shifted = addDays(toZonedTime(date, timeZone), amount);
  return fromZonedTime(shifted, timeZone);
}

export function zonedWeekday(date: Date, timeZone: string) {
  return toZonedTime(date, timeZone).getDay();
}

export function formatWhen(date: Date, timeZone: string, locale: "ro" | "en") {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(date: Date, timeZone: string, locale: "ro" | "en") {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDay(date: Date, timeZone: string, locale: "ro" | "en") {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function dayKey(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function parseDayKey(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return zonedWallTime(year, month, day, 0, 0, timeZone);
}
