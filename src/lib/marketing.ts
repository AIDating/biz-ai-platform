import "server-only";
import type { MarketingPlatform } from "@/lib/marketing-oauth";
import { MARKETING_PLATFORMS } from "@/lib/marketing-oauth";
import type { TenantClient } from "@/lib/tenant-db";

export const BRIEF_CHANNEL = "marketing_brief";

export const PROPOSAL_STATUSES = [
  "pending_approval",
  "needs_changes",
  "rejected",
  "approved",
  "scheduled",
  "published",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type MarketingBrief = {
  promote: string;
  budget: string;
  style: string;
  updatedAt: string;
};

export type ProposalPayload = {
  text: string;
  scheduleMode: "now" | "scheduled";
  scheduledAt: string | null;
  publishedAt: string | null;
  revisionNote: string;
};

export function emptyPayload(text = ""): ProposalPayload {
  return {
    text,
    scheduleMode: "now",
    scheduledAt: null,
    publishedAt: null,
    revisionNote: "",
  };
}

export function parseBrief(configJson: string | null | undefined): MarketingBrief | null {
  if (!configJson) return null;
  try {
    const data = JSON.parse(configJson) as Partial<MarketingBrief>;
    if (!data.promote && !data.budget && !data.style) return null;
    return {
      promote: String(data.promote ?? ""),
      budget: String(data.budget ?? ""),
      style: String(data.style ?? ""),
      updatedAt: String(data.updatedAt ?? ""),
    };
  } catch {
    return null;
  }
}

export function serializeBrief(brief: Omit<MarketingBrief, "updatedAt">): string {
  return JSON.stringify({
    promote: brief.promote.trim(),
    budget: brief.budget.trim(),
    style: brief.style.trim(),
    updatedAt: new Date().toISOString(),
  } satisfies MarketingBrief);
}

export function parsePayload(body: string): ProposalPayload {
  try {
    const data = JSON.parse(body) as Partial<ProposalPayload> & { text?: string };
    if (typeof data.text === "string") {
      return {
        text: data.text,
        scheduleMode: data.scheduleMode === "scheduled" ? "scheduled" : "now",
        scheduledAt: data.scheduledAt ?? null,
        publishedAt: data.publishedAt ?? null,
        revisionNote: data.revisionNote ?? "",
      };
    }
  } catch {
    /* plain text legacy */
  }
  return emptyPayload(body);
}

export function serializePayload(payload: ProposalPayload): string {
  return JSON.stringify(payload);
}

export function draftText(platform: MarketingPlatform, brief: MarketingBrief, locale: "ro" | "en"): string {
  if (locale === "en") {
    return [
      `Draft for ${platform}: promote „${brief.promote.trim()}”.`,
      `Budget direction: ${brief.budget.trim() || "not set"}.`,
      `Visual / tone: ${brief.style.trim() || "not set"}.`,
      `Nothing is published until you approve this draft.`,
    ].join("\n");
  }
  return [
    `Draft pentru ${platform}: promovăm „${brief.promote.trim()}”.`,
    `Direcție de buget: ${brief.budget.trim() || "nesetat"}.`,
    `Stil / ton: ${brief.style.trim() || "nesetat"}.`,
    `Nimic nu se publică până nu aprobați acest draft.`,
  ].join("\n");
}

export async function loadBrief(db: TenantClient): Promise<MarketingBrief | null> {
  const row = await db.integration.findFirst({ where: { channel: BRIEF_CHANNEL } });
  return parseBrief(row?.configJson);
}

export async function saveBrief(
  db: TenantClient,
  tenantId: string,
  brief: Omit<MarketingBrief, "updatedAt">,
) {
  const existing = await db.integration.findFirst({ where: { channel: BRIEF_CHANNEL } });
  const configJson = serializeBrief(brief);
  if (existing) {
    await db.integration.updateMany({
      where: { id: existing.id },
      data: { configJson, enabled: true },
    });
  } else {
    await db.integration.create({
      data: { tenantId, channel: BRIEF_CHANNEL, enabled: true, configJson },
    });
  }
}

export async function ensureDraftProposals(
  db: TenantClient,
  tenantId: string,
  brief: MarketingBrief,
  locale: "ro" | "en",
) {
  for (const platform of MARKETING_PLATFORMS) {
    const open = await db.contentProposal.findFirst({
      where: {
        channel: platform,
        status: { in: ["pending_approval", "needs_changes", "approved", "scheduled"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (open) continue;
    await db.contentProposal.create({
      data: {
        tenantId,
        channel: platform,
        title: platform,
        status: "pending_approval",
        body: serializePayload(emptyPayload(draftText(platform, brief, locale))),
      },
    });
  }
}

export type PlatformLinkState = {
  channel: MarketingPlatform;
  connected: boolean;
  accountLabel: string | null;
};

export async function loadPlatformLinks(db: TenantClient): Promise<PlatformLinkState[]> {
  const rows = await db.integration.findMany({
    where: { channel: { in: [...MARKETING_PLATFORMS] } },
  });
  return MARKETING_PLATFORMS.map((channel) => {
    const row = rows.find((item) => item.channel === channel);
    let accountLabel: string | null = null;
    let connected = false;
    if (row?.enabled) {
      connected = true;
      try {
        const cfg = JSON.parse(row.configJson) as { accountLabel?: string };
        accountLabel = cfg.accountLabel ?? null;
      } catch {
        accountLabel = null;
      }
    }
    return { channel, connected, accountLabel };
  });
}
