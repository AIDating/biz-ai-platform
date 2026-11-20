import { convertAmount, displayCurrency, formatMoney, type ServiceCurrency } from "@/lib/fx";

/**
 * Advertising analytics behind a provider interface.
 * `SimulatedMarketingAnalyticsProvider` is the only implementation today.
 * A live reporting provider can replace it without changing the dashboard math.
 */

export const ANALYTICS_PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "google_ads"] as const;
export type AnalyticsPlatform = (typeof ANALYTICS_PLATFORMS)[number];

export const ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const ANALYTICS_METRICS = ["impressions", "clicks", "spend", "conversions"] as const;
export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

export const ANALYTICS_SERIES_DAYS = 90;

export const ANALYTICS_PLATFORM_COLORS: Record<AnalyticsPlatform, string> = {
  facebook: "#1877F2",
  instagram: "#C13584",
  tiktok: "#111111",
  youtube: "#e10600",
  google_ads: "#188038",
};

export type DailyMetrics = {
  date: string;
  impressions: number;
  clicks: number;
  /** Spend stored in RON. Display converts with the dashboard FX helper. */
  spendRon: number;
  conversions: number;
};

export type AnalyticsSource = "simulated" | "live";

export type PlatformDailySeries = {
  platform: AnalyticsPlatform;
  source: AnalyticsSource;
  days: DailyMetrics[];
};

export type AnalyticsQuery = {
  asOf: Date;
  days?: number;
};

export interface MarketingAnalyticsProvider {
  getDailySeries(query: AnalyticsQuery): PlatformDailySeries[] | Promise<PlatformDailySeries[]>;
}

export type AnalyticsSelection = {
  platform: AnalyticsPlatform | "all";
  range: AnalyticsRange;
};

export type KpiSummary = {
  impressions: number;
  clicks: number;
  spendRon: number;
  conversions: number;
  ctr: number | null;
  cpcRon: number | null;
  cpaRon: number | null;
};

export type TrendPoint = { date: string; value: number };

export type PlatformComparisonPoint = { platform: AnalyticsPlatform; value: number };

export type PlatformBreakdownRow = {
  platform: AnalyticsPlatform;
  status: "connected" | "simulated";
  impressions: number;
  clicks: number;
  spendRon: number;
  conversions: number;
  ctr: number | null;
  cpcRon: number | null;
  cpaRon: number | null;
};

export type AnalyticsServiceOffer = {
  id: string;
  name: string;
  source: "tenant" | "default";
};

export type ServiceRankRow = {
  rank: number;
  id: string;
  name: string;
  source: "tenant" | "default";
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number | null;
  share: number;
  topPlatform: AnalyticsPlatform;
  clicksByPlatform: Record<AnalyticsPlatform, number>;
};

export const DEFAULT_SERVICE_OFFERS: Record<"ro" | "en", readonly string[]> = {
  ro: ["Consultație", "Pachet de început", "Ofertă lunară", "Serviciu premium", "Promoție de sezon"],
  en: ["Consultation", "Starter package", "Monthly offer", "Premium service", "Seasonal promotion"],
};

const PROFILES: Record<AnalyticsPlatform, { impressions: number; ctr: number; cpcRon: number; cvr: number }> = {
  facebook: { impressions: 1860, ctr: 0.0185, cpcRon: 0.85, cvr: 0.046 },
  instagram: { impressions: 2340, ctr: 0.0142, cpcRon: 1.12, cvr: 0.039 },
  tiktok: { impressions: 6420, ctr: 0.0091, cpcRon: 0.42, cvr: 0.023 },
  youtube: { impressions: 3180, ctr: 0.0074, cpcRon: 1.58, cvr: 0.032 },
  google_ads: { impressions: 940, ctr: 0.046, cpcRon: 2.35, cvr: 0.084 },
};

const MONTHS_RO = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isAnalyticsPlatform(value: string): value is AnalyticsPlatform {
  return (ANALYTICS_PLATFORMS as readonly string[]).includes(value);
}

export function rangeLength(range: AnalyticsRange): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return ANALYTICS_SERIES_DAYS;
}

export function utcIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function enumerateDates(asOf: Date, days: number): string[] {
  const count = Math.max(1, Math.min(366, Math.floor(days)));
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const dates: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(end);
    cursor.setUTCDate(cursor.getUTCDate() - offset);
    dates.push(utcIsoDate(cursor));
  }
  return dates;
}

export class SimulatedMarketingAnalyticsProvider implements MarketingAnalyticsProvider {
  getDailySeries(query: AnalyticsQuery): PlatformDailySeries[] {
    return buildSimulatedSeries(query);
  }
}

export const simulatedMarketingAnalytics = new SimulatedMarketingAnalyticsProvider();

export function buildSimulatedSeries(query: AnalyticsQuery): PlatformDailySeries[] {
  const days = query.days ?? ANALYTICS_SERIES_DAYS;
  const dates = enumerateDates(query.asOf, days);
  return ANALYTICS_PLATFORMS.map((platform) => ({
    platform,
    source: "simulated" as const,
    days: dates.map((date, index) => dailyMetrics(platform, date, index, dates.length)),
  }));
}

export function selectSeries(series: PlatformDailySeries[], selection: AnalyticsSelection): PlatformDailySeries[] {
  const count = rangeLength(selection.range);
  const chosen =
    selection.platform === "all" ? series : series.filter((item) => item.platform === selection.platform);
  return chosen.map((item) => ({ ...item, days: item.days.slice(-count) }));
}

export function platformsInSelection(selection: AnalyticsSelection): readonly AnalyticsPlatform[] {
  return selection.platform === "all" ? ANALYTICS_PLATFORMS : [selection.platform];
}

export function aggregateKpis(series: PlatformDailySeries[], selection: AnalyticsSelection): KpiSummary {
  const totals = emptyTotals();
  for (const item of selectSeries(series, selection)) addDays(totals, item.days);
  return withRates(totals);
}

export function dailyTrend(
  series: PlatformDailySeries[],
  selection: AnalyticsSelection,
  metric: AnalyticsMetric,
): TrendPoint[] {
  const selected = selectSeries(series, selection);
  const dates = selected[0]?.days.map((day) => day.date) ?? [];
  return dates.map((date) => {
    const value = selected.reduce((sum, item) => {
      const point = item.days.find((day) => day.date === date);
      return sum + (point ? metricValue(point, metric) : 0);
    }, 0);
    return { date, value: metric === "spend" ? toBani(value) / 100 : value };
  });
}

export function platformComparison(
  series: PlatformDailySeries[],
  selection: AnalyticsSelection,
  metric: AnalyticsMetric,
): PlatformComparisonPoint[] {
  const count = rangeLength(selection.range);
  return platformsInSelection(selection).map((platform) => {
    const row = series.find((item) => item.platform === platform);
    const days = row?.days.slice(-count) ?? [];
    const value = days.reduce((sum, day) => sum + metricValue(day, metric), 0);
    return { platform, value: metric === "spend" ? toBani(value) / 100 : value };
  });
}

export function connectionMap(
  rows: { channel: string; enabled: boolean }[] | null | undefined,
): Record<AnalyticsPlatform, boolean> {
  const map: Record<AnalyticsPlatform, boolean> = {
    facebook: false,
    instagram: false,
    tiktok: false,
    youtube: false,
    google_ads: false,
  };
  for (const row of rows ?? []) {
    if (!row || !isAnalyticsPlatform(row.channel) || !row.enabled) continue;
    map[row.channel] = true;
  }
  return map;
}

export function platformBreakdown(
  series: PlatformDailySeries[],
  selection: AnalyticsSelection,
  connections?: Partial<Record<AnalyticsPlatform, boolean>> | null,
): PlatformBreakdownRow[] {
  const count = rangeLength(selection.range);
  return platformsInSelection(selection).map((platform) => {
    const row = series.find((item) => item.platform === platform);
    const totals = emptyTotals();
    addDays(totals, row?.days.slice(-count) ?? []);
    const rates = withRates(totals);
    return {
      platform,
      status: connections?.[platform] ? "connected" : "simulated",
      ...rates,
    };
  });
}

export function resolveAnalyticsServices(
  services: { name: string }[] | null | undefined,
  locale: "ro" | "en",
): AnalyticsServiceOffer[] {
  const seen = new Set<string>();
  const offers: AnalyticsServiceOffer[] = [];
  for (const service of services ?? []) {
    const name = String(service?.name ?? "").trim().slice(0, 80);
    if (!name) continue;
    const id = name.toLocaleLowerCase("ro");
    if (seen.has(id)) continue;
    seen.add(id);
    offers.push({ id, name, source: "tenant" });
    if (offers.length >= 30) break;
  }
  if (offers.length > 0) return offers;
  return DEFAULT_SERVICE_OFFERS[locale].map((name) => ({
    id: `default:${name.toLocaleLowerCase(locale)}`,
    name,
    source: "default" as const,
  }));
}

export function rankClickedServices(input: {
  series: PlatformDailySeries[];
  services: { name: string }[] | null | undefined;
  locale: "ro" | "en";
  selection: AnalyticsSelection;
}): ServiceRankRow[] {
  const offers = resolveAnalyticsServices(input.services, input.locale);
  const selectedPlatforms = platformsInSelection(input.selection);
  const windowed = selectSeries(input.series, { platform: "all", range: input.selection.range });
  const buckets = new Map<string, ServiceBucket>();
  for (const offer of offers) buckets.set(offer.id, emptyBucket());

  for (const item of windowed) {
    if (!selectedPlatforms.includes(item.platform)) continue;
    for (const day of item.days) {
      const parts = attributeDay(day, item.platform, offers.map((offer) => offer.id));
      for (const part of parts) {
        const bucket = buckets.get(part.id);
        if (!bucket) continue;
        bucket.clicks += part.clicks;
        bucket.impressions += part.impressions;
        bucket.conversions += part.conversions;
        bucket.byPlatform[item.platform] += part.clicks;
      }
    }
  }

  const totalClicks = [...buckets.values()].reduce((sum, bucket) => sum + bucket.clicks, 0);
  const ranked = offers.map((offer) => {
    const bucket = buckets.get(offer.id) ?? emptyBucket();
    return {
      rank: 0,
      id: offer.id,
      name: offer.name,
      source: offer.source,
      clicks: bucket.clicks,
      impressions: bucket.impressions,
      conversions: bucket.conversions,
      ctr: bucket.impressions > 0 ? bucket.clicks / bucket.impressions : null,
      share: totalClicks > 0 ? bucket.clicks / totalClicks : 0,
      topPlatform: topPlatform(bucket.byPlatform, selectedPlatforms),
      clicksByPlatform: bucket.byPlatform,
    };
  });

  ranked.sort((a, b) => b.clicks - a.clicks || a.name.localeCompare(b.name, input.locale) || a.id.localeCompare(b.id));
  return ranked.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function formatAnalyticsSpend(spendRon: number, locale: "ro" | "en", ronPerGbp: number): string {
  const currency: ServiceCurrency = displayCurrency(locale);
  const amount = convertAmount(spendRon, "RON", currency, ronPerGbp);
  return formatMoney(amount, currency, locale);
}

export function formatAnalyticsCount(value: number, locale: "ro" | "en"): string {
  const negative = value < 0;
  const grouped = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, locale === "ro" ? "." : ",");
  return negative ? `-${grouped}` : grouped;
}

export function formatAnalyticsPercent(ratio: number, locale: "ro" | "en"): string {
  const percent = Math.round((ratio * 100 + Number.EPSILON) * 100) / 100;
  const text = percent.toFixed(2);
  return locale === "ro" ? `${text.replace(".", ",")}%` : `${text}%`;
}

export function formatAnalyticsDate(isoDate: string, locale: "ro" | "en"): string {
  const [year, month, day] = isoDate.split("-");
  const names = locale === "ro" ? MONTHS_RO : MONTHS_EN;
  const label = names[Number(month) - 1] ?? month;
  return `${Number(day)} ${label} ${year}`;
}

export function formatAnalyticsDateShort(isoDate: string, locale: "ro" | "en"): string {
  const [, month, day] = isoDate.split("-");
  const names = locale === "ro" ? MONTHS_RO : MONTHS_EN;
  const label = names[Number(month) - 1] ?? month;
  return `${Number(day)} ${label}`;
}

function dailyMetrics(platform: AnalyticsPlatform, date: string, index: number, total: number): DailyMetrics {
  const profile = PROFILES[platform];
  const wave = 1 + Math.sin((index / Math.max(total, 1)) * Math.PI * 2) * 0.07;
  const impressions = Math.max(
    1,
    Math.round(profile.impressions * weekdayFactor(date) * wave * jitter(`${platform}|${date}|imp`, 0.12)),
  );
  const ctr = clamp(profile.ctr * jitter(`${platform}|${date}|ctr`, 0.1), 0.002, 0.25);
  const clicks = Math.min(impressions, Math.round(impressions * ctr));
  const cpcRon = round2(Math.max(0.01, profile.cpcRon * jitter(`${platform}|${date}|cpc`, 0.08)));
  const spendRon = round2(clicks * cpcRon);
  const cvr = clamp(profile.cvr * jitter(`${platform}|${date}|cvr`, 0.12), 0, 0.6);
  const conversions = Math.min(clicks, Math.round(clicks * cvr));
  return { date, impressions, clicks, spendRon, conversions };
}

function weekdayFactor(isoDate: string): number {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  if (day === 0) return 0.84;
  if (day === 6) return 1.14;
  if (day === 5) return 1.06;
  return 1;
}

function attributeDay(day: DailyMetrics, platform: AnalyticsPlatform, serviceIds: string[]) {
  const clicks = allocate(
    day.clicks,
    serviceIds.map((id) => 40 + (hashSeed(`${id}|${platform}|weight`) % 960)),
  );
  const platformCtr = day.impressions > 0 ? day.clicks / day.impressions : 0.01;
  const platformCvr = day.clicks > 0 ? day.conversions / day.clicks : 0;
  return serviceIds.map((id, index) => {
    const clickCount = clicks[index] ?? 0;
    const ctrFactor = 0.72 + (hashSeed(`${id}|${platform}|ctr`) % 500) / 1000;
    const targetCtr = clamp(platformCtr * ctrFactor, 0.002, 0.4);
    const impressions = clickCount === 0 ? 0 : Math.max(clickCount, Math.round(clickCount / targetCtr));
    const cvrFactor = 0.6 + (hashSeed(`${id}|${platform}|cvr`) % 700) / 1000;
    const conversions = Math.min(clickCount, Math.round(clickCount * clamp(platformCvr * cvrFactor, 0, 0.95)));
    return { id, clicks: clickCount, impressions, conversions };
  });
}

type Totals = { impressions: number; clicks: number; spendBani: number; conversions: number };

function emptyTotals(): Totals {
  return { impressions: 0, clicks: 0, spendBani: 0, conversions: 0 };
}

function addDays(totals: Totals, days: DailyMetrics[]) {
  for (const day of days) {
    totals.impressions += day.impressions;
    totals.clicks += day.clicks;
    totals.spendBani += toBani(day.spendRon);
    totals.conversions += day.conversions;
  }
}

function withRates(totals: Totals): KpiSummary {
  const spendRon = totals.spendBani / 100;
  return {
    impressions: totals.impressions,
    clicks: totals.clicks,
    spendRon,
    conversions: totals.conversions,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : null,
    cpcRon: totals.clicks > 0 ? spendRon / totals.clicks : null,
    cpaRon: totals.conversions > 0 ? spendRon / totals.conversions : null,
  };
}

function toBani(ron: number): number {
  return Math.round((ron + Number.EPSILON) * 100);
}

function metricValue(day: DailyMetrics, metric: AnalyticsMetric): number {
  if (metric === "impressions") return day.impressions;
  if (metric === "clicks") return day.clicks;
  if (metric === "spend") return day.spendRon;
  return day.conversions;
}

type ServiceBucket = {
  clicks: number;
  impressions: number;
  conversions: number;
  byPlatform: Record<AnalyticsPlatform, number>;
};

function emptyBucket(): ServiceBucket {
  return {
    clicks: 0,
    impressions: 0,
    conversions: 0,
    byPlatform: { facebook: 0, instagram: 0, tiktok: 0, youtube: 0, google_ads: 0 },
  };
}

function topPlatform(clicks: Record<AnalyticsPlatform, number>, candidates: readonly AnalyticsPlatform[]): AnalyticsPlatform {
  return candidates.reduce((best, platform) => (clicks[platform] > clicks[best] ? platform : best), candidates[0]);
}

function allocate(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (total <= 0) return weights.map(() => 0);
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / sum);
  const floors = exact.map((value) => Math.floor(value));
  let left = total - floors.reduce((acc, value) => acc + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  let cursor = 0;
  while (left > 0 && order.length > 0) {
    floors[order[cursor % order.length].index] += 1;
    left -= 1;
    cursor += 1;
  }
  return floors;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function jitter(key: string, spread: number): number {
  return 1 - spread + ((hashSeed(key) % 10000) / 10000) * spread * 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
