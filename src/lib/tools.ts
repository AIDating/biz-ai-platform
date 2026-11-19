import { tenantDb, type TenantClient } from "@/lib/tenant-db";
import { bookAvailableSlot, BookingConflictError, SlotUnavailableError } from "@/lib/booking";
import { describeSlot, getAvailableSlots } from "@/lib/slots";
import { extractEmail, extractPhone } from "@/lib/intent";

type VisitorRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
};

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizePhone(value: string) {
  const compact = value.replace(/[^\d+]/g, "");
  const digits = compact.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return compact.slice(0, 40);
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email.slice(0, 120);
}

export async function saveLeadFromVisitor(db: TenantClient, visitor: VisitorRow, note = "") {
  if (!visitor.name || (!visitor.phone && !visitor.email)) return false;
  const existing = await db.lead.findFirst({ where: { visitorId: visitor.id } });
  if (existing) {
    await db.lead.updateMany({
      where: { id: existing.id },
      data: {
        name: visitor.name,
        phone: visitor.phone,
        email: visitor.email,
        ...(note ? { note: note.slice(0, 300) } : {}),
      },
    });
    return true;
  }
  await db.lead.create({
    data: {
      visitorId: visitor.id,
      name: visitor.name,
      phone: visitor.phone,
      email: visitor.email,
      note: note.slice(0, 300),
      source: visitor.source || "web_widget",
      status: "new",
      tenantId: "overwritten",
    },
  });
  return true;
}

export async function executeTool(
  tenantId: string,
  visitorId: string,
  call: { name: string; arguments: Record<string, unknown> },
  locale: "ro" | "en",
) {
  const db = tenantDb(tenantId);
  if (call.name === "save_lead") {
    const name = clean(call.arguments.name, 80);
    const phone = normalizePhone(clean(call.arguments.phone, 40)) || extractPhone(clean(call.arguments.phone, 40));
    const email = normalizeEmail(clean(call.arguments.email, 120)) || extractEmail(clean(call.arguments.email, 120));
    const data: Record<string, string> = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (email) data.email = email;
    if (Object.keys(data).length > 0) {
      await db.visitor.updateMany({ where: { id: visitorId }, data });
    }
    const visitor = await db.visitor.findFirst({ where: { id: visitorId } });
    if (!visitor) return { ok: false, error: "missing_visitor" };
    const missing: string[] = [];
    if (!visitor.name) missing.push("name");
    if (!visitor.phone && !visitor.email) missing.push("phone_or_email");
    const saved = missing.length === 0 ? await saveLeadFromVisitor(db, visitor) : false;
    return {
      ok: true,
      saved,
      missing,
      visitor: { name: visitor.name, phone: visitor.phone, email: visitor.email },
    };
  }

  if (call.name === "list_slots") {
    const limit = Math.min(8, Math.max(1, Number(call.arguments.limit) || 4));
    const agent = await db.agentProfile.findFirst();
    const timezone = agent?.timezone || "Europe/Bucharest";
    const slots = await getAvailableSlots(tenantId, { limit });
    return {
      ok: true,
      slots: slots.map((slot) => describeSlot(slot, timezone, locale)),
    };
  }

  if (call.name === "book_appointment") {
    const startsAt = new Date(clean(call.arguments.startsAt, 40));
    if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "invalid_time" };
    const name = clean(call.arguments.name, 80);
    const phone = normalizePhone(clean(call.arguments.phone, 40));
    const email = normalizeEmail(clean(call.arguments.email, 120));
    const service = clean(call.arguments.service, 80);
    if (name || phone || email) {
      await executeTool(tenantId, visitorId, {
        name: "save_lead",
        arguments: { name, phone, email },
      }, locale);
    }
    const visitor = await db.visitor.findFirst({ where: { id: visitorId } });
    if (!visitor?.name || (!visitor.phone && !visitor.email)) {
      return { ok: false, error: "missing_contact" };
    }
    try {
      const appointment = await bookAvailableSlot(tenantId, {
        startsAt,
        endsAt: startsAt,
        clientName: visitor.name,
        clientPhone: visitor.phone,
        clientEmail: visitor.email,
        service,
        visitorId: visitor.id,
        source: visitor.source || "web_widget",
      });
      return {
        ok: true,
        appointment: {
          id: appointment.id,
          startsAt: appointment.startsAt.toISOString(),
          service: appointment.service,
        },
      };
    } catch (error) {
      if (error instanceof SlotUnavailableError) return { ok: false, error: "unavailable" };
      if (error instanceof BookingConflictError) return { ok: false, error: "conflict" };
      throw error;
    }
  }

  return { ok: false, error: "unknown_tool" };
}
