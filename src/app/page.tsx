import Link from "next/link";
import { Suspense } from "react";
import { LocaleSwitch } from "@/components/locale-switch";
import { Logo } from "@/components/logo";
import { NetworkHero } from "@/components/network-hero";
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
    <div className="landing-shell relative mx-auto flex min-h-screen max-w-6xl flex-col px-4">
      <header className="landing-rise flex items-center justify-between gap-3 py-5" style={{ animationDelay: "0ms" }}>
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

      <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-14">
        <div className="landing-rise" style={{ animationDelay: "80ms" }}>
          <span className="red-rule" />
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.22em] text-[#E10600]">{dict.landing.eyebrow}</p>
          <h1 className="mt-4 max-w-xl text-4xl leading-[1.05] text-balance sm:text-5xl lg:text-[3.35rem]">
            {dict.landing.title}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{dict.landing.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">{dict.landing.primary}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/preview/pk_demo_saloniris">{dict.landing.secondary}</Link>
            </Button>
          </div>
        </div>

        <div className="landing-rise" style={{ animationDelay: "160ms" }}>
          <NetworkHero labels={dict.landing.network} />
        </div>
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

      <section id="pricing" className="border-t py-16">
        <h2 className="text-3xl">{dict.landing.pricingTitle}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{dict.landing.pricingSubtitle}</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {dict.landing.pricing.map((plan) => (
            <article
              key={plan.name}
              className={`flex flex-col border p-6 ${
                plan.featured ? "border-[#E10600] bg-[#fff8f7]" : "border-[#ececec] bg-white"
              }`}
            >
              <p className="text-[11px] font-medium tracking-[0.18em] text-[#E10600] uppercase">{plan.name}</p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-medium tracking-tight">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.blurb}</p>
              <ul className="mt-6 space-y-2 text-sm">
                {plan.features.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-[#E10600]" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button asChild className="w-full" variant={plan.featured ? "default" : "outline"}>
                  <Link href="/signup">{plan.cta}</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{dict.landing.pricingNote}</p>
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
