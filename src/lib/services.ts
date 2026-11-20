import { convertAmount, normalizeCurrency, parseRonPerGbp, type FxSettings, type ServiceCurrency } from "@/lib/fx";

export type { FxSettings, ServiceCurrency };
export { SERVICE_CURRENCIES } from "@/lib/fx";

export type ServiceItem = {
  name: string;
  /** Source-currency summary kept for older readers. Display conversion never overwrites this. */
  detail: string;
  durationMin: number | null;
  /** Exact stored price in `currency`. Null when the service has no numeric price. */
  price: number | null;
  currency: ServiceCurrency;
  /** Legacy wording that was not a duration or a price, such as "de la". */
  note: string;
};

const MAX_SERVICES = 30;

export const DEFAULT_NEW_SERVICE_PRICE_GBP = 30;
export const DEFAULT_NEW_SERVICE_PRICE_RON = 100;

export function currencyForLocale(locale: "ro" | "en"): ServiceCurrency {
  return locale === "en" ? "GBP" : "RON";
}

export function defaultNewServicePrice(locale: "ro" | "en"): { price: number; currency: ServiceCurrency } {
  return locale === "en"
    ? { price: DEFAULT_NEW_SERVICE_PRICE_GBP, currency: "GBP" }
    : { price: DEFAULT_NEW_SERVICE_PRICE_RON, currency: "RON" };
}

export function formatEditablePrice(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(2);
}

/** Price string shown in the active dashboard language. Same-currency amounts are not converted. */
export function displayPriceAmount(
  price: number | null,
  currency: ServiceCurrency,
  locale: "ro" | "en",
  ronPerGbp: number,
) {
  if (price == null) return "";
  const amount = convertAmount(price, currency, currencyForLocale(locale), ronPerGbp);
  return formatEditablePrice(amount);
}

export function parseDurationValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const text = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 24 * 60) return null;
  return Math.round(numeric);
}

export function parsePriceValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
  const text = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1_000_000) return null;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

export function formatStoredDetail(service: Pick<ServiceItem, "durationMin" | "price" | "currency" | "note">) {
  const parts: string[] = [];
  if (service.durationMin != null) parts.push(`${service.durationMin} min`);
  if (service.price != null) {
    const rounded = Math.round((service.price + Number.EPSILON) * 100) / 100;
    const whole = Math.abs(rounded - Math.round(rounded)) < 1e-9;
    if (service.currency === "GBP") parts.push(whole ? `£${Math.round(rounded)}` : `£${rounded.toFixed(2)}`);
    else parts.push(whole ? `${Math.round(rounded)} lei` : `${rounded.toFixed(2).replace(".", ",")} lei`);
  }
  if (service.note) parts.push(service.note);
  return parts.join(" · ").slice(0, 160);
}

export function parseLegacyDetail(detail: string): {
  durationMin: number | null;
  price: number | null;
  currency: ServiceCurrency | null;
  note: string;
} {
  let rest = detail;
  let durationMin: number | null = null;
  const durationMatch = /(\d+(?:[.,]\d+)?)\s*(?:minutes|minute|minut|min)\b/i.exec(rest);
  if (durationMatch?.[1]) {
    durationMin = parseDurationValue(durationMatch[1]);
    rest = `${rest.slice(0, durationMatch.index)} ${rest.slice(durationMatch.index + durationMatch[0].length)}`;
  }

  const prefixed = /£\s*(\d+(?:[.,]\d+)?)/.exec(rest);
  const suffixed = /(\d+(?:[.,]\d+)?)\s*(?:(lei|leu|ron|gbp|pounds?)\b|£)/i.exec(rest);
  const hits: { index: number; length: number; amount: string; currency: ServiceCurrency }[] = [];
  if (prefixed?.[1] != null && prefixed.index != null) {
    hits.push({ index: prefixed.index, length: prefixed[0].length, amount: prefixed[1], currency: "GBP" });
  }
  if (suffixed?.[1] != null && suffixed.index != null) {
    const word = suffixed[2]?.toLowerCase();
    const currency = word ? normalizeCurrency(word) : "GBP";
    if (currency) hits.push({ index: suffixed.index, length: suffixed[0].length, amount: suffixed[1], currency });
  }
  hits.sort((a, b) => a.index - b.index);
  const hit = hits[0];
  let price: number | null = null;
  let currency: ServiceCurrency | null = null;
  if (hit) {
    price = parsePriceValue(hit.amount);
    currency = hit.currency;
    rest = `${rest.slice(0, hit.index)} ${rest.slice(hit.index + hit.length)}`;
  }

  const sourceInParens =
    /\((?:£\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(lei|leu|ron|gbp|pounds?|£))\)/i.exec(detail);
  if (sourceInParens) {
    const amount = sourceInParens[1] ?? sourceInParens[2];
    const word = sourceInParens[1] ? "£" : sourceInParens[3];
    const sourceCurrency = word ? normalizeCurrency(word) : null;
    const sourcePrice = amount ? parsePriceValue(amount) : null;
    if (sourcePrice != null && sourceCurrency) {
      price = sourcePrice;
      currency = sourceCurrency;
      rest = rest.replace(sourceInParens[0], " ");
    }
  }

  const note = rest
    .replace(/[·•|]+/g, " ")
    .replace(/[,/]+/g, " ")
    .replace(/\(|\)/g, " ")
    .replace(/(^|\s)[-–—]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return { durationMin, price, currency, note };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function serviceRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (record && Array.isArray(record.services)) return record.services;
  return [];
}

function readService(item: unknown): ServiceItem | null {
  const record = asRecord(item);
  if (!record) return null;
  if ("fx" in record && typeof record.name !== "string") return null;
  const name = String(record.name ?? "")
    .trim()
    .slice(0, 80);
  if (!name) return null;

  const legacyDetail = String(record.detail ?? "")
    .trim()
    .slice(0, 160);
  const legacy = parseLegacyDetail(legacyDetail);
  const durationRaw = "durationMin" in record ? record.durationMin : "durationMinutes" in record ? record.durationMinutes : record.duration;
  const durationMin =
    "durationMin" in record || "durationMinutes" in record || "duration" in record
      ? parseDurationValue(durationRaw)
      : legacy.durationMin;
  const priceRaw = "priceAmount" in record ? record.priceAmount : record.price;
  const price = "priceAmount" in record || "price" in record ? parsePriceValue(priceRaw) : legacy.price;
  const currency =
    normalizeCurrency(record.priceCurrency) ?? normalizeCurrency(record.currency) ?? legacy.currency ?? "RON";
  const note =
    "note" in record
      ? String(record.note ?? "")
          .trim()
          .slice(0, 160)
      : legacy.note;
  const service: ServiceItem = { name, durationMin, price, currency, note, detail: "" };
  service.detail = legacyDetail || formatStoredDetail(service);
  return service;
}

export function parseServices(json: string): ServiceItem[] {
  try {
    const value = JSON.parse(json) as unknown;
    return serviceRows(value)
      .map(readService)
      .filter((item): item is ServiceItem => item != null)
      .slice(0, MAX_SERVICES);
  } catch {
    return [];
  }
}

function readFxNode(value: unknown): { mode?: unknown; ronPerGbp?: unknown } | null {
  const record = asRecord(value);
  if (!record) return null;
  const fx = asRecord(record.fx);
  if (!fx) return null;
  return { mode: fx.mode, ronPerGbp: fx.ronPerGbp };
}

export function parseFxSettings(json: string): FxSettings {
  const live: FxSettings = { mode: "live", ronPerGbp: null };
  try {
    const value = JSON.parse(json) as unknown;
    const nodes = Array.isArray(value) ? value : [value];
    for (const node of nodes) {
      const fx = readFxNode(node);
      if (!fx || fx.mode !== "manual") continue;
      const rate = parseRonPerGbp(fx.ronPerGbp);
      if (rate == null) continue;
      return { mode: "manual", ronPerGbp: rate };
    }
    return live;
  } catch {
    return live;
  }
}

export function serializeServices(
  services: Array<Omit<ServiceItem, "detail"> & { detail?: string }>,
  fx?: FxSettings | null,
) {
  const rows = services
    .map((service) => {
      const next: ServiceItem = {
        name: service.name.trim().slice(0, 80),
        durationMin: service.durationMin,
        price: service.price,
        currency: service.currency === "GBP" ? "GBP" : "RON",
        note: service.note.trim().slice(0, 160),
        detail: "",
      };
      next.detail = formatStoredDetail(next);
      return next;
    })
    .filter((service) => service.name)
    .slice(0, MAX_SERVICES)
    .map((service) => ({
      name: service.name,
      durationMin: service.durationMin,
      price: service.price,
      currency: service.currency,
      priceAmount: service.price,
      priceCurrency: service.currency,
      note: service.note,
      detail: service.detail,
    }));
  if (fx?.mode === "manual" && fx.ronPerGbp != null) {
    return JSON.stringify([...rows, { fx: { mode: "manual", ronPerGbp: fx.ronPerGbp } }]);
  }
  return JSON.stringify(rows);
}

export function servicesFromForm(input: {
  names: string[];
  durations: string[];
  prices: string[];
  currencies: string[];
  notes: string[];
}): { ok: true; services: ServiceItem[] } | { ok: false } {
  const services: ServiceItem[] = [];
  for (let index = 0; index < input.names.length; index += 1) {
    const name = (input.names[index] ?? "").trim().slice(0, 80);
    if (!name) continue;
    const duration = readFormDuration(input.durations[index] ?? "");
    if (duration === "invalid") return { ok: false };
    const price = readFormPrice(input.prices[index] ?? "");
    if (price === "invalid") return { ok: false };
    const currencyRaw = (input.currencies[index] ?? "").trim();
    const currency = currencyRaw ? normalizeCurrency(currencyRaw) : "RON";
    if (!currency) return { ok: false };
    const note = (input.notes[index] ?? "").trim().slice(0, 160);
    const service: ServiceItem = { name, durationMin: duration, price, currency, note, detail: "" };
    service.detail = formatStoredDetail(service);
    services.push(service);
  }
  if (services.length > MAX_SERVICES) return { ok: false };
  return { ok: true, services };
}

export function servicesFromLocaleForm(input: {
  locale: "ro" | "en";
  names: string[];
  durations: string[];
  prices: string[];
  notes: string[];
  touched: string[];
  isNew: string[];
  sourcePrices: string[];
  sourceCurrencies: string[];
}): { ok: true; services: ServiceItem[] } | { ok: false } {
  const active = currencyForLocale(input.locale);
  const services: ServiceItem[] = [];
  for (let index = 0; index < input.names.length; index += 1) {
    const name = (input.names[index] ?? "").trim().slice(0, 80);
    if (!name) continue;
    const duration = readFormDuration(input.durations[index] ?? "");
    if (duration === "invalid") return { ok: false };
    const note = (input.notes[index] ?? "").trim().slice(0, 160);
    const touched = (input.touched[index] ?? "") === "1";
    const isNew = (input.isNew[index] ?? "") === "1";
    let price: number | null;
    let currency: ServiceCurrency;
    if (!touched && isNew) {
      const defaults = defaultNewServicePrice(input.locale);
      price = defaults.price;
      currency = defaults.currency;
    } else if (!touched) {
      const sourcePrice = readFormPrice(input.sourcePrices[index] ?? "");
      if (sourcePrice === "invalid") return { ok: false };
      price = sourcePrice;
      currency = normalizeCurrency(input.sourceCurrencies[index] ?? "") ?? "RON";
    } else {
      const typed = readFormPrice(input.prices[index] ?? "");
      if (typed === "invalid") return { ok: false };
      price = typed;
      currency = active;
    }
    const service: ServiceItem = { name, durationMin: duration, price, currency, note, detail: "" };
    service.detail = formatStoredDetail(service);
    services.push(service);
  }
  if (services.length > MAX_SERVICES) return { ok: false };
  return { ok: true, services };
}

function readFormDuration(raw: string): number | null | "invalid" {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return "invalid";
  const numeric = Number(text);
  if (numeric < 1 || numeric > 24 * 60) return "invalid";
  return numeric;
}

function readFormPrice(raw: string): number | null | "invalid" {
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return "invalid";
  const numeric = Number(text);
  if (numeric < 0 || numeric > 1_000_000) return "invalid";
  return numeric;
}

export function upsertServiceList(
  services: ServiceItem[],
  input: {
    name: string;
    durationMin?: unknown;
    price?: unknown;
    currency?: unknown;
    note?: unknown;
    detail?: unknown;
  },
): { ok: true; services: ServiceItem[] } | { ok: false; error: "required" | "invalid" | "limit" } {
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "required" };
  const index = services.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
  const base = index >= 0 ? services[index] : null;
  if (!base && services.length >= MAX_SERVICES) return { ok: false, error: "limit" };

  const provided = (key: "durationMin" | "price" | "currency" | "note") =>
    input[key] !== undefined && input[key] !== null && String(input[key]).trim() !== "";
  const structured = provided("durationMin") || provided("price") || provided("currency") || provided("note");
  const legacy =
    !structured && input.detail != null && String(input.detail).trim() ? parseLegacyDetail(String(input.detail)) : null;

  let durationMin = base?.durationMin ?? null;
  if (provided("durationMin")) {
    const parsed = parseDurationValue(input.durationMin);
    if (parsed == null) return { ok: false, error: "invalid" };
    durationMin = parsed;
  } else if (legacy) durationMin = legacy.durationMin;

  let price = base?.price ?? null;
  if (provided("price")) {
    const parsed = parsePriceValue(input.price);
    if (parsed == null) return { ok: false, error: "invalid" };
    price = parsed;
  } else if (legacy) price = legacy.price;

  let currency: ServiceCurrency = base?.currency ?? "RON";
  if (provided("currency")) {
    const parsed = normalizeCurrency(input.currency);
    if (!parsed) return { ok: false, error: "invalid" };
    currency = parsed;
  } else if (legacy) currency = legacy.currency ?? "RON";

  let note = base?.note ?? "";
  if (provided("note")) note = String(input.note).trim().slice(0, 160);
  else if (legacy) note = legacy.note;

  const next: ServiceItem = { name, durationMin, price, currency, note, detail: "" };
  next.detail = formatStoredDetail(next);
  const copy = services.slice();
  if (index >= 0) copy[index] = next;
  else copy.push(next);
  return { ok: true, services: copy };
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
