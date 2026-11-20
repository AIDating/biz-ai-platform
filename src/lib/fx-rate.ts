import {
  FALLBACK_RON_PER_GBP,
  parseRonPerGbp,
  presentServices,
  type FxQuote,
  type FxSettings,
} from "@/lib/fx";
import { parseFxSettings, parseServices, type ServiceItem } from "@/lib/services";

const FETCH_TIMEOUT_MS = 1200;
const LIVE_TTL_MS = 60 * 60 * 1000;
const MISS_TTL_MS = 5 * 60 * 1000;

type LiveHit = { ronPerGbp: number; expiresAt: number; provider: string; asOf?: string };

let liveCache: LiveHit | null = null;
let missUntil = 0;

type RateReader = (data: unknown) => { rate: number; asOf?: string } | null;

const PROVIDERS: { id: string; url: string; read: RateReader }[] = [
  {
    id: "frankfurter",
    url: "https://api.frankfurter.app/latest?from=GBP&to=RON",
    read: (data) => {
      if (!data || typeof data !== "object") return null;
      const record = data as { rates?: { RON?: unknown }; date?: unknown };
      const rate = parseRonPerGbp(record.rates?.RON);
      if (rate == null) return null;
      return { rate, asOf: typeof record.date === "string" ? record.date : undefined };
    },
  },
  {
    id: "open.er-api",
    url: "https://open.er-api.com/v6/latest/GBP",
    read: (data) => {
      if (!data || typeof data !== "object") return null;
      const record = data as { result?: unknown; rates?: { RON?: unknown }; time_last_update_utc?: unknown };
      if (record.result != null && record.result !== "success") return null;
      const rate = parseRonPerGbp(record.rates?.RON);
      if (rate == null) return null;
      return {
        rate,
        asOf: typeof record.time_last_update_utc === "string" ? record.time_last_update_utc : undefined,
      };
    },
  },
];

export function clearFxCache() {
  liveCache = null;
  missUntil = 0;
}

export function readEnvRonPerGbp() {
  return parseRonPerGbp(process.env.FX_RON_PER_GBP);
}

export async function resolveFxQuote(
  settings?: FxSettings | null,
  options?: { fetchImpl?: typeof fetch; now?: number },
): Promise<FxQuote> {
  if (settings?.mode === "manual" && settings.ronPerGbp != null) {
    const manual = parseRonPerGbp(settings.ronPerGbp);
    if (manual != null) return { ronPerGbp: manual, source: "manual" };
  }
  const envRate = readEnvRonPerGbp();
  if (envRate != null) return { ronPerGbp: envRate, source: "env" };

  const now = options?.now ?? Date.now();
  if (liveCache && liveCache.expiresAt > now) {
    return { ronPerGbp: liveCache.ronPerGbp, source: "live", provider: liveCache.provider, asOf: liveCache.asOf };
  }
  if (now < missUntil) return { ronPerGbp: FALLBACK_RON_PER_GBP, source: "fallback" };

  const fetchImpl = options?.fetchImpl ?? fetch;
  for (const provider of PROVIDERS) {
    try {
      const response = await fetchImpl(provider.url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) continue;
      const data = (await response.json()) as unknown;
      const parsed = provider.read(data);
      if (!parsed) continue;
      liveCache = {
        ronPerGbp: parsed.rate,
        expiresAt: now + LIVE_TTL_MS,
        provider: provider.id,
        asOf: parsed.asOf,
      };
      missUntil = 0;
      return { ronPerGbp: parsed.rate, source: "live", provider: provider.id, asOf: parsed.asOf };
    } catch {
      continue;
    }
  }
  missUntil = now + MISS_TTL_MS;
  return { ronPerGbp: FALLBACK_RON_PER_GBP, source: "fallback" };
}

export async function quoteServices(json: string, locale: "ro" | "en", options?: { fetchImpl?: typeof fetch }) {
  const services = parseServices(json);
  const settings = parseFxSettings(json);
  const quote = await resolveFxQuote(settings, options);
  return {
    services,
    settings,
    quote,
    presented: presentServices(services, locale, quote.ronPerGbp),
  };
}

export type QuotedServices = {
  services: ServiceItem[];
  settings: FxSettings;
  quote: FxQuote;
  presented: ServiceItem[];
};
