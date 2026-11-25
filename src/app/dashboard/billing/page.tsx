import { requireUser } from "@/lib/auth";
import { basePrisma } from "@/lib/db";
import { BillingActions } from "@/components/billing-actions";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);

export default async function BillingPage() {
  const user = await requireUser();
  const [tenant, payments] = await Promise.all([
    basePrisma.tenant.findUnique({ where: { id: user.tenantId } }),
    basePrisma.subscriptionPayment.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  if (!tenant) return null;

  const planLabel = tenant.subscriptionPlan.charAt(0).toUpperCase() + tenant.subscriptionPlan.slice(1);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-5 md:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e10600]">Redline / Billing</p>
        <h1 className="mt-2 text-3xl font-semibold">Abonament și plăți</h1>
        <p className="mt-2 text-sm text-[#777]">Gestionează planul Redline și istoricul plăților într-un singur loc.</p>
      </header>
      <section className="grid gap-4 border border-[#e5e5e5] bg-white p-5 md:grid-cols-3">
        <div><p className="text-xs uppercase tracking-wider text-[#777]">Plan curent</p><p className="mt-2 text-xl font-semibold">{planLabel}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-[#777]">Status</p><p className="mt-2 text-xl font-semibold">{tenant.subscriptionStatus}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-[#777]">Preț lunar</p><p className="mt-2 text-xl font-semibold">{money(tenant.monthlyPricePence, tenant.currency)}</p></div>
      </section>
      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold">Alege un plan</h2><p className="mt-1 text-sm text-[#777]">Plățile sunt procesate securizat de Stripe.</p></div>
        <BillingActions currentPlan={tenant.subscriptionPlan} hasCustomer={Boolean(tenant.stripeCustomerId)} hasSubscription={Boolean(tenant.stripeSubscriptionId)} />
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Istoric plăți</h2>
        <div className="overflow-x-auto border border-[#e5e5e5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-[#fafafa] text-xs uppercase tracking-wider text-[#777]"><tr><th className="p-3">Data</th><th className="p-3">Plan</th><th className="p-3">Perioadă</th><th className="p-3">Status</th><th className="p-3 text-right">Sumă</th></tr></thead>
            <tbody>
              {payments.length ? payments.map((payment) => (
                <tr key={payment.id} className="border-b last:border-0">
                  <td className="p-3">{payment.createdAt.toLocaleDateString("en-GB")}</td>
                  <td className="p-3 capitalize">{payment.plan}</td>
                  <td className="p-3">{payment.periodStart.toLocaleDateString("en-GB")} – {payment.periodEnd.toLocaleDateString("en-GB")}</td>
                  <td className="p-3 capitalize">{payment.status}</td>
                  <td className="p-3 text-right font-medium">{money(payment.amountPence, payment.currency)}</td>
                </tr>
              )) : <tr><td colSpan={5} className="p-6 text-center text-[#777]">Nu există încă plăți înregistrate.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
