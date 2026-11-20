"use client";

import { useMemo, useState } from "react";
import { PerformanceTrendChart, PlatformComparisonChart } from "@/components/analytics-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/ro";
import { cn } from "@/lib/cn";
import {
  ANALYTICS_METRICS,
  ANALYTICS_PLATFORM_COLORS,
  ANALYTICS_PLATFORMS,
  ANALYTICS_RANGES,
  aggregateKpis,
  dailyTrend,
  formatAnalyticsCount,
  formatAnalyticsDate,
  formatAnalyticsPercent,
  formatAnalyticsSpend,
  platformBreakdown,
  platformComparison,
  rankClickedServices,
  type AnalyticsMetric,
  type AnalyticsPlatform,
  type AnalyticsRange,
  type PlatformDailySeries,
} from "@/lib/marketing-analytics";

type Copy = Dictionary["analytics"];

export function AnalyticsDashboard({
  copy,
  locale,
  series,
  services,
  connections,
  ronPerGbp,
  fxLine,
}: {
  copy: Copy;
  locale: "ro" | "en";
  series: PlatformDailySeries[];
  services: { name: string }[];
  connections: Record<AnalyticsPlatform, boolean>;
  ronPerGbp: number;
  fxLine: string;
}) {
  const [platform, setPlatform] = useState<AnalyticsPlatform | "all">("all");
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [metric, setMetric] = useState<AnalyticsMetric>("impressions");
  const selection = useMemo(() => ({ platform, range }), [platform, range]);

  const kpis = useMemo(() => aggregateKpis(series, selection), [series, selection]);
  const trend = useMemo(() => dailyTrend(series, selection, metric), [series, selection, metric]);
  const comparison = useMemo(() => platformComparison(series, selection, metric), [series, selection, metric]);
  const rows = useMemo(() => platformBreakdown(series, selection, connections), [series, selection, connections]);
  const ranking = useMemo(
    () => rankClickedServices({ series, services, locale, selection }),
    [series, services, locale, selection],
  );
  const usingTenant = ranking.some((row) => row.source === "tenant");
  const simulated = series.some((item) => item.source !== "live");
  const windowLabel =
    trend.length > 0
      ? `${formatAnalyticsDate(trend[0].date, locale)} – ${formatAnalyticsDate(trend[trend.length - 1].date, locale)}`
      : "";
  const trendColor = platform === "all" ? "#e10600" : ANALYTICS_PLATFORM_COLORS[platform];
  const platformNames = copy.platforms;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="font-display text-4xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{copy.subtitle}</p>
      </div>

      {simulated ? (
        <p className="max-w-3xl border-l-2 border-[#e10600] px-4 py-1 text-sm text-muted-foreground">{copy.simulatedBanner}</p>
      ) : null}

      <section className="space-y-4 border border-border bg-[#fafafa] p-4">
        <FilterGroup label={copy.filters.platform}>
          <FilterButton active={platform === "all"} onClick={() => setPlatform("all")}>
            {copy.filters.all}
          </FilterButton>
          {ANALYTICS_PLATFORMS.map((item) => (
            <FilterButton key={item} active={platform === item} onClick={() => setPlatform(item)}>
              <span className="inline-block h-2 w-2" style={{ background: ANALYTICS_PLATFORM_COLORS[item] }} />
              {platformNames[item]}
            </FilterButton>
          ))}
        </FilterGroup>
        <FilterGroup label={copy.filters.range}>
          {ANALYTICS_RANGES.map((item) => (
            <FilterButton key={item} active={range === item} onClick={() => setRange(item)}>
              {copy.ranges[item]}
            </FilterButton>
          ))}
          {windowLabel ? <span className="px-2 py-1.5 text-sm text-muted-foreground">{windowLabel}</span> : null}
        </FilterGroup>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={copy.kpis.impressions} value={formatAnalyticsCount(kpis.impressions, locale)} />
        <KpiCard
          label={copy.kpis.clicks}
          value={formatAnalyticsCount(kpis.clicks, locale)}
          detail={`${copy.kpis.ctr} ${kpis.ctr == null ? copy.empty : formatAnalyticsPercent(kpis.ctr, locale)}`}
        />
        <KpiCard
          label={copy.kpis.spend}
          value={formatAnalyticsSpend(kpis.spendRon, locale, ronPerGbp)}
          detail={`${copy.kpis.cpc} ${kpis.cpcRon == null ? copy.empty : formatAnalyticsSpend(kpis.cpcRon, locale, ronPerGbp)}`}
        />
        <KpiCard
          label={copy.kpis.conversions}
          value={formatAnalyticsCount(kpis.conversions, locale)}
          detail={`${copy.kpis.cpa} ${kpis.cpaRon == null ? copy.empty : formatAnalyticsSpend(kpis.cpaRon, locale, ronPerGbp)}`}
          hint={copy.kpis.cpaHint}
        />
      </section>
      <p className="text-xs text-muted-foreground">{fxLine}</p>

      <div role="group" aria-label={copy.metricLabel} className="flex flex-wrap gap-1 border border-border bg-white p-1">
        {ANALYTICS_METRICS.map((item) => (
          <FilterButton key={item} active={metric === item} onClick={() => setMetric(item)}>
            {copy.metrics[item]}
          </FilterButton>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>{copy.trend.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{copy.trend.subtitle}</p>
          </CardHeader>
          <CardContent>
            <PerformanceTrendChart
              points={trend}
              metric={metric}
              locale={locale}
              ronPerGbp={ronPerGbp}
              color={trendColor}
              labels={{
                aria: copy.trend.aria.replaceAll("{metric}", copy.metrics[metric]),
                legend: platform === "all" ? copy.filters.all : platformNames[platform],
                metric: copy.metrics[metric],
                date: copy.tooltip.date,
                value: copy.tooltip.value,
                thousand: copy.compact.thousand,
                million: copy.compact.million,
                empty: copy.trend.empty,
              }}
            />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{copy.comparison.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {copy.comparison.subtitle.replaceAll("{metric}", copy.metrics[metric])}
            </p>
          </CardHeader>
          <CardContent>
            <PlatformComparisonChart
              points={comparison}
              metric={metric}
              locale={locale}
              ronPerGbp={ronPerGbp}
              names={platformNames}
              labels={{
                aria: copy.comparison.aria.replaceAll("{metric}", copy.metrics[metric]),
                legend: copy.comparison.title,
                metric: copy.metrics[metric],
                date: copy.tooltip.date,
                value: copy.tooltip.value,
                thousand: copy.compact.thousand,
                million: copy.compact.million,
                empty: copy.comparison.empty,
              }}
            />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl">{copy.table.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.table.subtitle}</p>
        </div>
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#fafafa] text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">{copy.table.platform}</th>
                <th className="px-4 py-3 font-medium">{copy.table.status}</th>
                <th className="px-4 py-3 text-right font-medium">{copy.table.impressions}</th>
                <th className="px-4 py-3 text-right font-medium">{copy.table.clicks}</th>
                <th className="px-4 py-3 text-right font-medium">{copy.table.ctr}</th>
                <th className="px-4 py-3 text-right font-medium">{copy.table.spend}</th>
                <th className="px-4 py-3 text-right font-medium">{copy.table.conversions}</th>
                <th className="px-4 py-3 text-right font-medium">{copy.table.cpa}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.platform} className="border-t border-border">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span
                        className="inline-block h-2.5 w-2.5"
                        style={{ background: ANALYTICS_PLATFORM_COLORS[row.platform] }}
                      />
                      {platformNames[row.platform]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={row.status === "connected" ? "good" : "warn"}>
                      {row.status === "connected" ? copy.connectedBadge : copy.simulatedBadge}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatAnalyticsCount(row.impressions, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatAnalyticsCount(row.clicks, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.ctr == null ? copy.empty : formatAnalyticsPercent(row.ctr, locale)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatAnalyticsSpend(row.spendRon, locale, ronPerGbp)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatAnalyticsCount(row.conversions, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.cpaRon == null ? copy.empty : formatAnalyticsSpend(row.cpaRon, locale, ronPerGbp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl">{copy.services.title}</h2>
          <Badge tone="warn">{copy.services.simulated}</Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{copy.services.subtitle}</p>
        <p className="text-sm text-muted-foreground">{usingTenant ? copy.services.usingTenant : copy.services.usingDefaults}</p>
        <p className="sr-only">
          {copy.services.rank}, {copy.services.name}, {copy.services.clicks}, {copy.services.share}, {copy.services.ctr},{" "}
          {copy.services.conversions}, {copy.services.topPlatform}
        </p>
        {ranking.length === 0 || ranking.every((row) => row.clicks === 0) ? (
          <p className="text-sm text-muted-foreground">{copy.services.empty}</p>
        ) : (
          <ol className="border border-border bg-white">
            {ranking.map((row) => (
              <li key={row.id} className="grid gap-3 border-t border-border px-4 py-4 first:border-t-0 md:grid-cols-[auto_1fr]">
                <span
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center px-2 text-sm font-medium text-white",
                    row.rank === 1 ? "bg-[#e10600]" : "bg-[#111]",
                  )}
                  aria-label={`${copy.services.rank} ${row.rank}`}
                >
                  #{row.rank}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="truncate font-medium" title={row.name}>
                      {row.name}
                    </p>
                    <p className="text-sm tabular-nums">
                      {formatAnalyticsCount(row.clicks, locale)} {copy.services.clicks}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 bg-[#f4f4f4]" aria-hidden>
                    <div className="h-full bg-[#e10600]" style={{ width: `${Math.min(100, row.share * 100)}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {copy.services.share} {formatAnalyticsPercent(row.share, locale)}
                    </span>
                    <span>
                      {copy.services.ctr} {row.ctr == null ? copy.empty : formatAnalyticsPercent(row.ctr, locale)}
                    </span>
                    <span>
                      {copy.services.conversions} {formatAnalyticsCount(row.conversions, locale)}
                    </span>
                    {platform === "all" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2"
                          style={{ background: ANALYTICS_PLATFORM_COLORS[row.topPlatform] }}
                        />
                        {copy.services.topPlatform}: {platformNames[row.topPlatform]}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function KpiCard({ label, value, detail, hint }: { label: string; value: string; detail?: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
        <p className={cn("mt-1 text-sm", detail ? "text-muted-foreground" : "invisible")} title={hint}>
          {detail ?? "\u00a0"}
        </p>
      </CardContent>
    </Card>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {children}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 border px-3 py-1.5 text-sm",
        active ? "border-[#e10600] bg-white text-foreground" : "border-transparent text-[#6d6d6d] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
