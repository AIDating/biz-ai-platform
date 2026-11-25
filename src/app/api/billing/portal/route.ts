import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { basePrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tenant = await basePrisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { stripeCustomerId: true },
  });
  if (!tenant?.stripeCustomerId) {
    return NextResponse.json({ error: "no_stripe_customer" }, { status: 409 });
  }
  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: new URL("/dashboard/billing", request.url).toString(),
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal creation failed", error);
    return NextResponse.json({ error: "stripe_unavailable" }, { status: 503 });
  }
}
