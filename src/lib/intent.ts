const STOP_NAMES = new Set([
  "interesat",
  "interesată",
  "bine",
  "aici",
  "ocupat",
  "disponibil",
  "ok",
  "okay",
  "yes",
  "no",
  "the",
  "a",
]);

export function extractEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase().slice(0, 120) : "";
}

export function extractPhone(text: string) {
  const match = text.match(/(?:\+\d{1,3}[\s.-]*)?(?:\d[\s().-]*){8,14}\d/);
  if (!match) return "";
  const compact = match[0].replace(/[^\d+]/g, "");
  const digits = compact.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return compact.slice(0, 40);
}

export function extractName(text: string) {
  const patterns = [
    /(?:m[aă] numesc|numele meu (?:este|e)|my name is|i am|i'm)\s+([A-Za-zĂÂÎȘȚăâîșțÉéèüö\-']+(?:\s+[A-Za-zĂÂÎȘȚăâîșțÉéèüö\-']+){0,2})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const name = cleanupName(match[1]);
    if (name) return name;
  }
  return "";
}

function cleanupName(value: string) {
  const name = value.replace(/[,.!?].*$/, "").trim().slice(0, 80);
  const first = name.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!name || STOP_NAMES.has(first)) return "";
  return name;
}

export function extractContact(text: string) {
  return {
    name: extractName(text),
    phone: extractPhone(text),
    email: extractEmail(text),
  };
}

export function contactReady(contact: { name: string; phone: string; email: string }) {
  return Boolean(contact.name && (contact.phone || contact.email));
}

const HOURS = /(program|orar|deschis|închis|inchis|când lucr|cand lucr|ce ore|hours|when are you open|opening)/i;
const SERVICES = /(servici|preț|pret|costă|costa|tarif|oferi|ce faceți|ce faceti|price|services)/i;
const BOOK = /(programare|programez|rezerv|întâlnire|intalnire|appointment|book|vreau s[aă] vin|pot veni|aș vrea|as vrea)/i;
const GREETING = /^(bun[aă]|salut|hello|hi|hey|bun[aă]\s+ziua)[!.\s]*$/i;

export function classifyMessage(text: string) {
  if (HOURS.test(text)) return "hours" as const;
  if (SERVICES.test(text)) return "services" as const;
  if (BOOK.test(text)) return "book" as const;
  if (GREETING.test(text.trim())) return "greeting" as const;
  if (extractPhone(text) || extractEmail(text) || extractName(text)) return "contact" as const;
  return "other" as const;
}

const WEEKDAY: Record<string, number> = {
  duminica: 0,
  duminică: 0,
  sunday: 0,
  luni: 1,
  monday: 1,
  marti: 2,
  marți: 2,
  tuesday: 2,
  miercuri: 3,
  wednesday: 3,
  joi: 4,
  thursday: 4,
  vineri: 5,
  friday: 5,
  sambata: 6,
  sâmbătă: 6,
  saturday: 6,
};

export function matchSlotByText(
  text: string,
  slots: { startsAt: string; clock: string }[],
  timezone: string,
) {
  const timeMatch = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (!timeMatch || slots.length === 0) return null;
  const clock = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  const lowered = text.toLowerCase();
  let weekday: number | null = null;
  for (const [word, day] of Object.entries(WEEKDAY)) {
    if (lowered.includes(word)) weekday = day;
  }
  const wantsTomorrow = /mâine|maine|tomorrow/.test(lowered);
  const wantsToday = /\bazi\b|\btoday\b/.test(lowered);

  const candidates = slots.filter((slot) => {
    if (slot.clock !== clock) return false;
    const date = new Date(slot.startsAt);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      day: "2-digit",
    }).formatToParts(date);
    const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "";
    const dayNumber = Number(parts.find((part) => part.type === "day")?.value);
    if (weekday != null) {
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      if (map[weekdayName] !== weekday) return false;
    }
    if (wantsTomorrow || wantsToday) {
      const today = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        day: "2-digit",
      }).format(new Date());
      const todayNumber = Number(today);
      const target = wantsTomorrow ? todayNumber + 1 : todayNumber;
      if (dayNumber !== target && !(wantsTomorrow && dayNumber === 1 && todayNumber >= 28)) {
        if (dayNumber !== target) return false;
      }
    }
    return true;
  });
  return candidates.length === 1 ? candidates[0] : null;
}
