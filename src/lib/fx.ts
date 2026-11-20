export const SERVICE_CURRENCIES = ["RON", "GBP"] as const;
export type ServiceCurrency = (typeof SERVICE_CURRENCIES)[number];

export type FxSource = "live" | "manual" | "env" | "fallback";

export type FxQuote = {
  ronPerGbp: number;
  source: FxSource;
  provider?: string;
  asOf?: string;
};

export type FxSettings = {
  mode: "live" | "manual";
  ronPerGbp: number | null;
};

/** Approximate lei per pound, used only when live FX and any configured rate are unavailable. */
export const FALLBACK_RON_PER_GBP = 5.85;

export type MoneyService = {
  durationMin: number | null;
  price: number | null;
  currency: ServiceCurrency;
  note: string;
};

export type FxLabels = {
  pair: string;
  live: string;
  manual: string;
  env: string;
  fallback: string;
  liveNamed: string;
  line: string;
};

const RATE_MIN = 0.5;
const RATE_MAX = 30;

export function normalizeCurrency(value: unknown): ServiceCurrency | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");
  if (raw === "ron" || raw === "lei" || raw === "leu") return "RON";
  if (raw === "gbp" || raw === "£" || raw === "pound" || raw === "pounds") return "GBP";
  return null;
}

export function displayCurrency(locale: "ro" | "en"): ServiceCurrency {
  return locale === "en" ? "GBP" : "RON";
}

export function parseRonPerGbp(value: unknown): number | null {
  let numeric: number;
  if (typeof value === "number") numeric = value;
  else if (typeof value === "string") {
    const text = value.trim().replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(text)) return null;
    numeric = Number(text);
  } else return null;
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric * 1_000_000) / 1_000_000;
  if (rounded < RATE_MIN || rounded > RATE_MAX) return null;
  return rounded;
}

export function formatRate(rate: number) {
  if (!Number.isFinite(rate)) return "";
  const rounded = Math.round(rate * 1_000_000) / 1_000_000;
  return rounded.toFixed(6).replace(/\.?0+$/, "");
}

export function convertAmount(amount: number, from: ServiceCurrency, to: ServiceCurrency, ronPerGbp: number) {
  if (!Number.isFinite(amount) || !(ronPerGbp > 0) || from === to) return amount;
  if (from === "RON" && to === "GBP") return amount / ronPerGbp;
  return amount * ronPerGbp;
}

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number, currency: ServiceCurrency, locale: "ro" | "en") {
  const rounded = roundMoney(amount);
  const whole = Math.abs(rounded - Math.round(rounded)) < 1e-9;
  if (currency === "GBP") return whole ? `£${Math.round(rounded)}` : `£${rounded.toFixed(2)}`;
  const digits = whole ? String(Math.round(rounded)) : locale === "ro" ? rounded.toFixed(2).replace(".", ",") : rounded.toFixed(2);
  return locale === "ro" ? `${digits} lei` : `${digits} RON`;
}

export function serviceMoney(service: Pick<MoneyService, "price" | "currency">, locale: "ro" | "en", ronPerGbp: number) {
  if (service.price == null) return { label: "", converted: false };
  const target = displayCurrency(locale);
  if (service.currency === target) return { label: formatMoney(service.price, service.currency, locale), converted: false };
  const converted = convertAmount(service.price, service.currency, target, ronPerGbp);
  return { label: formatMoney(converted, target, locale), converted: true };
}

export function formatServiceLine(service: MoneyService, locale: "ro" | "en", ronPerGbp: number) {
  const parts: string[] = [];
  if (service.durationMin != null) parts.push(`${service.durationMin} min`);
  if (service.price != null) {
    const money = serviceMoney(service, locale, ronPerGbp);
    if (money.converted) parts.push(`${money.label} (${formatMoney(service.price, service.currency, locale)})`);
    else parts.push(money.label);
  }
  if (service.note) parts.push(service.note);
  return parts.join(" · ");
}

export function presentServices<T extends MoneyService & { detail: string }>(
  services: T[],
  locale: "ro" | "en",
  ronPerGbp: number,
): T[] {
  return services.map((service) => ({
    ...service,
    detail: formatServiceLine(service, locale, ronPerGbp) || service.detail,
  }));
}

export function fxSourceText(quote: Pick<FxQuote, "source" | "provider">, labels: FxLabels) {
  if (quote.source === "live") {
    return quote.provider ? labels.liveNamed.replace("{provider}", providerLabel(quote.provider)) : labels.live;
  }
  if (quote.source === "manual") return labels.manual;
  if (quote.source === "env") return labels.env;
  return labels.fallback;
}

export function formatFxLine(quote: FxQuote, locale: "ro" | "en", labels: FxLabels) {
  const pair = labels.pair.replace("{rate}", formatRate(quote.ronPerGbp));
  const source = fxSourceText(quote, labels);
  const currency = locale === "en" ? "GBP" : "lei";
  return labels.line.replace("{currency}", currency).replace("{pair}", pair).replace("{source}", source);
}

export function providerLabel(provider: string) {
  if (provider === "frankfurter") return "Frankfurter";
  if (provider === "open.er-api") return "open.er-api";
  return provider;
}

export function fxSettingsFromForm(modeRaw: string, rateRaw: string): { ok: true; settings: FxSettings } | { ok: false } {
  if (modeRaw !== "manual") return { ok: true, settings: { mode: "live", ronPerGbp: null } };
  const rate = parseRonPerGbp(rateRaw);
  if (rate == null) return { ok: false };
  return { ok: true, settings: { mode: "manual", ronPerGbp: rate } };
}

/** Missing form fields keep the stored rate. A posted mode still validates. */
export function fxSettingsForSave(
  submittedMode: string | null,
  submittedRate: string,
  stored: FxSettings,
): { ok: true; settings: FxSettings } | { ok: false } {
  if (submittedMode == null) return { ok: true, settings: stored };
  return fxSettingsFromForm(submittedMode, submittedRate);
}
