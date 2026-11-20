import { describe, expect, it } from "vitest";
import { convertAmount, displayCurrency, FALLBACK_RON_PER_GBP, formatMoney } from "@/lib/fx";
import {
  ANALYTICS_PLATFORMS,
  ANALYTICS_SERIES_DAYS,
  aggregateKpis,
  buildSimulatedSeries,
  connectionMap,
  dailyTrend,
  DEFAULT_SERVICE_OFFERS,
  formatAnalyticsCount,
  formatAnalyticsDate,
  formatAnalyticsPercent,
  formatAnalyticsSpend,
  platformBreakdown,
  platformComparison,
  rankClickedServices,
  resolveAnalyticsServices,
  selectSeries,
  SimulatedMarketingAnalyticsProvider,
  type AnalyticsPlatform,
  type AnalyticsRange,
} from "@/lib/marketing-analytics";
import { parseServices } from "@/lib/services";

const AS_OF = new Date("2026-06-15T12:00:00Z");
const RATE = FALLBACK_RON_PER_GBP;

const SALON_JSON = JSON.stringify([
  { name: "Tuns femei", detail: "45 min · 120 lei" },
  { name: "Vopsit", detail: "90 min · de la 250 lei" },
  { name: "Coafat ocazie", detail: "60 min · 180 lei" },
  { name: "Manichiură", detail: "45 min · 80 lei" },
]);

function series() {
  return buildSimulatedSeries({ asOf: AS_OF, days: ANALYTICS_SERIES_DAYS });
}

function clicksOf(rows: { clicks: number }[]) {
  return rows.reduce((sum, row) => sum + row.clicks, 0);
}

describe("simulated marketing analytics", () => {
  it("covers all five platforms with a deterministic 90-day series", () => {
    const first = series();
    const second = buildSimulatedSeries({ asOf: new Date("2026-06-15T23:30:00Z") });
    expect(first.map((item) => item.platform)).toEqual([...ANALYTICS_PLATFORMS]);
    expect(first).toEqual(second);
    expect(new SimulatedMarketingAnalyticsProvider().getDailySeries({ asOf: AS_OF })).toEqual(first);

    for (const item of first) {
      expect(item.source).toBe("simulated");
      expect(item.days).toHaveLength(90);
      expect(item.days.at(-1)?.date).toBe("2026-06-15");
      for (let index = 1; index < item.days.length; index += 1) {
        const previous = Date.parse(`${item.days[index - 1].date}T00:00:00Z`);
        const current = Date.parse(`${item.days[index].date}T00:00:00Z`);
        expect(current - previous).toBe(86_400_000);
        const day = item.days[index];
        expect(day.impressions).toBeGreaterThan(0);
        expect(day.clicks).toBeGreaterThan(0);
        expect(day.clicks).toBeLessThanOrEqual(day.impressions);
        expect(day.conversions).toBeGreaterThanOrEqual(0);
        expect(day.conversions).toBeLessThanOrEqual(day.clicks);
        expect(day.spendRon).toBeGreaterThan(0);
      }
    }

    const shifted = buildSimulatedSeries({ asOf: new Date("2026-06-16T00:00:00Z") });
    expect(shifted[0].days.at(-1)?.date).toBe("2026-06-16");
    expect(shifted).not.toEqual(first);
  });

  it("aggregates 7, 30, and 90 days and keeps single-platform totals inside the all-platform total", () => {
    const data = series();
    const ranges: AnalyticsRange[] = ["7d", "30d", "90d"];
    const totals = ranges.map((range) => aggregateKpis(data, { platform: "all", range }));
    expect(selectSeries(data, { platform: "all", range: "7d" })[0].days).toHaveLength(7);
    expect(selectSeries(data, { platform: "facebook", range: "30d" })[0].days).toHaveLength(30);
    expect(selectSeries(data, { platform: "all", range: "90d" })[0].days).toHaveLength(90);
    expect(data[0].days).toHaveLength(90);

    expect(totals[0].impressions).toBeLessThan(totals[1].impressions);
    expect(totals[1].impressions).toBeLessThan(totals[2].impressions);
    expect(totals[0].clicks).toBeLessThan(totals[1].clicks);
    expect(totals[1].spendRon).toBeLessThan(totals[2].spendRon);

    for (const range of ranges) {
      const all = aggregateKpis(data, { platform: "all", range });
      const parts = ANALYTICS_PLATFORMS.map((platform) => aggregateKpis(data, { platform, range }));
      expect(parts.reduce((sum, part) => sum + part.impressions, 0)).toBe(all.impressions);
      expect(parts.reduce((sum, part) => sum + part.clicks, 0)).toBe(all.clicks);
      expect(parts.reduce((sum, part) => sum + part.conversions, 0)).toBe(all.conversions);
      expect(parts.reduce((sum, part) => sum + Math.round(part.spendRon * 100), 0)).toBe(Math.round(all.spendRon * 100));
      expect(all.ctr).toBe(all.clicks / all.impressions);
      expect(all.cpcRon).toBeCloseTo(all.spendRon / all.clicks, 8);
      expect(all.cpaRon).toBeCloseTo(all.spendRon / all.conversions, 8);
      expect(all.cpcRon).not.toBeNull();
      expect(all.cpaRon).not.toBeNull();
    }

    const facebook = aggregateKpis(data, { platform: "facebook", range: "30d" });
    const everyone = aggregateKpis(data, { platform: "all", range: "30d" });
    expect(facebook.impressions).toBeGreaterThan(0);
    expect(facebook.impressions).toBeLessThan(everyone.impressions);
    expect(facebook.clicks).toBeLessThan(everyone.clicks);
    expect(facebook.spendRon).toBeLessThan(everyone.spendRon);
  });

  it("builds aligned daily trends and platform comparisons for every metric", () => {
    const data = series();
    const trend = dailyTrend(data, { platform: "all", range: "7d" }, "clicks");
    expect(trend.map((point) => point.date)).toEqual(data[0].days.slice(-7).map((day) => day.date));
    expect(trend[0].value).toBe(
      data.reduce((sum, item) => sum + (item.days.find((day) => day.date === trend[0].date)?.clicks ?? 0), 0),
    );

    const comparison = platformComparison(data, { platform: "all", range: "30d" }, "impressions");
    expect(comparison.map((point) => point.platform)).toEqual([...ANALYTICS_PLATFORMS]);
    const youtube = platformComparison(data, { platform: "youtube", range: "30d" }, "clicks");
    expect(youtube).toHaveLength(1);
    expect(youtube[0].value).toBe(aggregateKpis(data, { platform: "youtube", range: "30d" }).clicks);

    const spend = platformComparison(data, { platform: "google_ads", range: "7d" }, "spend");
    expect(spend[0].value).toBeCloseTo(aggregateKpis(data, { platform: "google_ads", range: "7d" }).spendRon, 8);
  });

  it("formats RON for Romanian and GBP for English with the FX helper", () => {
    expect(displayCurrency("ro")).toBe("RON");
    expect(displayCurrency("en")).toBe("GBP");
    expect(formatAnalyticsSpend(100, "ro", RATE)).toBe(formatMoney(100, "RON", "ro"));
    expect(formatAnalyticsSpend(100, "ro", RATE)).toBe("100 lei");
    expect(formatAnalyticsSpend(10.5, "ro", RATE)).toBe("10,50 lei");
    expect(formatAnalyticsSpend(0, "en", RATE)).toBe("£0");
    expect(formatAnalyticsSpend(RATE, "en", RATE)).toBe("£1");
    expect(formatAnalyticsSpend(1234.5, "en", RATE)).toBe(
      formatMoney(convertAmount(1234.5, "RON", "GBP", RATE), "GBP", "en"),
    );
    expect(formatAnalyticsSpend(1234.5, "en", RATE)).toBe("£211.03");
    expect(formatAnalyticsCount(1234567, "ro")).toBe("1.234.567");
    expect(formatAnalyticsCount(1234567, "en")).toBe("1,234,567");
    expect(formatAnalyticsPercent(0.01234, "ro")).toBe("1,23%");
    expect(formatAnalyticsPercent(0.01234, "en")).toBe("1.23%");
    expect(formatAnalyticsDate("2026-06-15", "ro")).toBe("15 iun. 2026");
    expect(formatAnalyticsDate("2026-06-15", "en")).toBe("15 Jun 2026");
  });

  it("reads connection status from integration rows and stays simulated when none are connected", () => {
    expect(connectionMap(null)).toEqual({
      facebook: false,
      instagram: false,
      tiktok: false,
      youtube: false,
      google_ads: false,
    });
    expect(connectionMap([])).toEqual(connectionMap(undefined));
    const map = connectionMap([
      { channel: "facebook", enabled: true },
      { channel: "youtube", enabled: false },
      { channel: "marketing_brief", enabled: true },
      { channel: "google_ads", enabled: true },
    ]);
    expect(map.facebook).toBe(true);
    expect(map.google_ads).toBe(true);
    expect(map.youtube).toBe(false);
    expect(map.instagram).toBe(false);
    expect(map.tiktok).toBe(false);

    const data = series();
    const empty = platformBreakdown(data, { platform: "all", range: "90d" }, connectionMap([]));
    expect(empty).toHaveLength(5);
    expect(empty.every((row) => row.status === "simulated")).toBe(true);
    const linked = platformBreakdown(data, { platform: "all", range: "90d" }, map);
    expect(linked.find((row) => row.platform === "facebook")?.status).toBe("connected");
    expect(linked.find((row) => row.platform === "tiktok")?.status).toBe("simulated");
    expect(platformBreakdown(data, { platform: "instagram", range: "7d" }, map)).toHaveLength(1);
  });
});

describe("most clicked services", () => {
  const data = series();

  it("uses tenant service names and falls back when none are configured", () => {
    const salon = parseServices(SALON_JSON);
    expect(salon.map((service) => service.name)).toEqual(["Tuns femei", "Vopsit", "Coafat ocazie", "Manichiură"]);
    const ranked = rankClickedServices({
      series: data,
      services: salon,
      locale: "en",
      selection: { platform: "all", range: "30d" },
    });
    expect(ranked.every((row) => row.source === "tenant")).toBe(true);
    expect(ranked.map((row) => row.name).sort()).toEqual(salon.map((service) => service.name).sort());

    const blank = resolveAnalyticsServices([{ name: "  " }, { name: "" }], "ro");
    expect(blank.map((offer) => offer.name)).toEqual([...DEFAULT_SERVICE_OFFERS.ro]);
    expect(blank.every((offer) => offer.source === "default")).toBe(true);

    const romanian = rankClickedServices({
      series: data,
      services: [],
      locale: "ro",
      selection: { platform: "all", range: "7d" },
    });
    const english = rankClickedServices({
      series: data,
      services: null,
      locale: "en",
      selection: { platform: "all", range: "7d" },
    });
    expect(new Set(romanian.map((row) => row.name))).toEqual(new Set(DEFAULT_SERVICE_OFFERS.ro));
    expect(new Set(english.map((row) => row.name))).toEqual(new Set(DEFAULT_SERVICE_OFFERS.en));
    expect(romanian.every((row) => row.source === "default")).toBe(true);
    expect(resolveAnalyticsServices([{ name: "Tuns femei" }, { name: "tuns femei" }], "ro")).toHaveLength(1);
  });

  it("ranks by clicks descending and updates across platforms and date ranges", () => {
    const salon = parseServices(SALON_JSON);
    const ranked = rankClickedServices({
      series: data,
      services: salon,
      locale: "ro",
      selection: { platform: "all", range: "30d" },
    });
    expect(ranked[0].rank).toBe(1);
    for (let index = 1; index < ranked.length; index += 1) {
      expect(ranked[index - 1].clicks).toBeGreaterThanOrEqual(ranked[index].clicks);
      expect(ranked[index].rank).toBe(index + 1);
      if (ranked[index - 1].clicks === ranked[index].clicks) {
        expect(ranked[index - 1].name.localeCompare(ranked[index].name, "ro")).toBeLessThanOrEqual(0);
      }
    }
    expect(clicksOf(ranked)).toBe(aggregateKpis(data, { platform: "all", range: "30d" }).clicks);
    expect(ranked.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 8);

    for (const row of ranked) {
      expect(row.impressions).toBeGreaterThan(0);
      expect(row.ctr).toBeCloseTo(row.clicks / row.impressions, 8);
      expect(row.conversions).toBeLessThanOrEqual(row.clicks);
      const best = ANALYTICS_PLATFORMS.reduce((winner, platform) =>
        row.clicksByPlatform[platform] > row.clicksByPlatform[winner] ? platform : winner,
      );
      expect(row.topPlatform).toBe(best);
    }

    const week = rankClickedServices({
      series: data,
      services: salon,
      locale: "ro",
      selection: { platform: "all", range: "7d" },
    });
    const quarter = rankClickedServices({
      series: data,
      services: salon,
      locale: "ro",
      selection: { platform: "all", range: "90d" },
    });
    expect(clicksOf(week)).toBeLessThan(clicksOf(ranked));
    expect(clicksOf(ranked)).toBeLessThan(clicksOf(quarter));
    expect(week.map((row) => row.clicks)).not.toEqual(quarter.map((row) => row.clicks));

    const facebook = rankClickedServices({
      series: data,
      services: salon,
      locale: "ro",
      selection: { platform: "facebook", range: "30d" },
    });
    const tiktok = rankClickedServices({
      series: data,
      services: salon,
      locale: "ro",
      selection: { platform: "tiktok", range: "30d" },
    });
    expect(facebook.map((row) => row.clicks)).not.toEqual(tiktok.map((row) => row.clicks));
    expect(clicksOf(facebook)).toBe(aggregateKpis(data, { platform: "facebook", range: "30d" }).clicks);
    expect(clicksOf(facebook)).toBeLessThan(clicksOf(ranked));
    expect(facebook.every((row) => row.topPlatform === "facebook")).toBe(true);
    expect(tiktok.every((row) => row.topPlatform === "tiktok")).toBe(true);

    const again = rankClickedServices({
      series: data,
      services: salon,
      locale: "ro",
      selection: { platform: "all", range: "30d" },
    });
    expect(again).toEqual(ranked);
  });

  it("changes the leader when the platform filter changes the click mix", () => {
    const salon = parseServices(SALON_JSON);
    const leaders = ANALYTICS_PLATFORMS.map((platform: AnalyticsPlatform) => {
      const rows = rankClickedServices({
        series: data,
        services: salon,
        locale: "ro",
        selection: { platform, range: "90d" },
      });
      return rows[0].name;
    });
    expect(new Set(leaders).size).toBeGreaterThan(1);
  });
});
