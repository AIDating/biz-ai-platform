"use client";

import { useActionState, useState } from "react";
import {
  decidePublishAction,
  proposePublishAction,
  refreshVideoJobAction,
  type AiStudioActionState,
} from "@/app/dashboard/ai-studio/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/ro";
import { MARKETING_PLATFORMS, type MarketingPlatform } from "@/lib/marketing-oauth";

const initial: AiStudioActionState = { ok: false };

export type AiStudioJobCardModel = {
  id: string;
  mode: string;
  prompt: string;
  status: string;
  statusLabel: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  videoUrl: string;
  errorMessage: string;
  createdLabel: string;
  publishStatus: string;
  publishStatusLabel: string;
  publishChannel: string;
  publishChannelLabel: string;
  scheduledAtLocal: string;
};

export function AiStudioJobCard({
  job,
  dict,
  platformLabels,
}: {
  job: AiStudioJobCardModel;
  dict: Dictionary["aiStudio"];
  platformLabels: Record<MarketingPlatform, string>;
}) {
  const [proposeState, proposeAction, proposePending] = useActionState(proposePublishAction, initial);
  const [decideState, decideAction, decidePending] = useActionState(decidePublishAction, initial);
  const [scheduleMode, setScheduleMode] = useState<"now" | "scheduled">("now");

  const tone =
    job.status === "succeeded"
      ? "good"
      : job.status === "failed"
        ? "bad"
        : job.status === "processing"
          ? "warn"
          : "neutral";

  return (
    <article className="space-y-4 rounded-lg border border-border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{job.createdLabel}</p>
          <p className="text-sm font-medium">
            {job.mode === "image_to_video" ? dict.video.modeImage : dict.video.modeText}
            {" · "}
            {job.resolution}
            {" · "}
            {job.durationSec}s
            {job.mode === "text_to_video" ? ` · ${job.aspectRatio}` : null}
          </p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.prompt}</p>
        </div>
        <Badge tone={tone}>{job.statusLabel}</Badge>
      </div>

      {job.errorMessage ? <p className="text-sm text-[#e10600]">{job.errorMessage}</p> : null}

      {job.videoUrl ? (
        <div className="space-y-2">
          <video
            className="max-h-80 w-full rounded-md border border-border bg-black"
            src={job.videoUrl}
            controls
            playsInline
          />
          <Button asChild variant="outline" size="sm">
            <a href={job.videoUrl} target="_blank" rel="noreferrer" download>
              {dict.video.download}
            </a>
          </Button>
        </div>
      ) : null}

      {job.status === "submitted" || job.status === "processing" ? (
        <form action={refreshVideoJobAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <Button type="submit" variant="outline" size="sm">
            {dict.video.refresh}
          </Button>
        </form>
      ) : null}

      {job.status === "succeeded" && job.publishStatus === "none" ? (
        <form action={proposeAction} className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium">{dict.publish.title}</p>
          <p className="text-xs text-muted-foreground">{dict.publish.subtitle}</p>
          <input type="hidden" name="jobId" value={job.id} />
          <div className="space-y-1.5">
            <Label htmlFor={`channel-${job.id}`}>{dict.publish.channelLabel}</Label>
            <select
              id={`channel-${job.id}`}
              name="channel"
              className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              defaultValue="instagram"
            >
              {MARKETING_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {platformLabels[platform]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`caption-${job.id}`}>{dict.publish.captionLabel}</Label>
            <Textarea
              id={`caption-${job.id}`}
              name="caption"
              rows={3}
              defaultValue={job.prompt}
              placeholder={dict.publish.captionPlaceholder}
            />
          </div>
          {proposeState.error ? <p className="text-sm text-[#e10600]">{proposeState.error}</p> : null}
          <Button type="submit" variant="brass" size="sm" disabled={proposePending}>
            {proposePending ? dict.publish.proposing : dict.publish.propose}
          </Button>
        </form>
      ) : null}

      {job.publishStatus === "pending_approval" ? (
        <form action={decideAction} className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium">{dict.publish.approvalTitle}</p>
          <p className="text-xs text-muted-foreground">
            {dict.publish.approvalGate.replaceAll("{channel}", job.publishChannelLabel || job.publishChannel)}
          </p>
          <input type="hidden" name="jobId" value={job.id} />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="scheduleMode"
                value="now"
                checked={scheduleMode === "now"}
                onChange={() => setScheduleMode("now")}
              />
              {dict.publish.now}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="scheduleMode"
                value="scheduled"
                checked={scheduleMode === "scheduled"}
                onChange={() => setScheduleMode("scheduled")}
              />
              {dict.publish.later}
            </label>
          </div>
          {scheduleMode === "scheduled" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`when-${job.id}`}>{dict.publish.when}</Label>
              <Input
                id={`when-${job.id}`}
                name="scheduledAt"
                type="datetime-local"
                defaultValue={job.scheduledAtLocal}
                required={scheduleMode === "scheduled"}
              />
            </div>
          ) : (
            <input type="hidden" name="scheduledAt" value="" />
          )}
          {decideState.error ? <p className="text-sm text-[#e10600]">{decideState.error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="decision"
              value="approve"
              variant="brass"
              size="sm"
              disabled={decidePending}
            >
              {dict.publish.approve}
            </Button>
            <Button
              type="submit"
              name="decision"
              value="reject"
              variant="outline"
              size="sm"
              disabled={decidePending}
            >
              {dict.publish.reject}
            </Button>
          </div>
        </form>
      ) : null}

      {job.publishStatus === "scheduled" || job.publishStatus === "published" || job.publishStatus === "rejected" ? (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          {job.publishStatusLabel}
          {job.publishChannelLabel ? ` · ${job.publishChannelLabel}` : null}
        </p>
      ) : null}
    </article>
  );
}
