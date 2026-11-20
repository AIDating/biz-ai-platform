import { Suspense } from "react";
import { logoutAction, setAgentEnabledAction } from "@/app/dashboard/actions";
import { DashboardNav } from "@/components/dashboard-nav";
import { DashboardOwnerChat } from "@/components/dashboard-owner-chat";
import { LocaleSwitch } from "@/components/locale-switch";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { llmMode } from "@/lib/llm";
import { tenantDb } from "@/lib/tenant-db";

export const instant = false;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const agent = await tenantDb(user.tenantId).agentProfile.findFirst();
  const enabled = Boolean(agent?.enabled);
  const mode = llmMode();
  const items = [
    { href: "/dashboard", label: dict.nav.overview, icon: "overview" as const },
    { href: "/dashboard/clienti", label: dict.nav.customers, icon: "customers" as const },
    { href: "/dashboard/conversatii", label: dict.nav.conversations, icon: "conversations" as const },
    { href: "/dashboard/programari", label: dict.nav.appointments, icon: "appointments" as const },
    { href: "/dashboard/agent", label: dict.nav.agent, icon: "agent" as const },
    { href: "/dashboard/widget", label: dict.nav.widget, icon: "widget" as const },
    {
      href: "/dashboard/marketing",
      label: dict.nav.marketing,
      icon: "marketing" as const,
      badge: dict.nav.premium,
    },
    {
      href: "/dashboard/analytics",
      label: dict.nav.analytics,
      icon: "analytics" as const,
    },
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="border-b border-border bg-white lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 py-6 lg:block">
          <Logo href="/dashboard" />
          <p className="mt-4 text-sm text-muted-foreground">{user.tenantName}</p>
        </div>
        <div className="px-3 pb-6">
          <DashboardNav items={items} />
          <form action={logoutAction} className="mt-6 px-3">
            <Button type="submit" variant="outline" size="sm">
              {dict.nav.logout}
            </Button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-8">
          <form action={setAgentEnabledAction}>
            <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
            <Button type="submit" variant={enabled ? "outline" : "brass"}>
              <span className={`inline-block h-2 w-2 ${enabled ? "bg-[#e10600]" : "bg-[#c8c8c8]"}`} />
              {enabled ? dict.dash.pause : dict.dash.resume}
            </Button>
          </form>
          <LocaleSwitch locale={locale} label={dict.localeLabel} />
        </div>
        <div className="px-4 py-8 pb-28 sm:px-8 sm:pb-32">
          {mode.id === "mock" ? (
            <p className="mb-6 border-l-2 border-[#e10600] px-4 py-1 text-sm text-muted-foreground">{dict.dash.mockBanner}</p>
          ) : (
            <p className="mb-6 border-l-2 border-foreground px-4 py-1 text-sm">
              {dict.dash.liveBanner.replaceAll("{model}", mode.model)}
            </p>
          )}
          {children}
        </div>
        <DashboardOwnerChat copy={dict.ownerChat} locale={locale} />
      </div>
    </div>
  );
}
