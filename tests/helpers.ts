import { randomBytes } from "node:crypto";
import { basePrisma } from "@/lib/db";

export async function createTenant(name: string, options?: { enabled?: boolean; slotMinutes?: number }) {
  const suffix = randomBytes(4).toString("hex");
  const tenant = await basePrisma.tenant.create({
    data: {
      name,
      slug: `${name}-${suffix}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      publicKey: `pk_${suffix}${randomBytes(3).toString("hex")}`,
    },
  });
  await basePrisma.agentProfile.create({
    data: {
      tenantId: tenant.id,
      businessName: name,
      description: "Test",
      servicesJson: JSON.stringify([{ name: "Consult", detail: "30 min" }]),
      enabled: options?.enabled ?? true,
      slotMinutes: options?.slotMinutes ?? 30,
      timezone: "UTC",
      greeting: `Bună, ${name}`,
    },
  });
  for (let day = 0; day < 7; day += 1) {
    await basePrisma.availabilityRule.create({
      data: { tenantId: tenant.id, dayOfWeek: day, startMin: 0, endMin: 24 * 60, enabled: true },
    });
  }
  return tenant;
}
