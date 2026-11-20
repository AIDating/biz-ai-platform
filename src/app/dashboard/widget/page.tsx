import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";

export const instant = false;

export default function WidgetPage() {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <WidgetSettings />
    </Suspense>
  );
}

async function WidgetSettings() {
  const user = await requireUser();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:43123";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  const snippet = `<script src="${origin}/widget.js" data-key="${user.publicKey}" async></script>`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">{dict.widgetPage.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{dict.widgetPage.subtitle}</p>
      </div>
      <div className="rounded-3xl border bg-card p-5">
        <pre className="overflow-x-auto border border-[#ececec] bg-[#fafafa] p-4 text-sm text-foreground shadow-[inset_0_2px_0_#E10600]">{snippet}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton value={snippet} label={dict.widgetPage.copy} copiedLabel={dict.widgetPage.copied} />
          <Button asChild variant="outline">
            <Link href={`/preview/${user.publicKey}`}>{dict.widgetPage.openTest}</Link>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{dict.widgetPage.hint}</p>
      </div>
      <div>
        <h2 className="mb-3 font-display text-2xl">{dict.widgetPage.preview}</h2>
        <iframe
          title={dict.widgetPage.preview}
          src={`/embed/${user.publicKey}?lang=${locale}`}
          className="h-[640px] w-full max-w-sm rounded-[28px] border bg-card"
        />
      </div>
    </div>
  );
}
