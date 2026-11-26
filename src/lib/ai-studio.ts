import "server-only";
import {
  emptyPayload,
  parsePayload,
  serializePayload,
  type ProposalStatus,
} from "@/lib/marketing";
import type { MarketingPlatform } from "@/lib/marketing-oauth";
import { isMarketingPlatform } from "@/lib/marketing-oauth";
import { resolveKlingApiKey } from "@/lib/ai-studio-kling";
import {
  createImageToVideoTask,
  createTextToVideoTask,
  KlingApiError,
  pickVideoOutput,
  queryKlingTasks,
} from "@/lib/kling-client";
import {
  isKlingAspectRatio,
  isKlingDuration,
  isKlingResolution,
  type KlingAspectRatio,
  type KlingDuration,
  type KlingResolution,
} from "@/lib/kling-constants";
import type { TenantClient } from "@/lib/tenant-db";

export const AI_STUDIO_VIDEO_CHANNEL_PREFIX = "ai_studio_video";

export const VIDEO_MODES = ["text_to_video", "image_to_video"] as const;
export type VideoMode = (typeof VIDEO_MODES)[number];

export const VIDEO_JOB_STATUSES = ["submitted", "processing", "succeeded", "failed"] as const;
export type VideoJobStatus = (typeof VIDEO_JOB_STATUSES)[number];

export const PUBLISH_STATUSES = ["none", "pending_approval", "scheduled", "published", "rejected"] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export type CreateVideoJobInput = {
  mode: VideoMode;
  prompt: string;
  imageUrl?: string;
  aspectRatio?: string;
  resolution?: string;
  durationSec?: number;
};

export function isVideoMode(value: string): value is VideoMode {
  return (VIDEO_MODES as readonly string[]).includes(value);
}

export async function createVideoJob(
  db: TenantClient,
  tenantId: string,
  input: CreateVideoJobInput,
  fetchImpl: typeof fetch = fetch,
) {
  const apiKey = await resolveKlingApiKey(db);
  if (!apiKey) {
    return { ok: false as const, reason: "missing_key" as const };
  }

  const prompt = input.prompt.trim();
  if (!prompt) return { ok: false as const, reason: "prompt_required" as const };

  const mode = input.mode;
  const imageUrl = (input.imageUrl ?? "").trim();
  if (mode === "image_to_video" && !imageUrl) {
    return { ok: false as const, reason: "image_required" as const };
  }

  const aspectRaw = input.aspectRatio ?? "";
  const resolutionRaw = input.resolution ?? "";
  const durationRaw = Number(input.durationSec);
  const aspectRatio: KlingAspectRatio = isKlingAspectRatio(aspectRaw) ? aspectRaw : "16:9";
  const resolution: KlingResolution = isKlingResolution(resolutionRaw) ? resolutionRaw : "720p";
  const durationSec: KlingDuration = isKlingDuration(durationRaw) ? durationRaw : 5;

  const job = await db.aiVideoJob.create({
    data: {
      tenantId,
      mode,
      prompt,
      imageUrl: mode === "image_to_video" ? imageUrl : "",
      aspectRatio,
      resolution,
      durationSec,
      status: "submitted",
    },
  });

  try {
    const created =
      mode === "text_to_video"
        ? await createTextToVideoTask(
            apiKey,
            {
              prompt,
              aspectRatio,
              resolution,
              duration: durationSec,
              externalTaskId: job.id,
            },
            fetchImpl,
          )
        : await createImageToVideoTask(
            apiKey,
            {
              prompt,
              imageUrl,
              resolution,
              duration: durationSec,
              externalTaskId: job.id,
            },
            fetchImpl,
          );

    await db.aiVideoJob.updateMany({
      where: { id: job.id },
      data: {
        klingTaskId: created.id,
        status: created.status,
      },
    });

    return {
      ok: true as const,
      jobId: job.id,
      klingTaskId: created.id,
      status: created.status,
    };
  } catch (error) {
    const message = error instanceof KlingApiError ? error.message : "Kling request failed.";
    await db.aiVideoJob.updateMany({
      where: { id: job.id },
      data: { status: "failed", errorMessage: message },
    });
    return { ok: false as const, reason: "kling_error" as const, message, jobId: job.id };
  }
}

export async function refreshVideoJob(
  db: TenantClient,
  jobId: string,
  fetchImpl: typeof fetch = fetch,
) {
  const job = await db.aiVideoJob.findFirst({ where: { id: jobId } });
  if (!job) return { ok: false as const, reason: "missing" as const };
  if (!job.klingTaskId) return { ok: false as const, reason: "no_task" as const };
  if (job.status === "succeeded" || job.status === "failed") {
    return { ok: true as const, job };
  }

  const apiKey = await resolveKlingApiKey(db);
  if (!apiKey) return { ok: false as const, reason: "missing_key" as const };

  try {
    const [task] = await queryKlingTasks(apiKey, [job.klingTaskId], fetchImpl);
    if (!task) return { ok: false as const, reason: "not_found" as const };

    const { videoUrl, watermarkUrl } = pickVideoOutput(task);
    const data = {
      status: task.status,
      videoUrl: videoUrl || job.videoUrl,
      watermarkUrl: watermarkUrl || job.watermarkUrl,
      errorMessage: task.status === "failed" ? task.message || job.errorMessage || "Failed" : "",
    };
    await db.aiVideoJob.updateMany({ where: { id: job.id }, data });
    const updated = await db.aiVideoJob.findFirst({ where: { id: job.id } });
    return { ok: true as const, job: updated ?? { ...job, ...data } };
  } catch (error) {
    const message = error instanceof KlingApiError ? error.message : "Kling status check failed.";
    return { ok: false as const, reason: "kling_error" as const, message };
  }
}

export async function proposeVideoPublish(
  db: TenantClient,
  tenantId: string,
  input: { jobId: string; channel: string; caption: string },
) {
  const channel = input.channel;
  if (!isMarketingPlatform(channel)) {
    return { ok: false as const, reason: "invalid_channel" as const };
  }
  const job = await db.aiVideoJob.findFirst({ where: { id: input.jobId } });
  if (!job || job.status !== "succeeded" || !job.videoUrl) {
    return { ok: false as const, reason: "not_ready" as const };
  }
  if (job.publishStatus === "pending_approval" || job.publishStatus === "scheduled") {
    return { ok: false as const, reason: "already_proposed" as const };
  }

  const caption = input.caption.trim() || job.prompt;
  const proposal = await db.contentProposal.create({
    data: {
      tenantId,
      channel,
      title: `AI Studio video · ${channel}`,
      status: "pending_approval" satisfies ProposalStatus,
      body: serializePayload({
        ...emptyPayload(caption),
        text: JSON.stringify({
          kind: "ai_studio_video",
          jobId: job.id,
          videoUrl: job.videoUrl,
          caption,
        }),
      }),
    },
  });

  await db.aiVideoJob.updateMany({
    where: { id: job.id },
    data: {
      publishStatus: "pending_approval",
      publishChannel: channel,
      proposalId: proposal.id,
      scheduledAt: null,
      publishedAt: null,
    },
  });

  return { ok: true as const, proposalId: proposal.id };
}

export async function decideVideoPublish(
  db: TenantClient,
  input: {
    jobId: string;
    decision: "approve" | "reject";
    scheduleMode: "now" | "scheduled";
    scheduledAt?: string | null;
  },
) {
  const job = await db.aiVideoJob.findFirst({ where: { id: input.jobId } });
  if (!job || job.publishStatus !== "pending_approval") {
    return { ok: false as const, reason: "not_pending" as const };
  }

  if (input.decision === "reject") {
    await db.aiVideoJob.updateMany({
      where: { id: job.id },
      data: { publishStatus: "rejected", scheduledAt: null, publishedAt: null },
    });
    if (job.proposalId) {
      await db.contentProposal.updateMany({
        where: { id: job.proposalId },
        data: { status: "rejected" satisfies ProposalStatus, decidedAt: new Date() },
      });
    }
    return { ok: true as const };
  }

  let scheduledAt: Date | null = null;
  if (input.scheduleMode === "scheduled") {
    const raw = (input.scheduledAt ?? "").trim();
    if (!raw) return { ok: false as const, reason: "schedule_required" as const };
    const when = new Date(raw);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now() - 60_000) {
      return { ok: false as const, reason: "schedule_invalid" as const };
    }
    scheduledAt = when;
  }

  if (input.scheduleMode === "now") {
    const publishedAt = new Date();
    await db.aiVideoJob.updateMany({
      where: { id: job.id },
      data: {
        publishStatus: "published",
        publishedAt,
        scheduledAt: null,
      },
    });
    if (job.proposalId) {
      const proposal = await db.contentProposal.findFirst({ where: { id: job.proposalId } });
      const payload = parsePayload(proposal?.body ?? "{}");
      await db.contentProposal.updateMany({
        where: { id: job.proposalId },
        data: {
          status: "published" satisfies ProposalStatus,
          decidedAt: publishedAt,
          body: serializePayload({
            ...payload,
            scheduleMode: "now",
            scheduledAt: null,
            publishedAt: publishedAt.toISOString(),
          }),
        },
      });
    }
  } else {
    await db.aiVideoJob.updateMany({
      where: { id: job.id },
      data: {
        publishStatus: "scheduled",
        scheduledAt,
        publishedAt: null,
      },
    });
    if (job.proposalId) {
      const proposal = await db.contentProposal.findFirst({ where: { id: job.proposalId } });
      const payload = parsePayload(proposal?.body ?? "{}");
      await db.contentProposal.updateMany({
        where: { id: job.proposalId },
        data: {
          status: "scheduled" satisfies ProposalStatus,
          decidedAt: new Date(),
          body: serializePayload({
            ...payload,
            scheduleMode: "scheduled",
            scheduledAt: scheduledAt!.toISOString(),
            publishedAt: null,
          }),
        },
      });
    }
  }

  return { ok: true as const };
}

export type PublishChannel = MarketingPlatform;
