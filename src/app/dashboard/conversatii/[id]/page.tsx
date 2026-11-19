import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setLeadStatusAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant-db";
import { formatWhen } from "@/lib/time";

export const instant = false;

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const [{ id }, dict, locale] = await Promise.all([params, getDictionary(), getLocale()]);
  const db = tenantDb(user.tenantId);
  const conversation = await db.conversation.findFirst({
    where: { id },
    include: { visitor: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();
  const agent = await db.agentProfile.findFirst();
  const lead = await db.lead.findFirst({ where: { visitorId: conversation.visitorId } });
  const timezone = agent?.timezone ?? "Europe/Bucharest";

  return (
    <div className="space-y-4">
      <Link href="/dashboard/conversatii" className="text-sm underline">
        {dict.conversations.back}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{conversation.visitor.name || dict.conversations.visitor}</h1>
          <p className="text-sm text-muted-foreground">
            {[conversation.visitor.phone, conversation.visitor.email].filter(Boolean).join(" · ") || dict.conversations.noContact}
          </p>
        </div>
        {lead ? (
          <form action={setLeadStatusAction}>
            <input type="hidden" name="id" value={lead.id} />
            <input type="hidden" name="status" value={lead.status === "handled" ? "new" : "handled"} />
            <Button type="submit" variant="secondary">
              {lead.status === "handled" ? dict.customers.reopen : dict.customers.markHandled}
            </Button>
          </form>
        ) : null}
      </div>
      <div className="space-y-3 rounded-3xl border bg-card p-4">
        {conversation.messages.map((message) => {
          const mine = message.role === "visitor";
          return (
            <div key={message.id} className={mine ? "ml-auto max-w-[40rem]" : "max-w-[40rem]"}>
              <p className="mb-1 text-xs text-muted-foreground">
                {mine ? dict.chat.you : dict.chat.desk} · {formatWhen(message.createdAt, timezone, locale)}
              </p>
              <p className={mine ? "rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap" : "rounded-2xl border bg-white px-3 py-2 text-sm whitespace-pre-wrap"}>
                {message.content}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
