import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

/**
 * Partial unique index: a tenant cannot have two active bookings with the
 * same start. Cancelled rows are excluded so the slot can be booked again.
 * Application code also rejects overlapping ranges (see src/lib/booking.ts).
 */
export async function ensureConstraints() {
  await basePrisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_no_double_book" ON "Appointment"("tenantId", "startsAt") WHERE "status" != 'cancelled'`,
  );
}
