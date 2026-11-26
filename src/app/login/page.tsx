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
      <div className="mt-4 border border-[#ececec] border-l-2 border-l-[#e10600] px-4 py-3 text-sm">
        <p className="font-medium">{dict.auth.demoTitle}</p>
        <ul className="mt-2 space-y-2 text-muted-foreground">
          <li>{dict.landing.salon}</li>
          <li>{dict.landing.garage}</li>
          <li>
            <span className="font-medium text-foreground">{dict.landing.clinicName}</span>
            <br />
            {dict.auth.email}: {dict.landing.clinicEmail}
            <br />
            {dict.auth.password}: {dict.landing.clinicPassword}
          </li>
          <li>{dict.landing.admin}</li>
        </ul>
      </div>
    </div>
  );
}
