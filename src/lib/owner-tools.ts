import "server-only";
import {
  bookAvailableSlot,
  BookingConflictError,
  setAppointmentStatus,
  SlotUnavailableError,
} from "@/lib/booking";
import { basePrisma } from "@/lib/db";
import {
  ensureDraftProposals,
  emptyPayload,
  loadBrief,
  loadPlatformLinks,
  parsePayload,
  saveBrief,
  serializePayload,
} from "@/lib/marketing";
import { MARKETING_PLATFORMS } from "@/lib/marketing-oauth";
import { formatFxLine, formatServiceLine } from "@/lib/fx";
import { quoteServices } from "@/lib/fx-rate";
import { dictionaryFor } from "@/i18n";
import { parseFxSettings, serializeServices, upsertServiceList } from "@/lib/services";
import { describeSlot, getAvailableSlots } from "@/lib/slots";
import { tenantDb } from "@/lib/tenant-db";
import { formatWhen } from "@/lib/time";

export type OwnerActionBadge = {
  label: string;
  href?: string;
};

export type OwnerToolResult = {
  ok: boolean;
  summary: string;
  href?: string;
  error?: string;
  data?: unknown;
};

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function t(locale: "ro" | "en", ro: string, en: string) {
  return locale === "en" ? en : ro;
}

export const OWNER_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "list_conversations",
      description: "List recent visitor conversations for this business.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" }, query: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_conversation",
      description: "Read messages for one conversation by id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_conversation_status",
      description: "Update conversation status: open, closed, or handed_over.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, status: { type: "string" } },
        required: ["id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_appointments",
      description: "List appointments. scope: upcoming | all | day (ISO date).",
      parameters: {
        type: "object",
        properties: { scope: { type: "string" }, day: { type: "string" }, limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_appointment",
      description: "Create a booking. Prefer startsAt from list_free_slots.",
      parameters: {
        type: "object",
        properties: {
          startsAt: { type: "string" },
          clientName: { type: "string" },
          clientPhone: { type: "string" },
          clientEmail: { type: "string" },
          service: { type: "string" },
          notes: { type: "string" },
        },
        required: ["startsAt", "clientName"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_appointment_status",
      description: "Set appointment status: booked, cancelled, or completed.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, status: { type: "string" } },
        required: ["id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reschedule_appointment",
      description: "Move an appointment to a new startsAt from free slots.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, startsAt: { type: "string" } },
        required: ["id", "startsAt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_free_slots",
      description: "List real free slots. Never invent times.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_services",
      description:
        "List services with duration, stored price, stored currency, and the price shown in the dashboard language. Parentheses in display text are the stored source amount.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "upsert_service",
      description:
        "Add or update a service by name. price and currency are the stored source values (RON or GBP), never a converted display amount. durationMin is minutes. Legacy detail is parsed only when price, currency, durationMin, and note are omitted.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          durationMin: { type: "number" },
          price: { type: "number" },
          currency: { type: "string" },
          note: { type: "string" },
          detail: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "remove_service",
      description: "Remove a service by name.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_customers",
      description: "List or search customers (leads).",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_customer_note",
      description: "Update the note on a customer/lead by id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, note: { type: "string" } },
        required: ["id", "note"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_marketing",
      description: "Show marketing platforms, brief, and recent posts/drafts.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_marketing_brief",
      description: "Save marketing brief (promote, budget, style) and prepare drafts.",
      parameters: {
        type: "object",
        properties: { promote: { type: "string" }, budget: { type: "string" }, style: { type: "string" } },
        required: ["promote", "budget", "style"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_marketing_draft",
      description: "Create a pending draft post for facebook, instagram, or tiktok.",
      parameters: {
        type: "object",
        properties: { channel: { type: "string" }, text: { type: "string" }, title: { type: "string" } },
        required: ["channel", "text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "decide_marketing_post",
      description: "Approve, reject, or request changes on a draft. Approve may publish now or schedule.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          decision: { type: "string" },
          revisionNote: { type: "string" },
          scheduleMode: { type: "string" },
          scheduledAt: { type: "string" },
        },
        required: ["id", "decision"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_agent_profile",
      description: "Show agent profile and whether it is paused.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_agent_enabled",
      description: "Pause or resume the public agent. enabled=true resumes.",
      parameters: {
        type: "object",
        properties: { enabled: { type: "boolean" } },
        required: ["enabled"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_agent_profile",
      description: "Update business name, tone, greeting, description, or custom instructions.",
      parameters: {
        type: "object",
        properties: {
          businessName: { type: "string" },
          tone: { type: "string" },
          greeting: { type: "string" },
          description: { type: "string" },
          customInstructions: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
];

export async function executeOwnerTool(
  tenantId: string,
  locale: "ro" | "en",
  call: { name: string; arguments: Record<string, unknown> },
): Promise<OwnerToolResult> {
  const db = tenantDb(tenantId);
  const agent = await db.agentProfile.findFirst();
  const timezone = agent?.timezone ?? "Europe/Bucharest";

  try {
    switch (call.name) {
      case "list_conversations": {
        const limit = Math.min(20, Math.max(1, Number(call.arguments.limit) || 8));
        const query = clean(call.arguments.query, 80).toLowerCase();
        const rows = await db.conversation.findMany({
          where: { channel: { not: "dashboard" } },
          orderBy: { lastMessageAt: "desc" },
          take: 40,
        });
        const visitors = await db.visitor.findMany({
          where: { id: { in: rows.map((row) => row.visitorId) } },
        });
        const mapped = rows
          .map((row) => {
            const visitor = visitors.find((item) => item.id === row.visitorId);
            return {
              id: row.id,
              status: row.status,
              channel: row.channel,
              lastMessageAt: row.lastMessageAt.toISOString(),
              visitor: visitor
                ? { name: visitor.name, phone: visitor.phone, email: visitor.email }
                : null,
            };
          })
          .filter((row) => {
            if (!query) return true;
            const hay = `${row.visitor?.name ?? ""} ${row.visitor?.phone ?? ""} ${row.visitor?.email ?? ""} ${row.id}`.toLowerCase();
            return hay.includes(query);
          })
          .slice(0, limit);
        return {
          ok: true,
          summary: t(locale, `Am găsit ${mapped.length} conversații.`, `Found ${mapped.length} conversations.`),
          href: "/dashboard/conversatii",
          data: mapped,
        };
      }
      case "get_conversation": {
        const id = clean(call.arguments.id, 40);
        const conversation = await db.conversation.findFirst({ where: { id, channel: { not: "dashboard" } } });
        if (!conversation) {
          return { ok: false, summary: t(locale, "Conversația nu există.", "Conversation not found."), error: "missing" };
        }
        const messages = await db.message.findMany({
          where: { conversationId: id },
          orderBy: { createdAt: "asc" },
          take: 40,
        });
        return {
          ok: true,
          summary: t(locale, `Am încărcat conversația (${messages.length} mesaje).`, `Loaded conversation (${messages.length} messages).`),
          href: `/dashboard/conversatii/${id}`,
          data: {
            id,
            status: conversation.status,
            messages: messages.map((message) => ({
              role: message.role,
              content: message.content,
              createdAt: message.createdAt.toISOString(),
            })),
          },
        };
      }
      case "set_conversation_status": {
        const id = clean(call.arguments.id, 40);
        const status = clean(call.arguments.status, 20);
        if (!["open", "closed", "handed_over"].includes(status)) {
          return { ok: false, summary: t(locale, "Status invalid.", "Invalid status."), error: "invalid_status" };
        }
        const result = await db.conversation.updateMany({
          where: { id, channel: { not: "dashboard" } },
          data: { status },
        });
        if (result.count === 0) {
          return { ok: false, summary: t(locale, "Conversația nu există.", "Conversation not found."), error: "missing" };
        }
        return {
          ok: true,
          summary: t(locale, `Status conversație actualizat: ${status}.`, `Conversation status updated: ${status}.`),
          href: `/dashboard/conversatii/${id}`,
        };
      }
      case "list_appointments": {
        const limit = Math.min(30, Math.max(1, Number(call.arguments.limit) || 10));
        const scope = clean(call.arguments.scope, 20) || "upcoming";
        const day = clean(call.arguments.day, 20);
        const now = new Date();
        const where =
          scope === "all"
            ? {}
            : scope === "day" && day
              ? {
                  startsAt: {
                    gte: new Date(`${day}T00:00:00.000Z`),
                    lt: new Date(`${day}T23:59:59.999Z`),
                  },
                }
              : { startsAt: { gte: now }, status: { not: "cancelled" } };
        const rows = await db.appointment.findMany({
          where,
          orderBy: { startsAt: "asc" },
          take: limit,
        });
        return {
          ok: true,
          summary: t(locale, `Am listat ${rows.length} programări.`, `Listed ${rows.length} appointments.`),
          href: "/dashboard/programari",
          data: rows.map((row) => ({
            id: row.id,
            clientName: row.clientName,
            service: row.service,
            status: row.status,
            when: formatWhen(row.startsAt, timezone, locale),
            startsAt: row.startsAt.toISOString(),
          })),
        };
      }
      case "list_free_slots": {
        const limit = Math.min(8, Math.max(1, Number(call.arguments.limit) || 4));
        const slots = await getAvailableSlots(tenantId, { limit });
        return {
          ok: true,
          summary: t(locale, `Intervale libere: ${slots.length}.`, `Free slots: ${slots.length}.`),
          href: "/dashboard/programari",
          data: { slots: slots.map((slot) => describeSlot(slot, timezone, locale)) },
        };
      }
      case "create_appointment": {
        const startsAt = new Date(clean(call.arguments.startsAt, 40));
        if (Number.isNaN(startsAt.getTime())) {
          return { ok: false, summary: t(locale, "Data este invalidă.", "Invalid date."), error: "invalid_time" };
        }
        try {
          const appointment = await bookAvailableSlot(tenantId, {
            startsAt,
            endsAt: startsAt,
            clientName: clean(call.arguments.clientName, 80),
            clientPhone: clean(call.arguments.clientPhone, 40),
            clientEmail: clean(call.arguments.clientEmail, 120),
            service: clean(call.arguments.service, 80),
            notes: clean(call.arguments.notes, 500),
            source: "dashboard",
            allowPast: false,
          });
          return {
            ok: true,
            summary: t(
              locale,
              `Programare creată pentru ${appointment.clientName} (${formatWhen(appointment.startsAt, timezone, locale)}).`,
              `Appointment created for ${appointment.clientName} (${formatWhen(appointment.startsAt, timezone, locale)}).`,
            ),
            href: "/dashboard/programari",
            data: { id: appointment.id },
          };
        } catch (error) {
          if (error instanceof SlotUnavailableError) {
            return { ok: false, summary: t(locale, "Intervalul nu este liber.", "That slot is not free."), error: "unavailable" };
          }
          if (error instanceof BookingConflictError) {
            return { ok: false, summary: t(locale, "Intervalul este deja ocupat.", "That slot is already taken."), error: "conflict" };
          }
          throw error;
        }
      }
      case "set_appointment_status": {
        const id = clean(call.arguments.id, 40);
        const status = clean(call.arguments.status, 20) as "booked" | "cancelled" | "completed";
        if (!["booked", "cancelled", "completed"].includes(status)) {
          return { ok: false, summary: t(locale, "Status invalid.", "Invalid status."), error: "invalid_status" };
        }
        const row = await setAppointmentStatus(tenantId, id, status);
        if (!row) return { ok: false, summary: t(locale, "Programarea nu există.", "Appointment not found."), error: "missing" };
        return {
          ok: true,
          summary: t(locale, `Programare actualizată: ${status}.`, `Appointment updated: ${status}.`),
          href: "/dashboard/programari",
        };
      }
      case "reschedule_appointment": {
        const id = clean(call.arguments.id, 40);
        const startsAt = new Date(clean(call.arguments.startsAt, 40));
        const current = await db.appointment.findFirst({ where: { id } });
        if (!current) return { ok: false, summary: t(locale, "Programarea nu există.", "Appointment not found."), error: "missing" };
        if (Number.isNaN(startsAt.getTime())) {
          return { ok: false, summary: t(locale, "Data este invalidă.", "Invalid date."), error: "invalid_time" };
        }
        try {
          const created = await bookAvailableSlot(tenantId, {
            startsAt,
            endsAt: startsAt,
            clientName: current.clientName,
            clientPhone: current.clientPhone,
            clientEmail: current.clientEmail,
            service: current.service,
            notes: current.notes,
            source: current.source || "dashboard",
            ignoreAppointmentId: id,
          });
          return {
            ok: true,
            summary: t(
              locale,
              `Programare mutată la ${formatWhen(created.startsAt, timezone, locale)}.`,
              `Appointment moved to ${formatWhen(created.startsAt, timezone, locale)}.`,
            ),
            href: "/dashboard/programari",
            data: { id: created.id },
          };
        } catch (error) {
          if (error instanceof BookingConflictError || error instanceof SlotUnavailableError) {
            return { ok: false, summary: t(locale, "Noul interval nu este disponibil.", "New slot is unavailable."), error: "unavailable" };
          }
          throw error;
        }
      }
      case "list_services": {
        const quoted = await quoteServices(agent?.servicesJson ?? "[]", locale);
        const rows = quoted.services.map((service) => ({
          name: service.name,
          durationMin: service.durationMin,
          price: service.price,
          currency: service.currency,
          note: service.note,
          display: formatServiceLine(service, locale, quoted.quote.ronPerGbp),
        }));
        const caption = formatFxLine(quoted.quote, locale, dictionaryFor(locale).fx);
        const lines = rows.map((service) => (service.display ? `${service.name} — ${service.display}` : service.name)).join("; ");
        return {
          ok: true,
          summary: lines
            ? t(locale, `Servicii: ${lines}. ${caption}.`, `Services: ${lines}. ${caption}.`)
            : t(locale, "Niciun serviciu.", "No services."),
          href: "/dashboard/agent",
          data: {
            exchangeRate: {
              ronPerGbp: quoted.quote.ronPerGbp,
              source: quoted.quote.source,
              provider: quoted.quote.provider ?? null,
            },
            services: rows,
          },
        };
      }
      case "upsert_service": {
        const quoted = await quoteServices(agent?.servicesJson ?? "[]", locale);
        const updated = upsertServiceList(quoted.services, {
          name: clean(call.arguments.name, 80),
          durationMin: call.arguments.durationMin,
          price: call.arguments.price,
          currency: call.arguments.currency,
          note: call.arguments.note,
          detail: call.arguments.detail,
        });
        if (!updated.ok) {
          const summary =
            updated.error === "limit"
              ? t(locale, "Sunt deja 30 de servicii.", "There are already 30 services.")
              : updated.error === "invalid"
                ? t(locale, "Durata, prețul sau moneda nu este validă.", "Duration, price, or currency is invalid.")
                : t(locale, "Numele serviciului lipsește.", "Service name missing.");
          return { ok: false, summary, error: updated.error };
        }
        await db.agentProfile.updateMany({
          where: {},
          data: { servicesJson: serializeServices(updated.services, parseFxSettings(agent?.servicesJson ?? "[]")) },
        });
        const savedName = clean(call.arguments.name, 80).toLowerCase();
        const saved = updated.services.find((item) => item.name.toLowerCase() === savedName);
        const display = saved ? formatServiceLine(saved, locale, quoted.quote.ronPerGbp) : "";
        return {
          ok: true,
          summary: display
            ? t(locale, `Serviciu salvat: ${saved?.name} — ${display}.`, `Service saved: ${saved?.name} — ${display}.`)
            : t(locale, `Serviciu salvat: ${saved?.name ?? ""}.`, `Service saved: ${saved?.name ?? ""}.`),
          href: "/dashboard/agent",
          data: saved
            ? {
                name: saved.name,
                durationMin: saved.durationMin,
                price: saved.price,
                currency: saved.currency,
                note: saved.note,
                display,
              }
            : undefined,
        };
      }
      case "remove_service": {
        const name = clean(call.arguments.name, 80);
        const quoted = await quoteServices(agent?.servicesJson ?? "[]", locale);
        const services = quoted.services.filter((item) => item.name.toLowerCase() !== name.toLowerCase());
        await db.agentProfile.updateMany({
          where: {},
          data: { servicesJson: serializeServices(services, quoted.settings) },
        });
        return {
          ok: true,
          summary: t(locale, `Serviciu eliminat: ${name}.`, `Service removed: ${name}.`),
          href: "/dashboard/agent",
        };
      }
      case "list_customers": {
        const limit = Math.min(30, Math.max(1, Number(call.arguments.limit) || 10));
        const query = clean(call.arguments.query, 80).toLowerCase();
        const rows = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
        const filtered = rows
          .filter((row) => {
            if (!query) return true;
            return `${row.name} ${row.phone} ${row.email} ${row.note}`.toLowerCase().includes(query);
          })
          .slice(0, limit)
          .map((row) => ({
            id: row.id,
            name: row.name,
            phone: row.phone,
            email: row.email,
            status: row.status,
            note: row.note,
          }));
        return {
          ok: true,
          summary: t(locale, `Clienți găsiți: ${filtered.length}.`, `Customers found: ${filtered.length}.`),
          href: "/dashboard/clienti",
          data: filtered,
        };
      }
      case "update_customer_note": {
        const id = clean(call.arguments.id, 40);
        const note = clean(call.arguments.note, 300);
        const result = await db.lead.updateMany({ where: { id }, data: { note } });
        if (result.count === 0) {
          return { ok: false, summary: t(locale, "Clientul nu există.", "Customer not found."), error: "missing" };
        }
        return {
          ok: true,
          summary: t(locale, "Notița clientului a fost actualizată.", "Customer note updated."),
          href: "/dashboard/clienti",
        };
      }
      case "list_marketing": {
        const [platforms, brief, posts] = await Promise.all([
          loadPlatformLinks(db),
          loadBrief(db),
          db.contentProposal.findMany({
            where: { channel: { in: [...MARKETING_PLATFORMS] } },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
        ]);
        return {
          ok: true,
          summary: t(locale, "Am încărcat starea Marketing.", "Loaded Marketing status."),
          href: "/dashboard/marketing",
          data: {
            platforms: platforms.map((item) => ({
              channel: item.channel,
              connected: item.connected,
              accountLabel: item.accountLabel,
              hasKeys: item.hasKeys,
              source: item.source,
            })),
            brief,
            posts: posts.map((post) => ({
              id: post.id,
              channel: post.channel,
              status: post.status,
              title: post.title,
              text: parsePayload(post.body).text.slice(0, 200),
            })),
          },
        };
      }
      case "update_marketing_brief": {
        const promote = clean(call.arguments.promote, 500);
        const budget = clean(call.arguments.budget, 200);
        const style = clean(call.arguments.style, 500);
        if (!promote || !budget || !style) {
          return { ok: false, summary: t(locale, "Brief incomplet.", "Incomplete brief."), error: "required" };
        }
        await saveBrief(db, tenantId, { promote, budget, style });
        await ensureDraftProposals(db, tenantId, { promote, budget, style, updatedAt: new Date().toISOString() }, locale);
        return {
          ok: true,
          summary: t(locale, "Brief salvat și drafturi pregătite.", "Brief saved and drafts prepared."),
          href: "/dashboard/marketing",
        };
      }
      case "create_marketing_draft": {
        const channel = clean(call.arguments.channel, 20);
        if (!(MARKETING_PLATFORMS as readonly string[]).includes(channel)) {
          return { ok: false, summary: t(locale, "Canal invalid.", "Invalid channel."), error: "invalid_channel" };
        }
        const text = clean(call.arguments.text, 2000);
        const title = clean(call.arguments.title, 80) || channel;
        const created = await db.contentProposal.create({
          data: {
            tenantId,
            channel,
            title,
            status: "pending_approval",
            body: serializePayload(emptyPayload(text)),
          },
        });
        return {
          ok: true,
          summary: t(locale, "Draft creat — așteaptă aprobare.", "Draft created — awaiting approval."),
          href: "/dashboard/marketing",
          data: { id: created.id },
        };
      }
      case "decide_marketing_post": {
        const id = clean(call.arguments.id, 40);
        const decision = clean(call.arguments.decision, 20);
        const revisionNote = clean(call.arguments.revisionNote, 500);
        const scheduleMode = clean(call.arguments.scheduleMode, 20) === "scheduled" ? "scheduled" : "now";
        const scheduledAtRaw = clean(call.arguments.scheduledAt, 40);
        const post = await db.contentProposal.findFirst({ where: { id } });
        if (!post) return { ok: false, summary: t(locale, "Draftul nu există.", "Draft not found."), error: "missing" };
        const payload = parsePayload(post.body);
        if (decision === "reject") {
          await db.contentProposal.updateMany({
            where: { id },
            data: { status: "rejected", decidedAt: new Date(), body: serializePayload({ ...payload, revisionNote: "" }) },
          });
          return { ok: true, summary: t(locale, "Draft respins.", "Draft rejected."), href: "/dashboard/marketing" };
        }
        if (decision === "revise") {
          if (!revisionNote) {
            return { ok: false, summary: t(locale, "Descrieți modificările.", "Describe the changes."), error: "revision_required" };
          }
          await db.contentProposal.updateMany({
            where: { id },
            data: {
              status: "needs_changes",
              decidedAt: new Date(),
              body: serializePayload({ ...payload, revisionNote }),
            },
          });
          return { ok: true, summary: t(locale, "Modificări cerute.", "Changes requested."), href: "/dashboard/marketing" };
        }
        if (decision === "approve") {
          if (scheduleMode === "scheduled") {
            const when = new Date(scheduledAtRaw);
            if (Number.isNaN(when.getTime())) {
              return { ok: false, summary: t(locale, "Data programării este invalidă.", "Invalid schedule date."), error: "invalid_time" };
            }
            await db.contentProposal.updateMany({
              where: { id },
              data: {
                status: "scheduled",
                decidedAt: new Date(),
                body: serializePayload({
                  ...payload,
                  scheduleMode: "scheduled",
                  scheduledAt: when.toISOString(),
                  publishedAt: null,
                  revisionNote: "",
                }),
              },
            });
            return { ok: true, summary: t(locale, "Postare programată.", "Post scheduled."), href: "/dashboard/marketing" };
          }
          await db.contentProposal.updateMany({
            where: { id },
            data: {
              status: "published",
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
          return { ok: true, summary: t(locale, "Postare aprobată și marcată publicată.", "Post approved and marked published."), href: "/dashboard/marketing" };
        }
        return { ok: false, summary: t(locale, "Decizie invalidă.", "Invalid decision."), error: "invalid_decision" };
      }
      case "get_agent_profile": {
        if (!agent) return { ok: false, summary: t(locale, "Profilul lipsește.", "Profile missing."), error: "missing" };
        return {
          ok: true,
          summary: t(
            locale,
            `Agent: ${agent.businessName} — ${agent.enabled ? "activ" : "în pauză"}.`,
            `Agent: ${agent.businessName} — ${agent.enabled ? "active" : "paused"}.`,
          ),
          href: "/dashboard/agent",
          data: {
            businessName: agent.businessName,
            tone: agent.tone,
            greeting: agent.greeting,
            description: agent.description,
            customInstructions: agent.customInstructions,
            enabled: agent.enabled,
            slotMinutes: agent.slotMinutes,
            timezone: agent.timezone,
          },
        };
      }
      case "set_agent_enabled": {
        const enabled = Boolean(call.arguments.enabled);
        await db.agentProfile.updateMany({ where: {}, data: { enabled } });
        return {
          ok: true,
          summary: enabled
            ? t(locale, "Agentul a fost repornit.", "Agent resumed.")
            : t(locale, "Agentul a fost pus pe pauză.", "Agent paused."),
          href: "/dashboard/agent",
        };
      }
      case "update_agent_profile": {
        const data: Record<string, string> = {};
        const businessName = clean(call.arguments.businessName, 80);
        const tone = clean(call.arguments.tone, 40);
        const greeting = clean(call.arguments.greeting, 300);
        const description = clean(call.arguments.description, 500);
        const customInstructions = clean(call.arguments.customInstructions, 2000);
        if (businessName) data.businessName = businessName;
        if (tone) data.tone = tone;
        if (greeting) data.greeting = greeting;
        if (description) data.description = description;
        if (customInstructions) data.customInstructions = customInstructions;
        if (Object.keys(data).length === 0) {
          return { ok: false, summary: t(locale, "Nimic de actualizat.", "Nothing to update."), error: "empty" };
        }
        await db.agentProfile.updateMany({ where: {}, data });
        if (businessName) {
          await basePrisma.tenant.update({ where: { id: tenantId }, data: { name: businessName } });
        }
        return {
          ok: true,
          summary: t(locale, "Profilul agentului a fost actualizat.", "Agent profile updated."),
          href: "/dashboard/agent",
        };
      }
      default:
        return { ok: false, summary: t(locale, "Instrument necunoscut.", "Unknown tool."), error: "unknown_tool" };
    }
  } catch (error) {
    console.error("owner tool failed", call.name, error);
    return {
      ok: false,
      summary: t(locale, "Acțiunea a eșuat. Încercați din nou.", "The action failed. Try again."),
      error: "failed",
    };
  }
}
