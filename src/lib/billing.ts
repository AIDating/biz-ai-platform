/** RedLine platform plans. Prices are monthly, in pence, GBP. */
export const PLAN_MONTHLY_PENCE = {
  start: 4900,
  business: 9900,
  premium: 19900,
} as const;

export const PLAN_IDS = ["start", "business", "premium"] as const;
export const SUBSCRIPTION_STATUSES = ["active", "trial", "suspended"] as const;
export const PAYMENT_STATUSES = ["succeeded", "due", "failed"] as const;

export type PlanId = (typeof PLAN_IDS)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type BusinessFilter = {
  status: "all" | SubscriptionStatus;
  query: string;
};

export type PaymentFilter = {
  status: "all" | PaymentStatus;
  tenantId: string;
};

export type StatusCounts = {
  total: number;
  active: number;
  trial: number;
  suspended: number;
};

export type PaymentSummary = {
  collectedPence: number;
  dueCount: number;
  failedCount: number;
};

export function priceForPlan(plan: string): number | null {
  if (plan === "start" || plan === "business" || plan === "premium") {
    return PLAN_MONTHLY_PENCE[plan];
  }
  return null;
}

/**
 * AI Studio (and similar Premium-only surfaces) require the Premium plan.
 * Start (£49) and Business (£99) are explicitly non-premium and stay locked.
 */
export function hasPremiumPlan(plan: string): boolean {
  return plan === "premium";
}

/** True for Start, Business, or any other non-Premium plan id. */
export function isNonPremiumPlan(plan: string): boolean {
  return !hasPremiumPlan(plan);
}

/**
 * Monthly recurring revenue from active paying subscriptions only.
 * Trial and suspended businesses are excluded. Unknown plans contribute nothing.
 * Amounts follow the plan catalog: Start £49, Business £99, Premium £199.
 */
export function monthlyRecurringRevenuePence(
  businesses: readonly { status: string; plan: string }[],
): number {
  let total = 0;
  for (const business of businesses) {
    if (business.status !== "active") continue;
    total += priceForPlan(business.plan) ?? 0;
  }
  return total;
}

export function countByStatus(businesses: readonly { status: string }[]): StatusCounts {
  const counts: StatusCounts = { total: businesses.length, active: 0, trial: 0, suspended: 0 };
  for (const business of businesses) {
    if (business.status === "active") counts.active += 1;
    else if (business.status === "trial") counts.trial += 1;
    else if (business.status === "suspended") counts.suspended += 1;
  }
  return counts;
}

export function parseBusinessFilter(input: {
  status?: string | null;
  query?: string | null;
}): BusinessFilter {
  const status =
    input.status === "active" || input.status === "trial" || input.status === "suspended"
      ? input.status
      : "all";
  return { status, query: (input.query ?? "").trim() };
}

export function filterBusinesses<T extends { status: string; name: string; ownerEmail: string }>(
  businesses: readonly T[],
  filter: { status?: string | null; query?: string | null },
): T[] {
  const parsed = parseBusinessFilter(filter);
  const query = parsed.query.toLowerCase();
  return businesses.filter((business) => {
    if (parsed.status !== "all" && business.status !== parsed.status) return false;
    if (!query) return true;
    return (
      business.name.toLowerCase().includes(query) || business.ownerEmail.toLowerCase().includes(query)
    );
  });
}

export function parsePaymentFilter(input: {
  status?: string | null;
  tenantId?: string | null;
}): PaymentFilter {
  const status =
    input.status === "succeeded" || input.status === "due" || input.status === "failed"
      ? input.status
      : "all";
  const tenantId = (input.tenantId ?? "").trim();
  return { status, tenantId: tenantId === "all" ? "" : tenantId };
}

export function filterPayments<T extends { status: string; tenantId: string }>(
  payments: readonly T[],
  filter: { status?: string | null; tenantId?: string | null },
): T[] {
  const parsed = parsePaymentFilter(filter);
  return payments.filter((payment) => {
    if (parsed.status !== "all" && payment.status !== parsed.status) return false;
    if (parsed.tenantId && payment.tenantId !== parsed.tenantId) return false;
    return true;
  });
}

/** Collected total is the sum of succeeded charges. Due and failed are counts. */
export function summarizePayments(
  payments: readonly { status: string; amountPence: number }[],
): PaymentSummary {
  const summary: PaymentSummary = { collectedPence: 0, dueCount: 0, failedCount: 0 };
  for (const payment of payments) {
    if (payment.status === "succeeded") summary.collectedPence += payment.amountPence;
    else if (payment.status === "due") summary.dueCount += 1;
    else if (payment.status === "failed") summary.failedCount += 1;
  }
  return summary;
}

export function formatGbp(pence: number): string {
  const negative = pence < 0;
  const absolute = Math.abs(Math.trunc(pence));
  const pounds = Math.floor(absolute / 100);
  const minor = absolute % 100;
  const body = minor === 0 ? String(pounds) : `${pounds}.${String(minor).padStart(2, "0")}`;
  return `${negative ? "-" : ""}£${body}`;
}
