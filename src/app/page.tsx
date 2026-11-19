import Link from "next/link";
import { Suspense } from "react";
import { LocaleSwitch } from "@/components/locale-switch";
import { Logo, LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";

export const instant = false;

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const [dict, locale, user] = await Promise.all([getDictionary(), getLocale(), getCurrentUser()]);
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4">
      <header className="flex items-center justify-between gap-3 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <LocaleSwitch locale={locale} label={dict.localeLabel} />
          {user ? (
            <Button asChild>
              <Link href="/dashboard">{dict.nav.dashboard}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">{dict.nav.login}</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">{dict.nav.signup}</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="grid flex-1 items-center gap-16 py-16 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="red-rule" />
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{dict.landing.eyebrow}</p>
          <h1 className="mt-4 max-w-xl text-5xl leading-[1.02] text-balance sm:text-6xl">{dict.landing.title}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">{dict.landing.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">{dict.landing.primary}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/preview/pk_demo_saloniris">{dict.landing.secondary}</Link>
            </Button>
          </div>
        </div>
        <SampleChat />
      </main>

      <section className="border-t py-16">
        <h2 className="text-3xl">{dict.landing.stepsTitle}</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {dict.landing.steps.map((step, index) => (
            <li key={step.title} className="border-t-2 border-[#e10600] pt-4">
              <span className="text-[11px] font-medium tracking-[0.18em] text-[#e10600]">0{index + 1}</span>
              <h3 className="mt-3 text-lg">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t py-16">
        <h2 className="text-3xl">{dict.landing.featuresTitle}</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {dict.landing.features.map((feature) => (
            <article key={feature.title} className="border-t-2 border-[#e10600] pt-4">
              <h3 className="text-xl">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-auto flex flex-col gap-3 border-t py-6 text-sm text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium text-foreground">{dict.landing.demoTitle}</p>
          <p>{dict.landing.demoBody}</p>
          <p className="mt-1">{dict.landing.salon}</p>
          <p>{dict.landing.garage}</p>
        </div>
        <p>© 2026 REDLINE</p>
      </footer>
    </div>
  );
}

function SampleChat() {
  return (
    <div className="border border-[#ececec] bg-white p-5 shadow-[0_24px_50px_-36px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-2.5 border-b pb-3">
        <LogoMark className="h-8 w-8" />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#E10600]">REDLINE</p>
          <p className="text-sm">Salon Iris</p>
        </div>
      </div>
      <div className="space-y-3 py-4 text-sm">
        <p className="max-w-[85%] border px-3 py-2">
          Bună! Sunt recepția Salon Iris. Cu ce vă pot ajuta?
        </p>
        <p className="ml-auto max-w-[85%] bg-[#111111] px-3 py-2 text-white">
          Aș vrea un vopsit joi, pe la 15:30. Mă numesc Maria Stan, 0744 111 222.
        </p>
        <p className="max-w-[85%] border px-3 py-2">Gata. V-am notat joi la 15:30 pentru vopsit.</p>
      </div>
    </div>
  );
}
