import { Suspense } from "react";
import { logoutAction } from "@/app/dashboard/actions";
import { LocaleSwitch } from "@/components/locale-switch";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/i18n";
import { requirePlatformAdmin } from "@/lib/auth";

export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdmin();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#ececec]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <Logo href="/admin" />
            <p className="mt-2 text-[11px] font-medium tracking-[0.18em] text-[#e10600] uppercase">
              {dict.admin.kicker}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {dict.admin.signedIn} <span className="text-foreground">{user.email}</span>
            </p>
            <LocaleSwitch locale={locale} label={dict.localeLabel} />
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                {dict.nav.logout}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
