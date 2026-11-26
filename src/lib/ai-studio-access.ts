import "server-only";
import { basePrisma } from "@/lib/db";
import { hasPremiumPlan } from "@/lib/billing";

/**
 * Full AI Studio (Kling video, keys, publish) is Premium-only.
 * Start and Business tenants (e.g. Salon Iris on Business) get the locked upsell page instead.
 */
export async function tenantHasAiStudioAccess(tenantId: string): Promise<boolean> {
  if (!tenantId) return false;
  const tenant = await basePrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionPlan: true },
  });
  return hasPremiumPlan(tenant?.subscriptionPlan ?? "");
}
