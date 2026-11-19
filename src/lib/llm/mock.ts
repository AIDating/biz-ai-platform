import type { AgentContext, LlmProvider, ToolExecutor } from "@/lib/llm/types";
import { classifyMessage, contactReady, extractContact, matchSlotByText } from "@/lib/intent";

type ListedSlot = { startsAt: string; endsAt: string; label: string; clock: string };

function text(context: AgentContext, ro: string, en: string) {
  return context.locale === "en" ? en : ro;
}

function servicesParagraph(context: AgentContext) {
  if (context.services.length === 0) {
    return text(
      context,
      `La ${context.businessName} vă pot nota o programare și transmit mesajul echipei.`,
      `At ${context.businessName} I can take a booking and pass a message to the team.`,
    );
  }
  const lines = context.services
    .map((service) => `• ${service.name}${service.detail ? ` — ${service.detail}` : ""}`)
    .join("\n");
  return text(
    context,
    `La ${context.businessName} avem:\n${lines}`,
    `At ${context.businessName} we offer:\n${lines}`,
  );
}

function asSlots(value: unknown): ListedSlot[] {
  if (!value || typeof value !== "object") return [];
  const slots = (value as { slots?: unknown }).slots;
  if (!Array.isArray(slots)) return [];
  return slots.filter((slot): slot is ListedSlot => {
    return Boolean(slot && typeof slot === "object" && "startsAt" in slot && "clock" in slot);
  });
}

async function listAndMaybeBook(
  context: AgentContext,
  transcript: string,
  latest: string,
  execute: ToolExecutor,
) {
  const contact = extractContact(transcript);
  if (contact.name || contact.phone || contact.email) {
    await execute({ name: "save_lead", arguments: contact });
  }
  const listed = asSlots(await execute({ name: "list_slots", arguments: { limit: 4 } }));
  const matched = matchSlotByText(latest, listed, context.timezone);
  if (matched && contactReady(contact)) {
    const booked = (await execute({
      name: "book_appointment",
      arguments: {
        startsAt: matched.startsAt,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
      },
    })) as { ok?: boolean; error?: string };
    if (booked?.ok) {
      return text(
        context,
        `Gata, v-am notat la ${context.businessName}. Vă așteptăm. Dacă trebuie să schimbați ora, scrieți-ne aici.`,
        `You're booked at ${context.businessName}. If you need a different time, just say so here.`,
      );
    }
    return text(
      context,
      `Intervalul acela s-a ocupat între timp. Alegeți un altul din lista de mai jos.`,
      `That time was just taken. Please pick another one below.`,
    );
  }
  if (!contactReady(contact)) {
    return text(
      context,
      `Cu drag vă fac o programare la ${context.businessName}. Am nevoie de nume și de un telefon sau un email. Puteți și să alegeți un interval de mai jos.`,
      `I can book you at ${context.businessName}. I need your name and a phone number or email. You can also pick a time below.`,
    );
  }
  if (listed.length === 0) {
    return text(
      context,
      `Momentan nu văd un interval liber în următoarele zile. Am păstrat datele și revenim cu o propunere.`,
      `I don't see an open slot in the next few days. I've kept your details and we'll suggest a time.`,
    );
  }
  return text(
    context,
    `Am notat datele. Alegeți un interval liber de mai jos.`,
    `I've saved your details. Pick an open time below.`,
  );
}

export const mockProvider: LlmProvider = {
  id: "mock",
  async complete({ context, messages, execute }) {
    const latest = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
    const transcript = messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n");
    const kind = classifyMessage(latest);

    if (kind === "hours") {
      return {
        text: text(
          context,
          `Programul la ${context.businessName}:\n${context.hoursText}\nDacă vreți, vă rezerv un loc.`,
          `Hours at ${context.businessName}:\n${context.hoursText}\nI can book a time if you'd like.`,
        ),
      };
    }
    if (kind === "services") {
      return { text: servicesParagraph(context) };
    }
    if (kind === "greeting") {
      return {
        text:
          context.greeting ||
          text(
            context,
            `Bună! Sunt recepția ${context.businessName}. Cu ce vă pot ajuta?`,
            `Hello, this is the desk at ${context.businessName}. How can I help?`,
          ),
      };
    }
    if (kind === "book" || kind === "contact") {
      return { text: await listAndMaybeBook(context, transcript, latest, execute) };
    }

    const about = context.description.trim();
    const lead = about ? `${about} ` : "";
    return {
      text: text(
        context,
        `${lead}Sunt recepția ${context.businessName}. Vă pot spune programul, serviciile sau vă pot face o programare.`,
        `${lead}This is the desk at ${context.businessName}. I can share our hours, our services, or book you in.`,
      ),
    };
  },
};
