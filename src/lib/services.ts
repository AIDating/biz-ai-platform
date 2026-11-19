export type ServiceItem = { name: string; detail: string };

export function parseServices(json: string): ServiceItem[] {
  try {
    const value = JSON.parse(json) as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        const record = item as { name?: unknown; detail?: unknown };
        return {
          name: String(record?.name ?? "").trim().slice(0, 80),
          detail: String(record?.detail ?? "").trim().slice(0, 160),
        };
      })
      .filter((item) => item.name.length > 0)
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function serializeServices(services: ServiceItem[]) {
  return JSON.stringify(
    services
      .map((service) => ({
        name: service.name.trim().slice(0, 80),
        detail: service.detail.trim().slice(0, 160),
      }))
      .filter((service) => service.name),
  );
}

const DAY_RO = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"];
const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatOpenings(
  rules: { dayOfWeek: number; startMin: number; endMin: number; enabled: boolean }[],
  locale: "ro" | "en",
) {
  const names = locale === "ro" ? DAY_RO : DAY_EN;
  const closed = locale === "ro" ? "închis" : "closed";
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order
    .map((day) => {
      const rule = rules.find((item) => item.dayOfWeek === day);
      if (!rule?.enabled) return `${names[day]}: ${closed}`;
      return `${names[day]}: ${minutesLabel(rule.startMin)}–${minutesLabel(rule.endMin)}`;
    })
    .join("\n");
}

function minutesLabel(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export const TONE_KEYS = ["prietenos", "profesional", "calm", "entuziast"] as const;
export type ToneKey = (typeof TONE_KEYS)[number];

export const TIMEZONES = [
  "Europe/Bucharest",
  "Europe/Chisinau",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
] as const;

export const SLOT_LENGTHS = [15, 20, 30, 45, 60, 90] as const;
