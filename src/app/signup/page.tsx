import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth-forms";
import { LocaleSwitch } from "@/components/locale-switch";
import { Logo } from "@/components/logo";
import { getDictionary, getLocale } from "@/i18n";

export const instant = false;

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Signup />
    </Suspense>
  );
}

async function Signup() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <LocaleSwitch locale={locale} label={dict.localeLabel} />
      </div>
      <div className="border border-[#ececec] border-t-2 border-t-[#E10600] bg-white p-6">
        <h1 className="text-4xl">{dict.auth.signupTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{dict.auth.signupSubtitle}</p>
        <div className="mt-6">
          <SignupForm dict={dict} />
        </div>
        <p className="mt-4 text-sm">
          {dict.auth.hasAccount}{" "}
          <Link href="/login" className="font-medium underline">
            {dict.nav.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
