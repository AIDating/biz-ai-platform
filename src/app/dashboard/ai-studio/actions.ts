"use server";

import { revalidatePath } from "next/cache";
import {
  createVideoJob,
  decideVideoPublish,
  isVideoMode,
  proposeVideoPublish,
  refreshVideoJob,
} from "@/lib/ai-studio";
import { tenantHasAiStudioAccess } from "@/lib/ai-studio-access";
import { clearKlingApiKey, saveKlingApiKey } from "@/lib/ai-studio-kling";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n";
import { isMarketingPlatform } from "@/lib/marketing-oauth";
import { tenantDb } from "@/lib/tenant-db";

export type AiStudioActionState = { ok: boolean; error?: string; jobId?: string };

function refresh() {
  revalidatePath("/dashboard/ai-studio");
}

async function requireAiStudioTenant() {
  const user = await requireUser();
  const dict = await getDictionary();
  const allowed = await tenantHasAiStudioAccess(user.tenantId);
  if (!allowed) {
    return { ok: false as const, user, dict, error: dict.aiStudio.premiumRequired };
  }
  return { ok: true as const, user, dict };
}

export async function saveKlingKeyAction(
  _prev: AiStudioActionState,
  formData: FormData,
): Promise<AiStudioActionState> {
  const gate = await requireAiStudioTenant();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { user, dict } = gate;
  const apiKey = String(formData.get("apiKey") ?? "");
  const db = tenantDb(user.tenantId);
  const result = await saveKlingApiKey(db, user.tenantId, { apiKey });
  if (!result.ok) {
    return { ok: false, error: dict.aiStudio.kling.required };
  }
  refresh();
  return { ok: true };
}

export async function clearKlingKeyAction(): Promise<void> {
  const gate = await requireAiStudioTenant();
  if (!gate.ok) return;
  const db = tenantDb(gate.user.tenantId);
  await clearKlingApiKey(db);
  refresh();
}

export async function createVideoJobAction(
  _prev: AiStudioActionState,
  formData: FormData,
): Promise<AiStudioActionState> {
  const gate = await requireAiStudioTenant();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { user, dict } = gate;
  const modeRaw = String(formData.get("mode") ?? "");
  if (!isVideoMode(modeRaw)) {
    return { ok: false, error: dict.aiStudio.video.invalidMode };
  }
  const db = tenantDb(user.tenantId);
  const result = await createVideoJob(db, user.tenantId, {
    mode: modeRaw,
    prompt: String(formData.get("prompt") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    aspectRatio: String(formData.get("aspectRatio") ?? ""),
    resolution: String(formData.get("resolution") ?? ""),
    durationSec: Number(formData.get("durationSec") ?? 5),
  });

  if (!result.ok) {
    const errors = dict.aiStudio.video.errors;
    if (result.reason === "missing_key") return { ok: false, error: errors.missingKey };
    if (result.reason === "prompt_required") return { ok: false, error: errors.promptRequired };
    if (result.reason === "image_required") return { ok: false, error: errors.imageRequired };
    return { ok: false, error: result.message || errors.klingFailed, jobId: result.jobId };
  }

  refresh();
  return { ok: true, jobId: result.jobId };
}

export async function refreshVideoJobAction(formData: FormData): Promise<void> {
  const gate = await requireAiStudioTenant();
  if (!gate.ok) return;
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;
  const db = tenantDb(gate.user.tenantId);
  await refreshVideoJob(db, jobId);
  refresh();
}

export async function proposePublishAction(
  _prev: AiStudioActionState,
  formData: FormData,
): Promise<AiStudioActionState> {
  const gate = await requireAiStudioTenant();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { user, dict } = gate;
  const jobId = String(formData.get("jobId") ?? "");
  const channel = String(formData.get("channel") ?? "");
  const caption = String(formData.get("caption") ?? "");
  if (!jobId || !isMarketingPlatform(channel)) {
    return { ok: false, error: dict.aiStudio.publish.invalid };
  }
  const db = tenantDb(user.tenantId);
  const result = await proposeVideoPublish(db, user.tenantId, { jobId, channel, caption });
  if (!result.ok) {
    const map = {
      invalid_channel: dict.aiStudio.publish.invalid,
      not_ready: dict.aiStudio.publish.notReady,
      already_proposed: dict.aiStudio.publish.alreadyProposed,
    } as const;
    return { ok: false, error: map[result.reason] };
  }
  refresh();
  return { ok: true };
}

export async function decidePublishAction(
  _prev: AiStudioActionState,
  formData: FormData,
): Promise<AiStudioActionState> {
  const gate = await requireAiStudioTenant();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { user, dict } = gate;
  const jobId = String(formData.get("jobId") ?? "");
  const decision = String(formData.get("decision") ?? "") as "approve" | "reject";
  const scheduleMode =
    String(formData.get("scheduleMode") ?? "now") === "scheduled" ? "scheduled" : "now";
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();

  if (!jobId || !["approve", "reject"].includes(decision)) {
    return { ok: false, error: dict.aiStudio.publish.invalid };
  }

  const db = tenantDb(user.tenantId);
  const result = await decideVideoPublish(db, {
    jobId,
    decision,
    scheduleMode,
    scheduledAt,
  });
  if (!result.ok) {
    if (result.reason === "schedule_required") {
      return { ok: false, error: dict.aiStudio.publish.scheduleRequired };
    }
    if (result.reason === "schedule_invalid") {
      return { ok: false, error: dict.aiStudio.publish.scheduleInvalid };
    }
    return { ok: false, error: dict.aiStudio.publish.notPending };
  }
  refresh();
  return { ok: true };
}
