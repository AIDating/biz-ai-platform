import { Suspense } from "react";
import { AgentForm } from "@/components/agent-form";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { quoteServices } from "@/lib/fx-rate";
import { SLOT_LENGTHS, TIMEZONES, TONE_KEYS } from "@/lib/services";
import { tenantDb } from "@/lib/tenant-db";
import { minutesToTime } from "@/lib/time";

export const instant = false;

export default function AgentPage() {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <AgentSettings />
    </Suspense>
  );
}

async function AgentSettings() {
  const user = await requireUser();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const db = tenantDb(user.tenantId);
  const agent = await db.agentProfile.findFirst();
  const rules = await db.availabilityRule.findMany();
  if (!agent) return null;
  const quoted = await quoteServices(agent.servicesJson, locale);
  const openings = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const rule = rules.find((item) => item.dayOfWeek === day);
    return {
      dayOfWeek: day,
      enabled: rule?.enabled ?? false,
      start: minutesToTime(rule?.startMin ?? 9 * 60),
      end: minutesToTime(rule?.endMin ?? 17 * 60),
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-4xl">{dict.agent.title}</h1>
        <p className="mt-2 text-muted-foreground">{dict.agent.subtitle}</p>
      </div>
      <div className="rounded-3xl border bg-card p-5 sm:p-6">
        <AgentForm
          dict={dict}
          locale={locale}
          businessName={agent.businessName}
          description={agent.description}
          greeting={agent.greeting}
          tone={agent.tone}
          customInstructions={agent.customInstructions}
          slotMinutes={agent.slotMinutes}
          timezone={agent.timezone}
          enabled={agent.enabled}
          services={quoted.services}
          quote={quoted.quote}
          fxMode={quoted.settings.mode}
          openings={openings}
          tones={TONE_KEYS.map((tone) => ({ value: tone, label: dict.tones[tone] }))}
          timezones={TIMEZONES}
          slotLengths={SLOT_LENGTHS}
        />
      </div>
    </div>
  );
}
