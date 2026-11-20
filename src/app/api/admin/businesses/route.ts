import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { applyBusinessSubscription } from "@/lib/admin-data";
import { requirePlatformAdminApi } from "@/lib/admin-http";
import { adminSubscriptionSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const guard = await requirePlatformAdminApi();
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const parsed = adminSubscriptionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const updated = await applyBusinessSubscription(parsed.data);
  if (updated === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  revalidatePath("/admin");
  return NextResponse.json({ ok: true });
}
