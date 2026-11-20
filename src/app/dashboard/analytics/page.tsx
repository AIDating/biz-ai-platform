import { Suspense } from "react";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { formatFxLine } from "@/lib/fx";
import { resolveFxQuote } from "@/lib/fx-rate";
import { loadPlatformLinks } from "@/lib/marketing";
import { connectionMap, simulatedMarketingAnalytics } from "@/lib/marketing-analytics";
import { parseFxSettings, parseServices } from "@/lib/services";
import { tenantDb } from "@/lib/tenant-db";

export const instant = false;

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <AnalyticsContent />
    </Suspense>
  );
}

async function AnalyticsContent() {
  const user = await requireUser();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const db = tenantDb(user.tenantId);
  const [agent, links] = await Promise.all([db.agentProfile.findFirst(), loadPlatformLinks(db)]);
  const servicesJson = agent?.servicesJson ?? "[]";
  const quote = await resolveFxQuote(parseFxSettings(servicesJson));
  const series = await Promise.resolve(simulatedMarketingAnalytics.getDailySeries({ asOf: new Date(), days: 90 }));

  return (
    <AnalyticsDashboard
      copy={dict.analytics}
      locale={locale}
      series={series}
      services={parseServices(servicesJson).map((service) => ({ name: service.name }))}
      connections={connectionMap(links.map((link) => ({ channel: link.channel, enabled: link.connected })))}
      ronPerGbp={quote.ronPerGbp}
      fxLine={formatFxLine(quote, locale, dict.fx)}
    />
  );
}
