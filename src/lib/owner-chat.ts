import "server-only";
import { completeOwnerTurn } from "@/lib/owner-llm";
import type { OwnerToolResult } from "@/lib/owner-tools";
import { quoteServices } from "@/lib/fx-rate";
import { formatOpenings } from "@/lib/services";
import { tenantDb } from "@/lib/tenant-db";
import type { ChatTurn } from "@/lib/llm/types";

const OWNER_CHANNEL = "dashboard";

export type OwnerChatMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export async function loadOwnerChat(tenantId: string, userId: string) {
  const db = tenantDb(tenantId);
  const anonKey = `owner:${userId}`;
  let visitor = await db.visitor.findFirst({ where: { anonKey } });
  if (!visitor) {
    visitor = await db.visitor.create({
      data: {
        tenantId,
        anonKey,
        source: OWNER_CHANNEL,
        name: "Owner",
        email: "",
        phone: "",
      },
    });
  }
  let conversation = await db.conversation.findFirst({
    where: { visitorId: visitor.id, channel: OWNER_CHANNEL, status: "open" },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        tenantId,
        visitorId: visitor.id,
        channel: OWNER_CHANNEL,
        status: "open",
        lastMessageAt: new Date(),
      },
    });
  }
  const rows = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 80,
  });
  const agent = await db.agentProfile.findFirst();
  return {
    conversationId: conversation.id,
    visitorId: visitor.id,
    agentEnabled: Boolean(agent?.enabled),
    businessName: agent?.businessName ?? "",
    messages: rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    })) satisfies OwnerChatMessage[],
  };
}

export async function sendOwnerChatMessage(input: {
  tenantId: string;
  userId: string;
  text: string;
  locale: "ro" | "en";
}): Promise<{ messages: OwnerChatMessage[]; actions: OwnerToolResult[] }> {
  const text = input.text.replace(/\u0000/g, "").trim().slice(0, 2000);
  if (!text) {
    const loaded = await loadOwnerChat(input.tenantId, input.userId);
    return { messages: loaded.messages, actions: [] };
  }

  const db = tenantDb(input.tenantId);
  const loaded = await loadOwnerChat(input.tenantId, input.userId);
  const agent = await db.agentProfile.findFirst();
  if (!agent) throw new Error("missing_agent");
  const openings = await db.availabilityRule.findMany();

  await db.message.create({
    data: {
      tenantId: input.tenantId,
      conversationId: loaded.conversationId,
      role: "owner",
      content: text,
    },
  });

  const historyRows = await db.message.findMany({
    where: { conversationId: loaded.conversationId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const turns: ChatTurn[] = historyRows
    .filter((row) => row.role === "owner" || row.role === "assistant" || row.role === "visitor" || row.role === "user")
    .map((row) => ({
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content,
    }));

  const quoted = await quoteServices(agent.servicesJson, input.locale);
  const result = await completeOwnerTurn({
    tenantId: input.tenantId,
    latest: text,
    messages: turns,
    context: {
      locale: input.locale,
      businessName: agent.businessName,
      description: agent.description,
      services: quoted.presented,
      hoursText: formatOpenings(openings, input.locale),
      tone: agent.tone,
      customInstructions: agent.customInstructions,
      greeting: agent.greeting,
      slotMinutes: agent.slotMinutes,
      timezone: agent.timezone,
      fx: { ronPerGbp: quoted.quote.ronPerGbp, source: quoted.quote.source },
    },
  });

  const actionBlock =
    result.actions.length > 0
      ? `\n\n${result.actions.map((action) => `▸ ${action.summary}`).join("\n")}`
      : "";
  const reply = `${result.text.trim()}${actionBlock}`.trim();

  await db.message.create({
    data: {
      tenantId: input.tenantId,
      conversationId: loaded.conversationId,
      role: "assistant",
      content: reply,
    },
  });
  await db.conversation.updateMany({
    where: { id: loaded.conversationId },
    data: { lastMessageAt: new Date(), status: "open" },
  });

  const messages = await db.message.findMany({
    where: { conversationId: loaded.conversationId },
    orderBy: { createdAt: "asc" },
    take: 80,
  });

  return {
    actions: result.actions,
    messages: messages.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
