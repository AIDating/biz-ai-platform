import { Prisma } from "@prisma/client";
import { basePrisma } from "@/lib/db";
import { TenantScopeError } from "@/lib/tenant-db";
import { getAvailableSlots, rangesOverlap } from "@/lib/slots";

export class BookingConflictError extends Error {
  constructor() {
    super("That time is already booked.");
    this.name = "BookingConflictError";
  }
}

export class SlotUnavailableError extends Error {
  constructor() {
    super("That time is outside the available slots.");
    this.name = "SlotUnavailableError";
  }
}

export type BookingDraft = {
  startsAt: Date;
  endsAt: Date;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  service?: string;
  notes?: string;
  visitorId?: string | null;
  source?: string;
  status?: string;
};

function assertRange(startsAt: Date, endsAt: Date) {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new SlotUnavailableError();
  }
  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (minutes < 10 || minutes > 8 * 60) throw new SlotUnavailableError();
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function assertFree(
  tenantId: string,
  startsAt: Date,
  endsAt: Date,
  ignoreId?: string,
) {
  const clash = await basePrisma.appointment.findFirst({
    where: {
      tenantId,
      status: { not: "cancelled" },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true },
  });
  if (clash && rangesOverlap(startsAt, endsAt, clash.startsAt, clash.endsAt)) {
    throw new BookingConflictError();
  }
}

export async function bookAppointment(tenantId: string, input: BookingDraft) {
  if (!tenantId) throw new TenantScopeError("A tenant id is required.");
  assertRange(input.startsAt, input.endsAt);
  const name = input.clientName.trim();
  if (!name) throw new SlotUnavailableError();

  try {
    return await basePrisma.$transaction(async (tx) => {
      const clash = await tx.appointment.findFirst({
        where: {
          tenantId,
          status: { not: "cancelled" },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
        },
        select: { id: true },
      });
      if (clash) throw new BookingConflictError();
      return tx.appointment.create({
        data: {
          tenantId,
          visitorId: input.visitorId ?? null,
          clientName: name.slice(0, 80),
          clientPhone: (input.clientPhone ?? "").slice(0, 40),
          clientEmail: (input.clientEmail ?? "").slice(0, 120),
          service: (input.service ?? "").slice(0, 80),
          notes: (input.notes ?? "").slice(0, 500),
          source: input.source ?? "dashboard",
          status: input.status ?? "booked",
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        },
      });
    });
  } catch (error) {
    if (error instanceof BookingConflictError) throw error;
    if (isUniqueConflict(error)) throw new BookingConflictError();
    throw error;
  }
}

export async function bookAvailableSlot(
  tenantId: string,
  input: BookingDraft & { ignoreAppointmentId?: string; allowPast?: boolean },
) {
  const slots = await getAvailableSlots(tenantId, {
    from: new Date(input.startsAt.getTime() - 60_000),
    to: new Date(input.startsAt.getTime() + 36 * 60 * 60 * 1000),
    ignoreAppointmentId: input.ignoreAppointmentId,
    now: input.allowPast ? new Date(0) : new Date(),
  });
  const match = slots.find((slot) => slot.startsAt.getTime() === input.startsAt.getTime());
  if (!match) throw new SlotUnavailableError();
  if (input.ignoreAppointmentId) {
    const moved = await moveAppointment(tenantId, input.ignoreAppointmentId, {
      ...input,
      endsAt: match.endsAt,
    });
    if (!moved) throw new SlotUnavailableError();
    return moved;
  }
  return bookAppointment(tenantId, { ...input, endsAt: match.endsAt });
}

export async function moveAppointment(
  tenantId: string,
  id: string,
  input: BookingDraft,
) {
  if (!tenantId) throw new TenantScopeError("A tenant id is required.");
  assertRange(input.startsAt, input.endsAt);
  try {
    return await basePrisma.$transaction(async (tx) => {
      const current = await tx.appointment.findFirst({ where: { id, tenantId } });
      if (!current || current.status === "cancelled") return null;
      const clash = await tx.appointment.findFirst({
        where: {
          tenantId,
          id: { not: id },
          status: { not: "cancelled" },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
        },
        select: { id: true },
      });
      if (clash) throw new BookingConflictError();
      await tx.appointment.updateMany({
        where: { id, tenantId },
        data: {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          clientName: input.clientName.trim().slice(0, 80),
          clientPhone: (input.clientPhone ?? current.clientPhone).slice(0, 40),
          clientEmail: (input.clientEmail ?? current.clientEmail).slice(0, 120),
          service: (input.service ?? current.service).slice(0, 80),
          notes: (input.notes ?? current.notes).slice(0, 500),
        },
      });
      return tx.appointment.findFirst({ where: { id, tenantId } });
    });
  } catch (error) {
    if (error instanceof BookingConflictError) throw error;
    if (isUniqueConflict(error)) throw new BookingConflictError();
    throw error;
  }
}

export async function setAppointmentStatus(
  tenantId: string,
  id: string,
  status: "booked" | "cancelled" | "completed",
) {
  if (!tenantId) throw new TenantScopeError("A tenant id is required.");
  if (status === "booked") {
    const current = await basePrisma.appointment.findFirst({ where: { id, tenantId } });
    if (!current) return null;
    await assertFree(tenantId, current.startsAt, current.endsAt, id);
  }
  const result = await basePrisma.appointment.updateMany({
    where: { id, tenantId },
    data: { status },
  });
  if (result.count === 0) return null;
  return basePrisma.appointment.findFirst({ where: { id, tenantId } });
}

export async function updateAppointmentDetails(
  tenantId: string,
  id: string,
  patch: {
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    service: string;
    notes: string;
  },
) {
  if (!tenantId) throw new TenantScopeError("A tenant id is required.");
  const result = await basePrisma.appointment.updateMany({
    where: { id, tenantId },
    data: {
      clientName: patch.clientName.trim().slice(0, 80),
      clientPhone: patch.clientPhone.slice(0, 40),
      clientEmail: patch.clientEmail.slice(0, 120),
      service: patch.service.slice(0, 80),
      notes: patch.notes.slice(0, 500),
    },
  });
  if (result.count === 0) return null;
  return basePrisma.appointment.findFirst({ where: { id, tenantId } });
}
