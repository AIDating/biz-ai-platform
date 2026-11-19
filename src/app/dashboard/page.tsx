import Link from "next/link";
import { Suspense } from "react";
import { setLeadStatusAction } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant-db";
import { addZonedDays, formatWhen, startOfZonedDay } from "@/lib/time";

export const instant = false;

export default function OverviewPage() {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const user = await requireUser();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const db = tenantDb(user.tenantId);
  const agent = await tenantDb(user.tenantId).agentProfile.findFirst();
  const timezone = agent?.timezone ?? "Europe/Bucharest";
  const start = startOfZonedDay(new Date(), timezone);
  const end = addZonedDays(start, 1, timezone);
  const [newLeads, todayCount, conversations, leads, appointments] = await Promise.all([
    db.lead.count({ where: { status: "new" } }),
    db.appointment.count({ where: { status: "booked", startsAt: { gte: start, lt: end } } }),
    db.conversation.count(),
    db.lead.findMany({ where: { status: "new" }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.appointment.findMany({
      where: { status: "booked", startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">{dict.dash.hello.replaceAll("{name}", user.name.split(" ")[0] ?? user.name)}</h1>
        <p className="mt-2 text-muted-foreground">{agent?.enabled ? dict.dash.agentOn : dict.dash.agentOff}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={dict.dash.newLeads} value={newLeads} />
        <Stat label={dict.dash.todayAppointments} value={todayCount} />
        <Stat label={dict.dash.openConversations} value={conversations} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl">{dict.dash.recentLeads}</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/clienti">{dict.dash.seeCustomers}</Link>
            </Button>
          </div>
          {leads.length === 0 ? <p className="text-sm text-muted-foreground">{dict.dash.emptyLeads}</p> : null}
          <ul className="space-y-3">
            {leads.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                <div>
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-sm text-muted-foreground">{lead.phone || lead.email}</p>
                </div>
                <form action={setLeadStatusAction}>
                  <input type="hidden" name="id" value={lead.id} />
                  <input type="hidden" name="status" value="handled" />
                  <Button type="submit" size="sm" variant="secondary">
                    {dict.dash.markHandled}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl">{dict.dash.todayTitle}</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/programari">{dict.dash.seeCalendar}</Link>
            </Button>
          </div>
          {appointments.length === 0 ? <p className="text-sm text-muted-foreground">{dict.dash.emptyToday}</p> : null}
          <ul className="space-y-3">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="flex items-center justify-between gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                <div>
                  <p className="font-medium">{appointment.clientName}</p>
                  <p className="text-sm text-muted-foreground">{appointment.service}</p>
                </div>
                <Badge>{formatWhen(appointment.startsAt, timezone, locale)}</Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="rounded-3xl border border-dashed p-5">
        <h2 className="font-display text-2xl">{dict.dash.comingTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{dict.dash.comingBody}</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border bg-card px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-4xl">{value}</p>
    </div>
  );
}
