/**
 * Channel seam. Phase 1 implements web_widget only.
 * Later adapters (WhatsApp, phone, TikTok, Facebook, Instagram, YouTube) translate
 * their webhooks into InboundMessage and call handleInbound(). Replies go
 * back out through ChannelAdapter.send. No adapter here publishes or spends.
 */
export const CHANNELS = [
  "web_widget",
  "dashboard",
  "whatsapp",
  "phone",
  "tiktok",
  "facebook",
  "instagram",
  "youtube",
] as const;

export type ChannelId = (typeof CHANNELS)[number];

export const FUTURE_CHANNELS = [
  "whatsapp",
  "phone",
  "tiktok",
  "facebook",
  "instagram",
  "youtube",
] as const satisfies readonly ChannelId[];

export type InboundMessage = {
  tenantId: string;
  channel: ChannelId;
  visitorKey: string;
  text: string;
  receivedAt: Date;
};

export interface ChannelAdapter {
  id: ChannelId;
  // parseWebhook(request: Request): Promise<InboundMessage | null>;
  // send(tenantId: string, visitorKey: string, text: string): Promise<void>;
}

/** Statuses a future marketing agent may set. Publishing is a separate, human step. */
export const PROPOSAL_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "published",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type ProposalDraft = {
  tenantId: string;
  channel: "facebook" | "instagram" | "tiktok" | "youtube";
  title: string;
  body: string;
};
