"use server";

import { revalidatePath } from "next/cache";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import {
  ensureDraftProposals,
  emptyPayload,
  parsePayload,
  saveBrief,
  serializePayload,
  type ProposalStatus,
} from "@/lib/marketing";
import {
  clearPlatformOAuthKeys,
  isMarketingPlatform,
  savePlatformOAuthKeys,
} from "@/lib/marketing-oauth";
import { tenantDb } from "@/lib/tenant-db";

export type MarketingActionState = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/dashboard/marketing");
}

export async function saveMarketingBriefAction(
  _prev: MarketingActionState,
  formData: FormData,
): Promise<MarketingActionState> {
  const user = await requireUser();
  const dict = await getDictionary();
  const locale = await getLocale();
  const promote = String(formData.get("promote") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();
  const style = String(formData.get("style") ?? "").trim();
  if (!promote || !budget || !style) {
    return { ok: false, error: dict.marketing.brief.required };
  }
  const db = tenantDb(user.tenantId);
  await saveBrief(db, user.tenantId, { promote, budget, style });
  const brief = { promote, budget, style, updatedAt: new Date().toISOString() };
  await ensureDraftProposals(db, user.tenantId, brief, locale);
  refresh();
  return { ok: true };
}

export async function decideProposalAction(
  _prev: MarketingActionState,
  formData: FormData,
): Promise<MarketingActionState> {
  const user = await requireUser();
  const dict = await getDictionary();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "") as "approve" | "revise" | "reject";
  const revisionNote = String(formData.get("revisionNote") ?? "").trim();
  const scheduleMode = String(formData.get("scheduleMode") ?? "now") === "scheduled" ? "scheduled" : "now";
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();

  if (!id || !["approve", "revise", "reject"].includes(decision)) {
    return { ok: false, error: dict.marketing.proposals.invalid };
  }

  const db = tenantDb(user.tenantId);
  const proposal = await db.contentProposal.findFirst({ where: { id } });
  if (!proposal || !isMarketingPlatform(proposal.channel)) {
    return { ok: false, error: dict.marketing.proposals.missing };
  }

  const payload = parsePayload(proposal.body);

  if (decision === "reject") {
    await db.contentProposal.updateMany({
      where: { id },
      data: {
        status: "rejected" satisfies ProposalStatus,
        decidedAt: new Date(),
        body: serializePayload({ ...payload, revisionNote: "" }),
      },
    });
    refresh();
    return { ok: true };
  }

  if (decision === "revise") {
    if (!revisionNote) {
      return { ok: false, error: dict.marketing.proposals.revisionRequired };
    }
    await db.contentProposal.updateMany({
      where: { id },
      data: {
        status: "needs_changes" satisfies ProposalStatus,
        decidedAt: new Date(),
        body: serializePayload({ ...payload, revisionNote }),
      },
    });
    refresh();
    return { ok: true };
  }

  // approve — require explicit schedule choice; never publish without approval path
  let scheduledAt: string | null = null;
  if (scheduleMode === "scheduled") {
    if (!scheduledAtRaw) {
      return { ok: false, error: dict.marketing.schedule.required };
    }
    const when = new Date(scheduledAtRaw);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now() - 60_000) {
      return { ok: false, error: dict.marketing.schedule.invalid };
    }
    scheduledAt = when.toISOString();
  }

  if (scheduleMode === "now") {
    await db.contentProposal.updateMany({
      where: { id },
      data: {
        status: "published" satisfies ProposalStatus,
        decidedAt: new Date(),
        body: serializePayload({
          ...payload,
          scheduleMode: "now",
          scheduledAt: null,
          publishedAt: new Date().toISOString(),
          revisionNote: "",
        }),
      },
    });
  } else {
    await db.contentProposal.updateMany({
      where: { id },
      data: {
        status: "scheduled" satisfies ProposalStatus,
        decidedAt: new Date(),
        body: serializePayload({
          ...payload,
          scheduleMode: "scheduled",
          scheduledAt,
          publishedAt: null,
          revisionNote: "",
        }),
      },
    });
  }

  refresh();
  return { ok: true };
}

export async function savePlatformKeysAction(
  _prev: MarketingActionState,
  formData: FormData,
): Promise<MarketingActionState> {
  const user = await requireUser();
  const dict = await getDictionary();
  const platform = String(formData.get("platform") ?? "");
  if (!isMarketingPlatform(platform)) {
    return { ok: false, error: dict.marketing.keys.invalidPlatform };
  }
  const clientId = String(formData.get("clientId") ?? "");
  const clientSecret = String(formData.get("clientSecret") ?? "");
  const db = tenantDb(user.tenantId);
  const result = await savePlatformOAuthKeys(db, user.tenantId, platform, { clientId, clientSecret });
  if (!result.ok) {
    return { ok: false, error: dict.marketing.keys.required };
  }
  refresh();
  return { ok: true };
}

export async function clearPlatformKeysAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const platform = String(formData.get("platform") ?? "");
  if (!isMarketingPlatform(platform)) return;
  const db = tenantDb(user.tenantId);
  await clearPlatformOAuthKeys(db, platform);
  refresh();
}

export async function regenerateDraftAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const locale = await getLocale();
  const id = String(formData.get("id") ?? "");
  const db = tenantDb(user.tenantId);
  const proposal = await db.contentProposal.findFirst({ where: { id } });
  if (!proposal || !isMarketingPlatform(proposal.channel)) return;

  const { loadBrief, draftText } = await import("@/lib/marketing");
  const brief = await loadBrief(db);
  if (!brief) return;

  const payload = emptyPayload(draftText(proposal.channel, brief, locale));
  await db.contentProposal.updateMany({
    where: { id },
    data: {
      status: "pending_approval",
      decidedAt: null,
      body: serializePayload(payload),
    },
  });
  refresh();
}
