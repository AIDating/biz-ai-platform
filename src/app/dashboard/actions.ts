"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n";
import { requireUser, destroySession } from "@/lib/auth";
import {
  BookingConflictError,
  bookAvailableSlot,
  setAppointmentStatus,
  SlotUnavailableError,
  updateAppointmentDetails,
} from "@/lib/booking";
import { tenantDb } from "@/lib/tenant-db";
import { basePrisma } from "@/lib/db";
import { fxSettingsForSave } from "@/lib/fx";
import { parseFxSettings, serializeServices, servicesFromLocaleForm, TONE_KEYS, SLOT_LENGTHS, TIMEZONES } from "@/lib/services";
import { timeToMinutes } from "@/lib/time";
import { agentFormSchema, appointmentSchema, hasReachableContact, leadStatusSchema } from "@/lib/validators";

export type ActionState = { ok: boolean; error: string };

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function setAgentEnabledAction(formData: FormData) {
  const user = await requireUser();
  const enabled = formData.get("enabled") === "1";
  const db = tenantDb(user.tenantId);
  await db.agentProfile.updateMany({ where: {}, data: { enabled } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agent");
}

export async function setLeadStatusAction(formData: FormData) {
  const user = await requireUser();
  const parsed = leadStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;
  const db = tenantDb(user.tenantId);
  await db.lead.updateMany({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clienti");
  revalidatePath("/dashboard/conversatii");
}

export async function saveAgentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const built = servicesFromLocaleForm({
    locale,
    names: formData.getAll("serviceName").map(String),
    durations: formData.getAll("serviceDuration").map(String),
    prices: formData.getAll("servicePrice").map(String),
    notes: formData.getAll("serviceNote").map(String),
    touched: formData.getAll("servicePriceTouched").map(String),
    isNew: formData.getAll("serviceIsNew").map(String),
    sourcePrices: formData.getAll("serviceSourcePrice").map(String),
    sourceCurrencies: formData.getAll("serviceSourceCurrency").map(String),
  });
  if (!built.ok) return { ok: false, error: dict.agent.invalid };
  const db = tenantDb(user.tenantId);
  const existing = await db.agentProfile.findFirst();
  const submittedMode = formData.get("fxMode");
  const fx = fxSettingsForSave(
    submittedMode == null ? null : String(submittedMode),
    String(formData.get("fxRonPerGbp") ?? ""),
    parseFxSettings(existing?.servicesJson ?? "[]"),
  );
  if (!fx.ok) return { ok: false, error: dict.agent.invalid };
  const services = built.services.map(({ name, durationMin, price, currency, note }) => ({
    name,
    durationMin,
    price,
    currency,
    note,
  }));
  const openDays = new Set(formData.getAll("openDays").map(String));
  const openings = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    enabled: openDays.has(String(day)),
    startMin: timeToMinutes(String(formData.get(`start-${day}`) ?? "")) ?? 9 * 60,
    endMin: timeToMinutes(String(formData.get(`end-${day}`) ?? "")) ?? 17 * 60,
  }));
  const parsed = agentFormSchema.safeParse({
    businessName: formData.get("businessName"),
    description: String(formData.get("description") ?? ""),
    greeting: String(formData.get("greeting") ?? ""),
    tone: formData.get("tone"),
    customInstructions: String(formData.get("customInstructions") ?? ""),
    slotMinutes: formData.get("slotMinutes"),
    timezone: formData.get("timezone"),
    enabled: formData.get("agentEnabled") === "on",
    services,
    openings,
  });
  if (!parsed.success) return { ok: false, error: dict.agent.invalid };
  if (parsed.data.openings.some((day) => day.enabled && day.endMin <= day.startMin)) {
    return { ok: false, error: dict.agent.invalid };
  }
  if (!(TONE_KEYS as readonly string[]).includes(parsed.data.tone)) {
    return { ok: false, error: dict.agent.invalid };
  }
  if (!(SLOT_LENGTHS as readonly number[]).includes(parsed.data.slotMinutes)) {
    return { ok: false, error: dict.agent.invalid };
  }
  if (!(TIMEZONES as readonly string[]).includes(parsed.data.timezone)) {
    return { ok: false, error: dict.agent.invalid };
  }

  await db.agentProfile.updateMany({
    where: {},
    data: {
      businessName: parsed.data.businessName,
      description: parsed.data.description,
      greeting: parsed.data.greeting,
      tone: parsed.data.tone,
      customInstructions: parsed.data.customInstructions,
      slotMinutes: parsed.data.slotMinutes,
      timezone: parsed.data.timezone,
      enabled: parsed.data.enabled,
      servicesJson: serializeServices(parsed.data.services, fx.settings),
    },
  });
  await db.availabilityRule.deleteMany({ where: {} });
  for (const opening of parsed.data.openings) {
    await db.availabilityRule.create({
      data: { ...opening, tenantId: user.tenantId },
    });
  }
  await basePrisma.tenant.update({
    where: { id: user.tenantId },
    data: { name: parsed.data.businessName },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/programari");
  return { ok: true, error: "" };
}

export async function createAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const dict = await getDictionary();
  const parsed = appointmentSchema.safeParse({
    clientName: formData.get("clientName"),
    clientPhone: String(formData.get("clientPhone") ?? ""),
    clientEmail: String(formData.get("clientEmail") ?? ""),
    service: String(formData.get("service") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    startsAt: formData.get("startsAt"),
  });
  if (!parsed.success || !hasReachableContact(parsed.data?.clientPhone ?? "", parsed.data?.clientEmail ?? "")) {
    return { ok: false, error: dict.appointments.missing };
  }
  const startsAt = new Date(parsed.data.startsAt);
  try {
    await bookAvailableSlot(user.tenantId, {
      startsAt,
      endsAt: startsAt,
      clientName: parsed.data.clientName,
      clientPhone: parsed.data.clientPhone,
      clientEmail: parsed.data.clientEmail,
      service: parsed.data.service,
      notes: parsed.data.notes,
      source: "dashboard",
      allowPast: true,
    });
  } catch (error) {
    if (error instanceof BookingConflictError) return { ok: false, error: dict.appointments.conflict };
    if (error instanceof SlotUnavailableError) return { ok: false, error: dict.appointments.unavailable };
    throw error;
  }
  const db = tenantDb(user.tenantId);
  await db.lead.create({
    data: {
      name: parsed.data.clientName,
      phone: parsed.data.clientPhone,
      email: parsed.data.clientEmail,
      note: parsed.data.notes,
      source: "dashboard",
      status: "new",
      tenantId: user.tenantId,
    },
  });
  revalidatePath("/dashboard/programari");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clienti");
  return { ok: true, error: "" };
}

export async function updateAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const dict = await getDictionary();
  const id = String(formData.get("id") ?? "");
  const parsed = appointmentSchema.safeParse({
    clientName: formData.get("clientName"),
    clientPhone: String(formData.get("clientPhone") ?? ""),
    clientEmail: String(formData.get("clientEmail") ?? ""),
    service: String(formData.get("service") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    startsAt: formData.get("startsAt") || new Date().toISOString(),
  });
  if (!parsed.success || !hasReachableContact(parsed.data.clientPhone, parsed.data.clientEmail)) {
    return { ok: false, error: dict.appointments.missing };
  }
  const updated = await updateAppointmentDetails(user.tenantId, id, parsed.data);
  if (!updated) return { ok: false, error: dict.appointments.unavailable };
  revalidatePath("/dashboard/programari");
  revalidatePath("/dashboard");
  return { ok: true, error: "" };
}

export async function appointmentStatusAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (status !== "cancelled" && status !== "completed" && status !== "booked") return;
  await setAppointmentStatus(user.tenantId, id, status);
  revalidatePath("/dashboard/programari");
  revalidatePath("/dashboard");
}

