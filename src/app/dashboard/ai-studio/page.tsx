import { Suspense } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { AiStudioJobCard, type AiStudioJobCardModel } from "@/components/ai-studio-job-card";
import { AiStudioKlingKeys } from "@/components/ai-studio-kling-keys";
import { AiStudioVideoForm } from "@/components/ai-studio-video-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary, getLocale } from "@/i18n";
import { tenantHasAiStudioAccess } from "@/lib/ai-studio-access";
import { loadKlingKeyState } from "@/lib/ai-studio-kling";
import { requireUser } from "@/lib/auth";
import { MARKETING_PLATFORMS, type MarketingPlatform } from "@/lib/marketing-platforms";
import { tenantDb } from "@/lib/tenant-db";
import { formatWhen } from "@/lib/time";

export const instant = false;

export default function AiStudioPage() {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <AiStudioContent />
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

async function AiStudioContent() {
  const user = await requireUser();
  const [dict, locale, allowed] = await Promise.all([
    getDictionary(),
    getLocale(),
    tenantHasAiStudioAccess(user.tenantId),
  ]);
  const copy = dict.aiStudio;

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl">{copy.title}</h1>
            <Badge tone="warn">{dict.nav.premium}</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Card className="border-[#e10600]/20 bg-[#fafafa]">
          <CardContent className="flex flex-col gap-4 py-8 sm:flex-row sm:items-start">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#e10600]/30 bg-white text-[#e10600]"
              aria-hidden
            >
              <Lock className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <h2 className="font-display text-2xl">{copy.premiumOnlyTitle}</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">{copy.premiumOnlyBody}</p>
              </div>
              <Button asChild variant="brass">
                <Link href="/#pricing">{copy.premiumUpgradeCta}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const db = tenantDb(user.tenantId);
  const agent = await db.agentProfile.findFirst();
  const timezone = agent?.timezone ?? "Europe/Bucharest";

  const [kling, jobs] = await Promise.all([
    loadKlingKeyState(db),
    db.aiVideoJob.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const platformLabels = Object.fromEntries(
    MARKETING_PLATFORMS.map((platform) => [platform, dict.marketing.platforms[platform].name]),
  ) as Record<MarketingPlatform, string>;

  const cards: AiStudioJobCardModel[] = jobs.map((job) => {
    const statusLabel =
      copy.video.statuses[job.status as keyof typeof copy.video.statuses] ?? job.status;
    const publishStatusLabel =
      copy.publish.statuses[job.publishStatus as keyof typeof copy.publish.statuses] ??
      job.publishStatus;
    const channel = job.publishChannel as MarketingPlatform;
    const publishChannelLabel =
      job.publishChannel && MARKETING_PLATFORMS.includes(channel)
        ? platformLabels[channel]
        : job.publishChannel;

    return {
      id: job.id,
      mode: job.mode,
      prompt: job.prompt,
      status: job.status,
      statusLabel,
      aspectRatio: job.aspectRatio,
      resolution: job.resolution,
      durationSec: job.durationSec,
      videoUrl: job.videoUrl,
      errorMessage: job.errorMessage,
      createdLabel: formatWhen(job.createdAt, timezone, locale),
      publishStatus: job.publishStatus,
      publishStatusLabel,
      publishChannel: job.publishChannel,
      publishChannelLabel,
      scheduledAtLocal: toLocalInputValue(
        job.scheduledAt ? job.scheduledAt.toISOString() : null,
        timezone,
      ),
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <div className="max-w-3xl">
        <h1 className="font-display text-4xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{copy.subtitle}</p>
        <p className="mt-4 border-l-2 border-[#e10600] px-4 py-1 text-sm text-muted-foreground">
          {copy.billingNote}
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-xl">{copy.kling.cardTitle}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{copy.kling.cardBlurb}</p>
            </div>
            <Badge tone={kling.connected ? "good" : kling.hasKey ? "neutral" : "warn"}>
              {kling.connected
                ? copy.kling.statusConnected
                : kling.hasKey
                  ? copy.kling.statusSaved
                  : copy.kling.statusMissing}
            </Badge>
          </CardHeader>
          <CardContent>
            <AiStudioKlingKeys
              hasKey={kling.hasKey}
              apiKeyMasked={kling.apiKeyMasked}
              dict={copy.kling}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">{copy.video.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{copy.video.subtitle}</p>
          </CardHeader>
          <CardContent>
            <AiStudioVideoForm disabled={!kling.hasKey} dict={copy.video} />
            {!kling.hasKey ? (
              <p className="mt-3 text-sm text-[#e10600]">{copy.video.connectFirst}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl">{copy.video.jobsTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.video.jobsSubtitle}</p>
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.video.jobsEmpty}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {cards.map((job) => (
              <AiStudioJobCard
                key={job.id}
                job={job}
                dict={copy}
                platformLabels={platformLabels}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-dashed border-border bg-[#fafafa] p-5">
          <h2 className="font-display text-2xl">{copy.stubs.imagesTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy.stubs.imagesBody}</p>
          <Badge className="mt-4" tone="neutral">
            {copy.stubs.comingSoon}
          </Badge>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-[#fafafa] p-5">
          <h2 className="font-display text-2xl">{copy.stubs.contentTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy.stubs.contentBody}</p>
          <Badge className="mt-4" tone="neutral">
            {copy.stubs.comingSoon}
          </Badge>
        </div>
      </section>
    </div>
  );
}
