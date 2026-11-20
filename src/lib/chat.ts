import type { ChannelId } from "@/lib/channels";
import { en } from "@/i18n/en";
import { ro } from "@/i18n/ro";
import { getLlm, llmMode } from "@/lib/llm";
import { LlmError } from "@/lib/llm/types";
import type { AgentContext } from "@/lib/llm/types";
import { quoteServices } from "@/lib/fx-rate";
import { formatOpenings } from "@/lib/services";
import { tenantDb } from "@/lib/tenant-db";
import { executeTool, saveLeadFromVisitor } from "@/lib/tools";
import { bookAvailableSlot, BookingConflictError, SlotUnavailableError } from "@/lib/booking";
import { describeSlot, getAvailableSlots } from "@/lib/slots";

export type HandleInboundInput = {
  tenantId: string;
  channel: ChannelId;
  visitorKey: string;
  text: string;
  slotStartsAt?: string | null;
  locale?: "ro" | "en";
  contact?: { name?: string; phone?: string; email?: string; service?: string };
};

export type PublicSlot = ReturnType<typeof describeSlot>;

export async function handleInbound(input: HandleInboundInput) {
  const locale = input.locale === "en" ? "en" : "ro";
  const dict = locale === "en" ? en : ro;
  const db = tenantDb(input.tenantId);
  const agent = await db.agentProfile.findFirst();
  if (!agent) throw new Error("This business has no agent profile.");
  const openings = await db.availabilityRule.findMany();
  const text = input.text.replace(/\u0000/g, "").trim().slice(0, 2000);

  let visitor = await db.visitor.findFirst({ where: { anonKey: input.visitorKey } });
  if (!visitor) {
    visitor = await db.visitor.create({
      data: {
        anonKey: input.visitorKey,
        source: input.channel,
        name: "",
        email: "",
        phone: "",
        tenantId: input.tenantId,
      },
    });
  }

  if (input.contact) {
    await executeTool(input.tenantId, visitor.id, {
      name: "save_lead",
      arguments: {
        name: input.contact.name ?? "",
        phone: input.contact.phone ?? "",
        email: input.contact.email ?? "",
        service: input.contact.service ?? "",
      },
    }, locale);
    visitor = (await db.visitor.findFirst({ where: { id: visitor.id } })) ?? visitor;
  }

  let conversation = await db.conversation.findFirst({
    where: { visitorId: visitor.id, channel: input.channel, status: "open" },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        visitorId: visitor.id,
        channel: input.channel,
        status: "open",
        lastMessageAt: new Date(),
        tenantId: input.tenantId,
      },
    });
  }

  if (text) {
    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "visitor",
        content: text,
        tenantId: input.tenantId,
      },
    });
    if (visitor.name && (visitor.phone || visitor.email)) {
      await saveLeadFromVisitor(db, visitor, text);
    }
  }

  const finish = async (reply: string, extra: { offline?: boolean; slots?: PublicSlot[]; needContact?: boolean }) => {
    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: reply,
        tenantId: input.tenantId,
      },
    });
    await db.conversation.updateMany({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: "open" },
    });
    const messages = await db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 40,
    });
    const fresh = await db.visitor.findFirst({ where: { id: visitor.id } });
    return {
      reply,
      offline: Boolean(extra.offline),
      mock: llmMode().id === "mock",
      needContact: Boolean(extra.needContact),
      slots: extra.slots ?? [],
      visitor: {
        name: fresh?.name ?? "",
        phone: fresh?.phone ?? "",
        email: fresh?.email ?? "",
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  };

  if (!agent.enabled) {
    const reply = dict.chat.offlineReply.replaceAll("{business}", agent.businessName);
    return finish(reply, { offline: true });
  }

  if (input.slotStartsAt) {
    const startsAt = new Date(input.slotStartsAt);
    const fresh = await db.visitor.findFirst({ where: { id: visitor.id } });
    if (!fresh?.name || (!fresh.phone && !fresh.email)) {
      return finish(dict.chat.needContact, { needContact: true });
    }
    try {
      const appointment = await bookAvailableSlot(input.tenantId, {
        startsAt,
        endsAt: startsAt,
        clientName: fresh.name,
        clientPhone: fresh.phone,
        clientEmail: fresh.email,
        service: input.contact?.service ?? "",
        visitorId: fresh.id,
        source: input.channel,
      });
      const when = describeSlot(
        { startsAt: appointment.startsAt, endsAt: appointment.endsAt },
        agent.timezone,
        locale,
      );
      const reply = dict.chat.booked.replaceAll("{business}", agent.businessName).replaceAll("{when}", when.label);
      await saveLeadFromVisitor(db, fresh, text);
      return finish(reply, { slots: [] });
    } catch (error) {
      const alternatives = await getAvailableSlots(input.tenantId, { limit: 4 });
      const slots = alternatives.map((slot) => describeSlot(slot, agent.timezone, locale));
      const reply =
        error instanceof BookingConflictError || error instanceof SlotUnavailableError
          ? dict.chat.slotTaken
          : dict.chat.failed;
      return finish(reply, { slots });
    }
  }

  if (!text) {
    return finish(dict.chat.emptyPrompt, {});
  }

  const quoted = await quoteServices(agent.servicesJson, locale);
  const context: AgentContext = {
    locale,
    businessName: agent.businessName,
    description: agent.description,
    services: quoted.presented,
    hoursText: formatOpenings(openings, locale),
    tone: agent.tone,
    customInstructions: agent.customInstructions,
    greeting: agent.greeting,
    slotMinutes: agent.slotMinutes,
    timezone: agent.timezone,
    fx: { ronPerGbp: quoted.quote.ronPerGbp, source: quoted.quote.source },
  };
  const history = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const slots: PublicSlot[] = [];
  try {
    const result = await getLlm().complete({
      context,
      messages: history
        .filter((message) => message.role === "visitor" || message.role === "assistant")
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
      execute: async (call) => {
        const output = await executeTool(input.tenantId, visitor.id, call, locale);
        if (call.name === "list_slots" && output && typeof output === "object" && "slots" in output) {
          const listed = (output as { slots?: PublicSlot[] }).slots ?? [];
          slots.splice(0, slots.length, ...listed);
        }
        return output;
      },
    });
    const reply = result.text.trim() || dict.chat.fallback;
    return finish(reply, { slots });
  } catch (error) {
    if (error instanceof LlmError) {
      return finish(dict.chat.modelError, {});
    }
    throw error;
  }
}
