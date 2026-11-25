import { NextResponse } from "next/server";
import Stripe from "stripe";
import { basePrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

function planValue(value: unknown): "start" | "business" | "premium" {
  return value === "business" || value === "premium" ? value : "start";
}

function tenantIdFrom(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const metadata = (value as { metadata?: Record<string, string> }).metadata;
  return metadata?.tenantId || null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 400 });

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    const alreadyProcessed = await basePrisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id } });
    if (alreadyProcessed) return NextResponse.json({ received: true, duplicate: true });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (tenantId) {
        await basePrisma.tenant.update({
          where: { id: tenantId },
          data: {
            stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
            stripeSubscriptionId: subscriptionId ?? null,
            subscriptionPlan: planValue(session.metadata?.plan),
            subscriptionStatus: "trial",
            monthlyPricePence: session.metadata?.plan === "business" ? 9900 : session.metadata?.plan === "premium" ? 19900 : 4900,
            currency: "GBP",
          },
        });
      }
    } else if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as unknown as {
        id: string; customer?: string | { id: string } | null; amount_paid?: number; amount_due?: number;
        currency?: string; lines?: { data?: Array<{ period?: { start?: number; end?: number } }> };
      };
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        const tenant = await basePrisma.tenant.findUnique({ where: { stripeCustomerId: customerId } });
        if (tenant) {
          const exists = await basePrisma.subscriptionPayment.findFirst({ where: { invoiceRef: invoice.id } });
          if (!exists) {
            const period = invoice.lines?.data?.[0]?.period;
            const now = new Date();
            await basePrisma.subscriptionPayment.create({ data: {
              tenantId: tenant.id,
              plan: tenant.subscriptionPlan,
              amountPence: event.type === "invoice.payment_succeeded" ? (invoice.amount_paid ?? 0) : (invoice.amount_due ?? 0),
              currency: (invoice.currency ?? "gbp").toUpperCase(),
              status: event.type === "invoice.payment_succeeded" ? "succeeded" : "failed",
              periodStart: period?.start ? new Date(period.start * 1000) : now,
              periodEnd: period?.end ? new Date(period.end * 1000) : now,
              invoiceRef: invoice.id,
            } });
          }
        }
      }
    } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = tenantIdFrom(subscription);
      if (tenantId) {
        const active = event.type !== "customer.subscription.deleted" &&
          (subscription.status === "active" || subscription.status === "trialing");
        await basePrisma.tenant.update({
          where: { id: tenantId },
          data: {
            stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
            stripeSubscriptionId: subscription.id,
            subscriptionPlan: planValue(subscription.metadata?.plan),
            subscriptionStatus: active ? (subscription.status === "trialing" ? "trial" : "active") : "suspended",
            monthlyPricePence: subscription.metadata?.plan === "business" ? 9900 : subscription.metadata?.plan === "premium" ? 19900 : 4900,
            currency: "GBP",
          },
        });
      }
    }

    await basePrisma.stripeWebhookEvent.create({ data: { eventId: event.id, eventType: event.type } });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}
