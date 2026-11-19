import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant-db";
import { formatWhen } from "@/lib/time";

export const instant = false;

export default function ConversationsPage() {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <Conversations />
    </Suspense>
  );
}

async function Conversations() {
  const user = await requireUser();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const db = tenantDb(user.tenantId);
  const agent = await db.agentProfile.findFirst();
  const conversations = await db.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    include: {
      visitor: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">{dict.conversations.title}</h1>
        <p className="mt-2 text-muted-foreground">{dict.conversations.subtitle}</p>
      </div>
      {conversations.length === 0 ? <p className="text-sm text-muted-foreground">{dict.conversations.empty}</p> : null}
      <div className="space-y-2">
        {conversations.map((conversation) => {
          const preview = conversation.messages[0]?.content ?? "";
          const name = conversation.visitor.name || dict.conversations.visitor;
          return (
            <Link
              key={conversation.id}
              href={`/dashboard/conversatii/${conversation.id}`}
              className="block rounded-3xl border bg-card px-4 py-4 hover:border-primary"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge>{dict.status[conversation.channel as "web_widget"] ?? conversation.channel}</Badge>
                  <span>{formatWhen(conversation.lastMessageAt, agent?.timezone ?? "Europe/Bucharest", locale)}</span>
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{preview}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
