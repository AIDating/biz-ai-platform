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
    select: { stripeSubscriptionId: true },
  });
  if (!tenant?.stripeSubscriptionId) return NextResponse.json({ error: "no_active_subscription" }, { status: 409 });

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
    const item = subscription.items.data[0];
    if (!item) return NextResponse.json({ error: "subscription_item_missing" }, { status: 409 });
    const price = await stripe.prices.create({
      currency: "gbp",
      unit_amount: PLAN_MONTHLY_PENCE[plan],
      recurring: { interval: "month" },
      product_data: { name: PLAN_NAMES[plan] },
    });
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: price.id }],
      proration_behavior: "always_invoice",
      metadata: { ...subscription.metadata, tenantId: user.tenantId, plan },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Stripe subscription plan change failed", error);
    return NextResponse.json({ error: "stripe_unavailable" }, { status: 503 });
  }
}
