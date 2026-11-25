import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { basePrisma } from "@/lib/db";
import { PLAN_MONTHLY_PENCE, type PlanId } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

const PLAN_NAMES: Record<PlanId, string> = {
  start: "Redline Start",
  business: "Redline Business",
  premium: "Redline Premium",
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const plan = (body as { plan?: unknown })?.plan;
  if (plan !== "start" && plan !== "business" && plan !== "premium") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  const tenant = await basePrisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { id: true, name: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });
  if (!tenant) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  if (tenant.stripeSubscriptionId) {
    return NextResponse.json({ error: "use_plan_change" }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(tenant.stripeCustomerId ? { customer: tenant.stripeCustomerId } : { customer_email: user.email }),
      line_items: [{
        price_data: {
          currency: "gbp",
          unit_amount: PLAN_MONTHLY_PENCE[plan],
          recurring: { interval: "month" },
          product_data: { name: PLAN_NAMES[plan], description: "Redline business platform subscription" },
        },
        quantity: 1,
      }],
      metadata: { tenantId: tenant.id, plan },
      subscription_data: { metadata: { tenantId: tenant.id, plan } },
      success_url: `${origin}/dashboard/billing?checkout=success`,
      cancel_url: `${origin}/dashboard/billing?checkout=cancelled`,
      allow_promotion_codes: true,
    });
    if (!session.url) return NextResponse.json({ error: "checkout_unavailable" }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout creation failed", error);
    return NextResponse.json({ error: "stripe_unavailable" }, { status: 503 });
  }
}
