"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { applyBusinessSubscription } from "@/lib/admin-data";
import { adminSubscriptionSchema } from "@/lib/validators";

export async function updateBusinessSubscriptionAction(formData: FormData) {
  await requirePlatformAdmin();
  const parsed = adminSubscriptionSchema.safeParse({
    tenantId: formData.get("tenantId"),
    status: formData.get("status"),
    plan: formData.get("plan"),
  });
  if (!parsed.success) return;
  await applyBusinessSubscription(parsed.data);
  revalidatePath("/admin");
}
