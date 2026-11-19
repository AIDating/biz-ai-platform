import { Suspense } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { dictionaryFor, getLocale, type Locale } from "@/i18n";
import { findTenantByPublicKey } from "@/lib/tenants";

export const instant = false;

export default function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicKey: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-dvh bg-[#fffdf8]" />}>
      <Embed params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Embed({
  params,
  searchParams,
}: {
  params: Promise<{ publicKey: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ publicKey }, query, cookieLocale] = await Promise.all([params, searchParams, getLocale()]);
  const locale: Locale = query.lang === "en" || query.lang === "ro" ? query.lang : cookieLocale;
  const dict = dictionaryFor(locale);
  const tenant = await findTenantByPublicKey(publicKey);
  if (!tenant) {
    return <p className="grid h-dvh place-items-center px-6 text-center text-sm">{dict.chat.unavailable}</p>;
  }
  return (
    <div className="h-dvh">
      <ChatPanel publicKey={publicKey} copy={dict.chat} locale={locale} />
    </div>
  );
}
