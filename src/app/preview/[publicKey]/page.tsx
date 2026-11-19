import { Suspense } from "react";
import { WidgetLoader } from "@/components/widget-loader";
import { dictionaryFor, getLocale, type Locale } from "@/i18n";
import { formatOpenings, parseServices } from "@/lib/services";
import { tenantDb } from "@/lib/tenant-db";
import { findTenantByPublicKey } from "@/lib/tenants";

export const instant = false;

export default function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicKey: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Preview params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ publicKey: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ publicKey }, query, cookieLocale] = await Promise.all([params, searchParams, getLocale()]);
  const locale: Locale = query.lang === "en" || query.lang === "ro" ? query.lang : cookieLocale;
  const dict = dictionaryFor(locale);
  const tenant = await findTenantByPublicKey(publicKey);
  if (!tenant) {
    return <p className="grid min-h-screen place-items-center px-6 text-center">{dict.preview.missing}</p>;
  }
  const db = tenantDb(tenant.id);
  const agent = await db.agentProfile.findFirst();
  const openings = await db.availabilityRule.findMany();
  const services = parseServices(agent?.servicesJson ?? "[]");

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-end justify-between px-4 py-8">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#E10600]">{dict.preview.kicker}</p>
            <h1 className="mt-2 text-5xl">{agent?.businessName ?? tenant.name}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-4xl gap-8 px-4 py-10 md:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="text-lg">{agent?.description || dict.preview.intro}</p>
          <p className="mt-4 text-sm text-muted-foreground">{dict.preview.intro}</p>
          <h2 className="mt-8 font-display text-3xl">{dict.preview.services}</h2>
          <ul className="mt-3 space-y-2">
            {services.map((service) => (
              <li key={service.name} className="rounded-2xl border bg-white px-4 py-3">
                <p className="font-medium">{service.name}</p>
                {service.detail ? <p className="text-sm text-muted-foreground">{service.detail}</p> : null}
              </li>
            ))}
          </ul>
        </div>
        <aside className="h-fit border-t-2 border-t-[#E10600] border border-[#ececec] bg-white p-5">
          <h2 className="font-display text-2xl">{dict.preview.hours}</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm">{formatOpenings(openings, locale)}</pre>
        </aside>
      </main>
      <WidgetLoader publicKey={publicKey} />
    </div>
  );
}
