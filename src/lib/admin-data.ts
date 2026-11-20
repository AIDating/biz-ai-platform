import "server-only";
import {
  countByStatus,
  monthlyRecurringRevenuePence,
  PLAN_MONTHLY_PENCE,
  priceForPlan,
  summarizePayments,
  type PlanId,
  type SubscriptionStatus,
} from "@/lib/billing";
import { basePrisma } from "@/lib/db";

export type BusinessRow = {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  plan: string;
  status: string;
  monthlyPricePence: number;
  currency: string;
  createdAt: Date;
  conversations: number;
  appointments: number;
  latestPaymentStatus: string | null;
};

export type PaymentRow = {
  id: string;
  tenantId: string;
  businessName: string;
  plan: string;
  amountPence: number;
  currency: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceRef: string;
  createdAt: Date;
};

export async function loadPlatformSnapshot() {
  const [tenants, payments] = await Promise.all([
    basePrisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        users: {
          where: { role: "owner" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { email: true, name: true },
        },
        _count: { select: { conversations: true, appointments: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      },
    }),
    basePrisma.subscriptionPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { tenant: { select: { name: true } } },
    }),
  ]);

  const businesses: BusinessRow[] = tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    ownerEmail: tenant.users[0]?.email ?? "",
    ownerName: tenant.users[0]?.name ?? "",
    plan: tenant.subscriptionPlan,
    status: tenant.subscriptionStatus,
    monthlyPricePence: priceForPlan(tenant.subscriptionPlan) ?? tenant.monthlyPricePence,
    currency: tenant.currency || "GBP",
    createdAt: tenant.createdAt,
    conversations: tenant._count.conversations,
    appointments: tenant._count.appointments,
    latestPaymentStatus: tenant.payments[0]?.status ?? null,
  }));

  const paymentRows: PaymentRow[] = payments.map((payment) => ({
    id: payment.id,
    tenantId: payment.tenantId,
    businessName: payment.tenant.name,
    plan: payment.plan,
    amountPence: payment.amountPence,
    currency: payment.currency,
    status: payment.status,
    periodStart: payment.periodStart,
    periodEnd: payment.periodEnd,
    invoiceRef: payment.invoiceRef,
    createdAt: payment.createdAt,
  }));

  return {
    businesses,
    payments: paymentRows,
    counts: countByStatus(businesses),
    mrrPence: monthlyRecurringRevenuePence(businesses),
    paymentsSummary: summarizePayments(paymentRows),
  };
}

export async function applyBusinessSubscription(input: {
  tenantId: string;
  status: SubscriptionStatus;
  plan: PlanId;
}) {
  const result = await basePrisma.tenant.updateMany({
    where: { id: input.tenantId },
    data: {
      subscriptionStatus: input.status,
      subscriptionPlan: input.plan,
      monthlyPricePence: PLAN_MONTHLY_PENCE[input.plan],
      currency: "GBP",
    },
  });
  return result.count;
}
