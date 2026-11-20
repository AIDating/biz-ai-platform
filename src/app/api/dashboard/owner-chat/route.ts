import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadOwnerChat, sendOwnerChatMessage } from "@/lib/owner-chat";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const user = await requireUser();
  const limited = rateLimit(`owner-chat-get:${user.id}:${clientIp(request)}`, 60, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const data = await loadOwnerChat(user.tenantId, user.id);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const user = await requireUser();
  const limited = rateLimit(`owner-chat-post:${user.id}:${clientIp(request)}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const message = String((body as { message?: unknown })?.message ?? "").trim();
  const locale = (body as { locale?: unknown })?.locale === "en" ? "en" : "ro";
  if (!message) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const result = await sendOwnerChatMessage({
    tenantId: user.tenantId,
    userId: user.id,
    text: message,
    locale,
  });

  // Keep the visible dashboard page in sync after mutations.
  revalidatePath("/dashboard", "layout");

  return NextResponse.json(result);
}
