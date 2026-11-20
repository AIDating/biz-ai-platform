"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { Dictionary } from "@/i18n/ro";

export type HistoryItem = {
  id: string;
  channel: string;
  channelLabel: string;
  status: string;
  statusLabel: string;
  text: string;
  whenLabel: string;
  whenSort: number;
};

export function MarketingHistory({
  items,
  dict,
}: {
  items: HistoryItem[];
  dict: Dictionary["marketing"]["history"];
}) {
  const filters = [
    ["all", dict.filterAll],
    ["facebook", dict.filterFacebook],
    ["instagram", dict.filterInstagram],
    ["tiktok", dict.filterTiktok],
    ["youtube", dict.filterYoutube],
  ] as const;
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("all");

  const filtered = useMemo(() => {
    const list = filter === "all" ? items : items.filter((item) => item.channel === filter);
    return [...list].sort((a, b) => b.whenSort - a.whenSort);
  }, [filter, items]);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of filtered) {
      const bucket = map.get(item.channel) ?? [];
      bucket.push(item);
      map.set(item.channel, bucket);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? "border-b-2 border-[#e10600] pb-0.5 text-sm font-medium"
                : "pb-0.5 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.empty}</p>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([channel, rows]) => (
            <div key={channel} className="space-y-3">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {rows[0]?.channelLabel}
              </h3>
              <ul className="space-y-3">
                {rows.map((item) => (
                  <li key={item.id} className="border border-border bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.whenLabel}</p>
                      <Badge tone={item.status === "published" ? "good" : "neutral"}>{item.statusLabel}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
