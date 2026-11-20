import { Suspense } from "react";
import { CalendarBoard } from "@/components/calendar-board";
import { getDictionary, getLocale } from "@/i18n";
import { formatFxLine } from "@/lib/fx";
import { buildWeek } from "@/lib/calendar";
import { requireUser } from "@/lib/auth";

export const instant = false;

export default function AppointmentsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <Appointments searchParams={searchParams} />
    </Suspense>
  );
}

async function Appointments({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireUser();
  const [dict, locale, params] = await Promise.all([getDictionary(), getLocale(), searchParams]);
  const week = await buildWeek(user.tenantId, params.week, locale);
  if (!week) return null;
  const hasSlots = week.days.some((day) => day.slots.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">{dict.appointments.title}</h1>
        <p className="mt-2 text-muted-foreground">{dict.appointments.subtitle}</p>
      </div>
      {hasSlots ? null : <p className="text-sm text-muted-foreground">{dict.appointments.emptyWeek}</p>}
      {week.services.some((service) => service.priceLabel) ? (
        <p className="text-sm text-muted-foreground">{formatFxLine(week.fx, locale, dict.fx)}</p>
      ) : null}
      <CalendarBoard
        days={week.days}
        prevWeek={week.prevWeek}
        nextWeek={week.nextWeek}
        weekStart={week.weekStart}
        services={week.services}
        dict={dict}
      />
    </div>
  );
}
