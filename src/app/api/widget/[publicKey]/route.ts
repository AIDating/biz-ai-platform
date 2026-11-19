import { NextResponse } from "next/server";
import { handleInbound } from "@/lib/chat";
import { llmMode } from "@/lib/llm";
import { parseServices } from "@/lib/services";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { tenantDb } from "@/lib/tenant-db";
import { findTenantByPublicKey } from "@/lib/tenants";
import { chatBodySchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ publicKey: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { publicKey } = await context.params;
  const limited = rateLimit(`widget-read:${clientIp(request)}:${publicKey}`, 60, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const tenant = await findTenantByPublicKey(publicKey);
  if (!tenant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const db = tenantDb(tenant.id);
  const agent = await db.agentProfile.findFirst();
  if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const visitorKey = new URL(request.url).searchParams.get("visitorKey") ?? "";
  let messages: { id: string; role: string; content: string; createdAt: string }[] = [];
  let visitor = { name: "", phone: "", email: "" };
  if (/^[A-Za-z0-9_-]{8,80}$/.test(visitorKey)) {
    const row = await db.visitor.findFirst({ where: { anonKey: visitorKey } });
    if (row) {
      visitor = { name: row.name, phone: row.phone, email: row.email };
      const conversation = await db.conversation.findFirst({
        where: { visitorId: row.id, channel: "web_widget", status: "open" },
      });
      if (conversation) {
        const rows = await db.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "asc" },
          take: 40,
        });
        messages = rows.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        }));
      }
    }
  }

  return NextResponse.json({
    config: {
      businessName: agent.businessName,
      greeting: agent.greeting,
      enabled: agent.enabled,
      mock: llmMode().id === "mock",
      services: parseServices(agent.servicesJson).map((service) => ({ name: service.name })),
    },
    messages,
    visitor,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { publicKey } = await context.params;
  const ip = clientIp(request);
  const limited = rateLimit(`widget-post:${ip}:${publicKey}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const tenant = await findTenantByPublicKey(publicKey);
  if (!tenant) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!parsed.data.message.trim() && !parsed.data.slotStartsAt && !parsed.data.contact) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const locale = parsed.data.locale === "en" ? "en" : "ro";
  const result = await handleInbound({
    tenantId: tenant.id,
    channel: "web_widget",
    visitorKey: parsed.data.visitorKey,
    text: parsed.data.message,
    slotStartsAt: parsed.data.slotStartsAt,
    locale,
    contact: parsed.data.contact,
  });
  return NextResponse.json(result);
}
