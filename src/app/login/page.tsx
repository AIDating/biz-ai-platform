import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { LocaleSwitch } from "@/components/locale-switch";
import { Logo } from "@/components/logo";
import { getDictionary, getLocale } from "@/i18n";

export const instant = false;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Login />
    </Suspense>
  );
}

async function Login() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <LocaleSwitch locale={locale} label={dict.localeLabel} />
      </div>
      <div className="border border-[#ececec] border-t-2 border-t-[#e10600] bg-white p-6">
        <h1 className="text-4xl">{dict.auth.loginTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{dict.auth.loginSubtitle}</p>
        <div className="mt-6">
          <LoginForm dict={dict} />
        </div>
        <p className="mt-4 text-sm">
          {dict.auth.noAccount}{" "}
          <Link href="/signup" className="font-medium underline">
            {dict.nav.signup}
          </Link>
        </p>
      </div>
      <details className="mt-4 border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">{dict.auth.demoTitle}</summary>
        <p className="mt-2 text-muted-foreground">{dict.landing.salon}</p>
        <p className="text-muted-foreground">{dict.landing.garage}</p>
        <p className="text-muted-foreground">{dict.landing.admin}</p>
      </details>
    </div>
  );
}
