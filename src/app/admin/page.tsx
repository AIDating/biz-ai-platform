import { Suspense } from "react";
import { updateBusinessSubscriptionAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDictionary, getLocale, type Locale } from "@/i18n";
import type { Dictionary } from "@/i18n/ro";
import { loadPlatformSnapshot, type BusinessRow, type PaymentRow } from "@/lib/admin-data";
import { requirePlatformAdmin } from "@/lib/auth";
import {
  filterBusinesses,
  filterPayments,
  formatGbp,
  parseBusinessFilter,
  parsePaymentFilter,
} from "@/lib/billing";

export const instant = false;

type AdminSearch = {
  status?: string;
  q?: string;
  paymentStatus?: string;
  business?: string;
};

export default function AdminPage({ searchParams }: { searchParams: Promise<AdminSearch> }) {
  return (
    <Suspense fallback={<p className="text-sm">…</p>}>
      <AdminHome searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminHome({ searchParams }: { searchParams: Promise<AdminSearch> }) {
  await requirePlatformAdmin();
  const [dict, locale, params, snapshot] = await Promise.all([
    getDictionary(),
    getLocale(),
    searchParams,
    loadPlatformSnapshot(),
  ]);
  const businessFilter = parseBusinessFilter({ status: params.status, query: params.q });
  const paymentFilter = parsePaymentFilter({ status: params.paymentStatus, tenantId: params.business });
  const businesses = filterBusinesses(snapshot.businesses, businessFilter);
  const payments = filterPayments(snapshot.payments, paymentFilter);
  const { counts, mrrPence, paymentsSummary } = snapshot;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl">{dict.admin.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{dict.admin.subtitle}</p>
      </div>

      <section id="overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={dict.admin.totalBusinesses}
          value={String(counts.total)}
          hint={`${counts.total} ${dict.admin.accounts}`}
        />
        <Kpi
          label={dict.admin.activeSubscriptions}
          value={String(counts.active)}
          hint={dict.admin.breakdown
            .replaceAll("{active}", String(counts.active))
            .replaceAll("{trial}", String(counts.trial))
            .replaceAll("{suspended}", String(counts.suspended))}
        />
        <Kpi label={dict.admin.mrr} value={formatGbp(mrrPence)} hint={dict.admin.mrrHint} />
        <Kpi
          label={dict.admin.collected}
          value={formatGbp(paymentsSummary.collectedPence)}
          hint={dict.admin.dueFailed
            .replaceAll("{due}", String(paymentsSummary.dueCount))
            .replaceAll("{failed}", String(paymentsSummary.failedCount))}
        />
      </section>

      <section id="businesses" className="space-y-4">
        <div>
          <h2 id="businesses-title" className="text-2xl">{dict.admin.directoryTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{dict.admin.directorySubtitle}</p>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Input
            name="q"
            defaultValue={businessFilter.query}
            placeholder={dict.admin.searchPlaceholder}
            aria-label={dict.admin.searchPlaceholder}
            className="h-9 max-w-xs"
          />
          <Select name="status" defaultValue={businessFilter.status} label={dict.admin.status}>
            <option value="all">{dict.admin.statusAll}</option>
            <option value="active">{dict.admin.statusActive}</option>
            <option value="trial">{dict.admin.statusTrial}</option>
            <option value="suspended">{dict.admin.statusSuspended}</option>
          </Select>
          {paymentFilter.status !== "all" ? (
            <input type="hidden" name="paymentStatus" value={paymentFilter.status} />
          ) : null}
          {paymentFilter.tenantId ? <input type="hidden" name="business" value={paymentFilter.tenantId} /> : null}
          <Button type="submit" size="sm">
            {dict.admin.filter}
          </Button>
        </form>
        {businesses.length === 0 ? <p className="text-sm text-muted-foreground">{dict.admin.emptyBusinesses}</p> : null}
        <div className="overflow-x-auto border border-[#ececec]">
          <table aria-labelledby="businesses-title" className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b bg-[#fafafa] text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.business}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.owner}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.plan}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.monthlyPrice}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.status}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.created}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.activity}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.latestPayment}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.common.save}</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <tr key={business.id} className="border-b last:border-b-0">
                  <td className="px-3 py-3 font-medium">{business.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{business.ownerEmail || "—"}</td>
                  <td className="px-3 py-3">{planLabel(business.plan, dict)}</td>
                  <td className="px-3 py-3">
                    {formatGbp(business.monthlyPricePence)}
                    <span className="text-muted-foreground">{dict.admin.perMonth}</span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={business.status} dict={dict} />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDay(business.createdAt, locale)}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {business.conversations} {dict.admin.conversations}
                    <br />
                    {business.appointments} {dict.admin.appointments}
                  </td>
                  <td className="px-3 py-3">
                    {business.latestPaymentStatus ? (
                      <PaymentBadge status={business.latestPaymentStatus} dict={dict} />
                    ) : (
                      <span className="text-muted-foreground">{dict.admin.noPayment}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <BusinessForm business={business} dict={dict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="payments" className="space-y-4">
        <div>
          <h2 id="payments-title" className="text-2xl">{dict.admin.paymentsTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{dict.admin.paymentsSubtitle}</p>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Select name="paymentStatus" defaultValue={paymentFilter.status} label={dict.admin.status}>
            <option value="all">{dict.admin.paymentAll}</option>
            <option value="succeeded">{dict.admin.paymentSucceeded}</option>
            <option value="due">{dict.admin.paymentDue}</option>
            <option value="failed">{dict.admin.paymentFailed}</option>
          </Select>
          <Select name="business" defaultValue={paymentFilter.tenantId || "all"} label={dict.admin.business}>
            <option value="all">{dict.admin.allBusinesses}</option>
            {snapshot.businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </Select>
          {businessFilter.status !== "all" ? <input type="hidden" name="status" value={businessFilter.status} /> : null}
          {businessFilter.query ? <input type="hidden" name="q" value={businessFilter.query} /> : null}
          <Button type="submit" size="sm">
            {dict.admin.filter}
          </Button>
        </form>
        {payments.length === 0 ? <p className="text-sm text-muted-foreground">{dict.admin.emptyPayments}</p> : null}
        <div className="overflow-x-auto border border-[#ececec]">
          <table aria-labelledby="payments-title" className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-[#fafafa] text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.date}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.business}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.plan}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.amount}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.status}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.period}</th>
                <th scope="col" className="px-3 py-3 font-medium">{dict.admin.invoice}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <PaymentLine key={payment.id} payment={payment} dict={dict} locale={locale} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="border border-[#ececec] border-t-2 border-t-[#e10600] px-4 py-4">
      <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-4xl font-medium tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </article>
  );
}

function BusinessForm({ business, dict }: { business: BusinessRow; dict: Dictionary }) {
  const status = business.status === "active" || business.status === "suspended" ? business.status : "trial";
  const plan = business.plan === "business" || business.plan === "premium" ? business.plan : "start";
  return (
    <form action={updateBusinessSubscriptionAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tenantId" value={business.id} />
      <Select name="status" defaultValue={status} label={dict.admin.status}>
        <option value="active">{dict.admin.statusActive}</option>
        <option value="trial">{dict.admin.statusTrial}</option>
        <option value="suspended">{dict.admin.statusSuspended}</option>
      </Select>
      <Select name="plan" defaultValue={plan} label={dict.admin.plan}>
        <option value="start">{dict.admin.planStart} · £49</option>
        <option value="business">{dict.admin.planBusiness} · £99</option>
        <option value="premium">{dict.admin.planPremium} · £199</option>
      </Select>
      <Button type="submit" size="sm" variant="brass">
        {dict.common.save}
      </Button>
    </form>
  );
}

function PaymentLine({ payment, dict, locale }: { payment: PaymentRow; dict: Dictionary; locale: Locale }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-3 text-muted-foreground">{formatDay(payment.createdAt, locale)}</td>
      <td className="px-3 py-3 font-medium">{payment.businessName}</td>
      <td className="px-3 py-3">{planLabel(payment.plan, dict)}</td>
      <td className="px-3 py-3">
        {formatGbp(payment.amountPence)} <span className="text-muted-foreground">{payment.currency}</span>
      </td>
      <td className="px-3 py-3">
        <PaymentBadge status={payment.status} dict={dict} />
      </td>
      <td className="px-3 py-3 text-muted-foreground">
        {formatDay(payment.periodStart, locale)} – {formatDay(payment.periodEnd, locale)}
      </td>
      <td className="px-3 py-3">{payment.invoiceRef}</td>
    </tr>
  );
}

function StatusBadge({ status, dict }: { status: string; dict: Dictionary }) {
  if (status === "active") return <Badge tone="good">{dict.admin.statusActive}</Badge>;
  if (status === "suspended") return <Badge tone="bad">{dict.admin.statusSuspended}</Badge>;
  return <Badge tone="warn">{dict.admin.statusTrial}</Badge>;
}

function PaymentBadge({ status, dict }: { status: string; dict: Dictionary }) {
  if (status === "succeeded") return <Badge tone="good">{dict.admin.paymentSucceeded}</Badge>;
  if (status === "failed") return <Badge tone="bad">{dict.admin.paymentFailed}</Badge>;
  if (status === "due") return <Badge tone="warn">{dict.admin.paymentDue}</Badge>;
  return <Badge>{status}</Badge>;
}

function Select({
  name,
  defaultValue,
  label,
  children,
}: {
  name: string;
  defaultValue: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      className="h-9 rounded-md border border-input bg-white px-2 text-sm outline-none focus-visible:border-[#e10600] focus-visible:ring-1 focus-visible:ring-[#e10600]"
    >
      {children}
    </select>
  );
}

function planLabel(plan: string, dict: Dictionary) {
  if (plan === "start") return dict.admin.planStart;
  if (plan === "business") return dict.admin.planBusiness;
  if (plan === "premium") return dict.admin.planPremium;
  return plan;
}

function formatDay(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    timeZone: "Europe/Bucharest",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
