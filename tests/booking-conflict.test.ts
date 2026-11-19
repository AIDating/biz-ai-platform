import { describe, expect, it } from "vitest";
import { bookAppointment, BookingConflictError, setAppointmentStatus } from "@/lib/booking";
import { tenantDb } from "@/lib/tenant-db";
import { createTenant } from "./helpers";

const start = new Date("2026-12-02T10:00:00.000Z");
const end = new Date("2026-12-02T10:30:00.000Z");

describe("booking conflicts", () => {
  it("rejects a second booking on the same slot and on an overlap", async () => {
    const tenant = await createTenant("Slots");
    await bookAppointment(tenant.id, { startsAt: start, endsAt: end, clientName: "Ana" });
    await expect(
      bookAppointment(tenant.id, { startsAt: start, endsAt: end, clientName: "Bea" }),
    ).rejects.toBeInstanceOf(BookingConflictError);
    await expect(
      bookAppointment(tenant.id, {
        startsAt: new Date("2026-12-02T10:15:00.000Z"),
        endsAt: new Date("2026-12-02T10:45:00.000Z"),
        clientName: "Cia",
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it("allows the next slot, the same hour for another business, and a rebook after cancel", async () => {
    const first = await createTenant("One");
    const second = await createTenant("Two");
    const booked = await bookAppointment(first.id, { startsAt: start, endsAt: end, clientName: "Ana" });
    await bookAppointment(first.id, {
      startsAt: end,
      endsAt: new Date("2026-12-02T11:00:00.000Z"),
      clientName: "Dan",
    });
    await bookAppointment(second.id, { startsAt: start, endsAt: end, clientName: "Eva" });
    await setAppointmentStatus(first.id, booked.id, "cancelled");
    await bookAppointment(first.id, { startsAt: start, endsAt: end, clientName: "Flo" });
    const rows = await tenantDb(first.id).appointment.findMany({ where: { status: { not: "cancelled" } } });
    expect(rows).toHaveLength(2);
  });

  it("lets only one of two simultaneous bookings win", async () => {
    const tenant = await createTenant("Race");
    const results = await Promise.allSettled([
      bookAppointment(tenant.id, { startsAt: start, endsAt: end, clientName: "Unu" }),
      bookAppointment(tenant.id, { startsAt: start, endsAt: end, clientName: "Doi" }),
    ]);
    const ok = results.filter((result) => result.status === "fulfilled");
    const failed = results.filter((result) => result.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(await tenantDb(tenant.id).appointment.count({ where: { status: "booked" } })).toBe(1);
  });
});
