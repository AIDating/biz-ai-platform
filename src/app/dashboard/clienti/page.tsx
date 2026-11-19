import Link from "next/link";
import { Suspense } from "react";
import { setLeadStatusAction } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant-db";
import { formatWhen } from "@/lib/time";

export const instant = false;

export default function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

async function Customers({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  const [dict, locale, params] = await Promise.all([getDictionary(), getLocale(), searchParams]);
  const status = params.status === "handled" || params.status === "new" ? params.status : "all";
  const db = tenantDb(user.tenantId);
  const agent = await db.agentProfile.findFirst();
  const leads = await db.lead.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const filters = [
    { id: "all", label: dict.customers.all },
    { id: "new", label: dict.customers.fresh },
    { id: "handled", label: dict.customers.handled },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">{dict.customers.title}</h1>
        <p className="mt-2 text-muted-foreground">{dict.customers.subtitle}</p>
      </div>
      <div className="flex gap-2">
        {filters.map((filter) => (
          <Button key={filter.id} asChild size="sm" variant={status === filter.id ? "default" : "outline"}>
            <Link href={filter.id === "all" ? "/dashboard/clienti" : `/dashboard/clienti?status=${filter.id}`}>
              {filter.label}
            </Link>
          </Button>
        ))}
      </div>
      {leads.length === 0 ? <p className="text-sm text-muted-foreground">{dict.customers.empty}</p> : null}
      <div className="overflow-hidden rounded-3xl border bg-card">
        {leads.map((lead) => (
          <article key={lead.id} className="grid gap-3 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
            <div>
              <p className="font-medium">{lead.name}</p>
              <p className="text-sm text-muted-foreground">{[lead.phone, lead.email].filter(Boolean).join(" · ") || "—"}</p>
              {lead.note ? <p className="mt-1 text-sm">{lead.note}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge tone={lead.status === "new" ? "warn" : "good"}>
                {lead.status === "handled" ? dict.status.handled : dict.status.new}
              </Badge>
              <span>{dict.status[lead.source as "web_widget"] ?? lead.source}</span>
              <span>{formatWhen(lead.createdAt, agent?.timezone ?? "Europe/Bucharest", locale)}</span>
            </div>
            <form action={setLeadStatusAction}>
              <input type="hidden" name="id" value={lead.id} />
              <input type="hidden" name="status" value={lead.status === "handled" ? "new" : "handled"} />
              <Button type="submit" size="sm" variant="secondary">
                {lead.status === "handled" ? dict.customers.reopen : dict.customers.markHandled}
              </Button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
