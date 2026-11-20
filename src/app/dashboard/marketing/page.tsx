import { Suspense } from "react";
import { MarketingBriefForm } from "@/components/marketing-brief-form";
import { MarketingHistory, type HistoryItem } from "@/components/marketing-history";
import { MarketingProposalCard, type ProposalCardModel } from "@/components/marketing-proposal-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { loadBrief, loadPlatformLinks, parsePayload, type ProposalStatus } from "@/lib/marketing";
import {
  MARKETING_PLATFORMS,
  oauthConfigStatus,
  oauthStartPath,
  type MarketingPlatform,
} from "@/lib/marketing-oauth";
import { tenantDb } from "@/lib/tenant-db";
import { formatWhen } from "@/lib/time";

export const instant = false;

type SearchParams = { platform?: string; error?: string };

export default function MarketingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <MarketingContent searchParams={searchParams} />
    </Suspense>
  );
}

function toLocalInputValue(iso: string | null, timeZone: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

async function MarketingContent({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params: SearchParams = searchParams ? await searchParams : {};
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const copy = dict.marketing;
  const db = tenantDb(user.tenantId);
  const agent = await db.agentProfile.findFirst();
  const timezone = agent?.timezone ?? "Europe/Bucharest";

  const [brief, links, proposals] = await Promise.all([
    loadBrief(db),
    loadPlatformLinks(db),
    db.contentProposal.findMany({
      where: { channel: { in: [...MARKETING_PLATFORMS] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const flashPlatform =
    params.platform && MARKETING_PLATFORMS.includes(params.platform as MarketingPlatform)
      ? (params.platform as MarketingPlatform)
      : null;
  const flashError = params.error as keyof typeof copy.oauthErrors | undefined;
  const flashMessage =
    flashPlatform && flashError === "missing_config"
      ? copy.configMissing
          .replaceAll("{platform}", copy.platforms[flashPlatform].name)
          .replaceAll("{missing}", oauthConfigStatus(flashPlatform).missing.join(", "))
      : flashError && flashError in copy.oauthErrors
        ? copy.oauthErrors[flashError]
        : null;

  const openStatuses = new Set(["pending_approval", "needs_changes"]);
  const openProposals: ProposalCardModel[] = [];
  const historyItems: HistoryItem[] = [];

  for (const row of proposals) {
    if (!MARKETING_PLATFORMS.includes(row.channel as MarketingPlatform)) continue;
    const channel = row.channel as MarketingPlatform;
    const payload = parsePayload(row.body);
    const status = row.status as ProposalStatus;
    const statusLabel =
      copy.proposals.statuses[status as keyof typeof copy.proposals.statuses] ?? row.status;
    const channelLabel = copy.platforms[channel].name;

    if (openStatuses.has(status)) {
      openProposals.push({
        id: row.id,
        channel,
        channelLabel,
        status,
        statusLabel,
        text: payload.text,
        revisionNote: payload.revisionNote,
        scheduleMode: payload.scheduleMode,
        scheduledAtLocal: toLocalInputValue(payload.scheduledAt, timezone),
        canDecide: true,
        canRegenerate: status === "needs_changes" || status === "rejected",
      });
      continue;
    }

    if (status === "published" || status === "scheduled" || status === "rejected" || status === "approved") {
      const whenDate = payload.publishedAt
        ? new Date(payload.publishedAt)
        : payload.scheduledAt
          ? new Date(payload.scheduledAt)
          : row.decidedAt ?? row.createdAt;
      historyItems.push({
        id: row.id,
        channel,
        channelLabel,
        status,
        statusLabel,
        text: payload.text,
        whenLabel: formatWhen(whenDate, timezone, locale),
        whenSort: whenDate.getTime(),
      });
    }
  }

  // Keep one open card per platform (newest already first)
  const seen = new Set<string>();
  const uniqueOpen = openProposals.filter((item) => {
    if (seen.has(item.channel)) return false;
    seen.add(item.channel);
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-4xl">{copy.title}</h1>
          <Badge tone="warn">{copy.premiumBadge}</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-muted-foreground">{copy.subtitle}</p>
      </div>

      <p className="border-l-2 border-[#e10600] px-4 py-1 text-sm text-muted-foreground">{copy.premiumNote}</p>

      {flashMessage ? (
        <p className="border border-[#e10600] bg-[#fff8f7] px-4 py-3 text-sm text-[#e10600]">{flashMessage}</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-2xl">{copy.platformsTitle}</h2>
        <div className="space-y-4">
          {MARKETING_PLATFORMS.map((platform) => {
            const meta = copy.platforms[platform];
            const link = links.find((item) => item.channel === platform);
            const oauth = oauthConfigStatus(platform);
            const statusLabel = link?.connected
              ? copy.statusConnected
              : oauth.configured
                ? copy.statusDisconnected
                : copy.statusNotConfigured;
            return (
              <Card key={platform}>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="text-xl">{meta.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{meta.blurb}</p>
                    {!oauth.configured ? (
                      <p className="mt-2 text-xs text-[#e10600]">
                        {copy.configMissing
                          .replaceAll("{platform}", meta.name)
                          .replaceAll("{missing}", oauth.missing.join(", "))}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={link?.connected ? "good" : oauth.configured ? "neutral" : "warn"}>
                    {statusLabel}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" size="sm">
                    <a href={oauthStartPath(platform)}>{meta.connect}</a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl">{copy.brief.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.brief.subtitle}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <MarketingBriefForm
            dict={copy.brief}
            initialPromote={brief?.promote ?? ""}
            initialBudget={brief?.budget ?? ""}
            initialStyle={brief?.style ?? ""}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl">{copy.proposals.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.proposals.subtitle}</p>
        </div>
        {uniqueOpen.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.proposals.empty}</p>
        ) : (
          <div className="space-y-4">
            {uniqueOpen.map((proposal) => (
              <MarketingProposalCard key={proposal.id} proposal={proposal} dict={copy} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl">{copy.history.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.history.subtitle}</p>
        </div>
        <MarketingHistory items={historyItems} dict={copy.history} />
      </section>

      <section className="rounded-lg border border-border bg-[#fafafa] p-5">
        <h2 className="font-display text-2xl">{copy.whatTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.whatBody}</p>
      </section>
    </div>
  );
}
