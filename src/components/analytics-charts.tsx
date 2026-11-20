"use client";

import { useState } from "react";
import {
  ANALYTICS_PLATFORM_COLORS,
  formatAnalyticsCount,
  formatAnalyticsDate,
  formatAnalyticsDateShort,
  formatAnalyticsSpend,
  type AnalyticsMetric,
  type AnalyticsPlatform,
  type PlatformComparisonPoint,
  type TrendPoint,
} from "@/lib/marketing-analytics";

type ChartLabels = {
  aria: string;
  legend: string;
  metric: string;
  date: string;
  value: string;
  thousand: string;
  million: string;
  empty: string;
};

const TREND_W = 640;
const TREND_H = 280;
const TREND_PAD = { l: 56, r: 16, t: 18, b: 36 };

export function PerformanceTrendChart({
  points,
  metric,
  locale,
  ronPerGbp,
  color,
  labels,
}: {
  points: TrendPoint[];
  metric: AnalyticsMetric;
  locale: "ro" | "en";
  ronPerGbp: number;
  color: string;
  labels: ChartLabels;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  const yMax = niceMax(Math.max(...points.map((point) => axisValue(point.value, metric, locale, ronPerGbp))));
  const innerW = TREND_W - TREND_PAD.l - TREND_PAD.r;
  const innerH = TREND_H - TREND_PAD.t - TREND_PAD.b;
  const baseline = TREND_PAD.t + innerH;
  const coords = points.map((point, index) => {
    const x = TREND_PAD.l + xAt(index, points.length, innerW);
    const amount = axisValue(point.value, metric, locale, ronPerGbp);
    const y = TREND_PAD.t + (1 - amount / yMax) * innerH;
    return { x, y };
  });
  const line = coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x.toFixed(2)} ${baseline} L${coords[0].x.toFixed(2)} ${baseline} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelIndexes = xLabelIndexes(points.length);
  const active = hover == null ? null : points[hover];
  const activeCoord = hover == null ? null : coords[hover];

  function moveTo(index: number) {
    setHover(Math.min(points.length - 1, Math.max(0, index)));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${TREND_W} ${TREND_H}`}
          role="img"
          aria-label={labels.aria}
          tabIndex={0}
          className="h-auto w-full outline-none focus-visible:ring-2 focus-visible:ring-[#e10600]"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width === 0) return;
            const viewX = ((event.clientX - rect.left) / rect.width) * TREND_W;
            let nearest = 0;
            let best = Number.POSITIVE_INFINITY;
            coords.forEach((coord, index) => {
              const distance = Math.abs(coord.x - viewX);
              if (distance < best) {
                best = distance;
                nearest = index;
              }
            });
            setHover(nearest);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              moveTo((hover ?? -1) + 1);
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              moveTo((hover ?? 1) - 1);
            }
            if (event.key === "Home") {
              event.preventDefault();
              moveTo(0);
            }
            if (event.key === "End") {
              event.preventDefault();
              moveTo(points.length - 1);
            }
          }}
        >
          {ticks.map((tick) => {
            const y = TREND_PAD.t + (1 - tick) * innerH;
            return (
              <g key={tick}>
                <line x1={TREND_PAD.l} x2={TREND_W - TREND_PAD.r} y1={y} y2={y} stroke="#ececec" />
                <text x={TREND_PAD.l - 8} y={y + 4} textAnchor="end" fill="#6d6d6d" fontSize="11">
                  {compactNumber(yMax * tick, locale, labels.thousand, labels.million)}
                </text>
              </g>
            );
          })}
          <line x1={TREND_PAD.l} x2={TREND_PAD.l} y1={TREND_PAD.t} y2={baseline} stroke="#e6e6e6" />
          <line x1={TREND_PAD.l} x2={TREND_W - TREND_PAD.r} y1={baseline} y2={baseline} stroke="#e6e6e6" />
          <path d={area} fill={color} opacity={0.12} />
          <path d={line} fill="none" stroke={color} strokeWidth="2" />
          {labelIndexes.map((index) => (
            <text
              key={points[index].date}
              x={coords[index].x}
              y={TREND_H - 12}
              textAnchor="middle"
              fill="#6d6d6d"
              fontSize="11"
            >
              {formatAnalyticsDateShort(points[index].date, locale)}
            </text>
          ))}
          {activeCoord ? (
            <g>
              <line x1={activeCoord.x} x2={activeCoord.x} y1={TREND_PAD.t} y2={baseline} stroke={color} strokeDasharray="3 3" />
              <circle cx={activeCoord.x} cy={activeCoord.y} r="4" fill="#fff" stroke={color} strokeWidth="2" />
            </g>
          ) : null}
        </svg>
        {active && activeCoord ? (
          <div
            className="pointer-events-none absolute z-10 min-w-36 border border-border bg-white px-3 py-2 text-xs shadow-sm"
            style={{
              left: `${(activeCoord.x / TREND_W) * 100}%`,
              top: `${(activeCoord.y / TREND_H) * 100}%`,
              transform: `${activeCoord.x > TREND_W * 0.72 ? "translateX(-100%)" : "translateX(0)"} ${activeCoord.y < 70 ? "translateY(8px)" : "translateY(-110%)"}`,
            }}
          >
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{labels.date}</p>
            <p className="font-medium">{formatAnalyticsDate(active.date, locale)}</p>
            <p className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">{labels.value}</p>
            <p className="font-medium">{formatMetric(active.value, metric, locale, ronPerGbp)}</p>
            <p className="text-muted-foreground">{labels.metric}</p>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-2 w-2" style={{ background: color }} />
        <span>
          {labels.legend}: {labels.metric}
        </span>
      </div>
    </div>
  );
}

export function PlatformComparisonChart({
  points,
  metric,
  locale,
  ronPerGbp,
  names,
  labels,
}: {
  points: PlatformComparisonPoint[];
  metric: AnalyticsMetric;
  locale: "ro" | "en";
  ronPerGbp: number;
  names: Record<AnalyticsPlatform, string>;
  labels: ChartLabels;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  const width = 640;
  const rowH = 44;
  const pad = { l: 118, r: 16, t: 16, b: 32 };
  const height = pad.t + points.length * rowH + pad.b;
  const innerW = width - pad.l - pad.r;
  const yMax = niceMax(Math.max(...points.map((point) => axisValue(point.value, metric, locale, ronPerGbp)), 1));
  const axisY = pad.t + points.length * rowH;
  const ticks = [0, 0.5, 1];
  const active = hover == null ? null : points[hover];

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={labels.aria}
          tabIndex={0}
          className="h-auto w-full outline-none focus-visible:ring-2 focus-visible:ring-[#e10600]"
          onMouseLeave={() => setHover(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHover((current) => Math.min(points.length - 1, (current ?? -1) + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHover((current) => Math.max(0, (current ?? 1) - 1));
            }
          }}
        >
          {ticks.map((tick) => {
            const x = pad.l + tick * innerW;
            return (
              <g key={tick}>
                <line x1={x} x2={x} y1={pad.t} y2={axisY} stroke="#ececec" />
                <text x={x} y={height - 10} textAnchor="middle" fill="#6d6d6d" fontSize="11">
                  {compactNumber(yMax * tick, locale, labels.thousand, labels.million)}
                </text>
              </g>
            );
          })}
          <line x1={pad.l} x2={pad.l + innerW} y1={axisY} y2={axisY} stroke="#e6e6e6" />
          {points.map((point, index) => {
            const amount = axisValue(point.value, metric, locale, ronPerGbp);
            const barW = yMax === 0 ? 0 : (amount / yMax) * innerW;
            const y = pad.t + index * rowH;
            const color = ANALYTICS_PLATFORM_COLORS[point.platform];
            const hovered = hover === index;
            return (
              <g key={point.platform} onMouseEnter={() => setHover(index)}>
                <rect x={0} y={y} width={width} height={rowH} fill={hovered ? "#fafafa" : "transparent"} />
                <text x={8} y={y + rowH / 2 + 4} fill="#111111" fontSize="12">
                  {names[point.platform]}
                </text>
                <rect x={pad.l} y={y + 12} width={Math.max(barW, amount > 0 ? 2 : 0)} height={16} fill={color} />
              </g>
            );
          })}
        </svg>
        {active && hover != null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-36 border border-border bg-white px-3 py-2 text-xs shadow-sm"
            style={{
              left: "46%",
              top: `${((pad.t + hover * rowH + 8) / height) * 100}%`,
            }}
          >
            <p className="font-medium">{names[active.platform]}</p>
            <p className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">{labels.value}</p>
            <p className="font-medium">{formatMetric(active.value, metric, locale, ronPerGbp)}</p>
            <p className="text-muted-foreground">{labels.metric}</p>
          </div>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {points.map((point) => (
          <li key={point.platform} className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2" style={{ background: ANALYTICS_PLATFORM_COLORS[point.platform] }} />
            <span>
              {names[point.platform]} · {formatMetric(point.value, metric, locale, ronPerGbp)}
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only">{labels.legend}</p>
    </div>
  );
}

function formatMetric(value: number, metric: AnalyticsMetric, locale: "ro" | "en", ronPerGbp: number) {
  if (metric === "spend") return formatAnalyticsSpend(value, locale, ronPerGbp);
  return formatAnalyticsCount(value, locale);
}

function axisValue(value: number, metric: AnalyticsMetric, locale: "ro" | "en", ronPerGbp: number) {
  if (metric !== "spend" || locale !== "en") return value;
  if (!(ronPerGbp > 0)) return value;
  return value / ronPerGbp;
}

function xAt(index: number, count: number, width: number) {
  if (count <= 1) return width / 2;
  return (index / (count - 1)) * width;
}

function xLabelIndexes(length: number) {
  if (length <= 7) return Array.from({ length }, (_, index) => index);
  const target = length > 40 ? 6 : 5;
  const step = (length - 1) / (target - 1);
  const indexes = Array.from({ length: target }, (_, index) => Math.round(index * step));
  return [...new Set(indexes)];
}

function niceMax(max: number) {
  if (max <= 0) return 1;
  const padded = max * 1.08;
  const exponent = 10 ** Math.floor(Math.log10(padded));
  const fraction = padded / exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * exponent;
}

function compactNumber(value: number, locale: "ro" | "en", thousand: string, million: string) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${trimNumber(abs / 1_000_000, locale)}${million}`;
  if (abs >= 1000) return `${sign}${trimNumber(abs / 1000, locale)}${thousand}`;
  if (abs >= 100 || Number.isInteger(abs)) return `${sign}${Math.round(abs)}`;
  return `${sign}${trimNumber(abs, locale)}`;
}

function trimNumber(value: number, locale: "ro" | "en") {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return locale === "ro" ? text.replace(".", ",") : text;
}
