import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin-http";
import { loadPlatformSnapshot } from "@/lib/admin-data";
import { filterBusinesses, filterPayments } from "@/lib/billing";

export async function GET(request: Request) {
  const guard = await requirePlatformAdminApi();
  if (guard.response) return guard.response;

  const url = new URL(request.url);
  const snapshot = await loadPlatformSnapshot();
  const businesses = filterBusinesses(snapshot.businesses, {
    status: url.searchParams.get("status"),
    query: url.searchParams.get("q"),
  });
  const payments = filterPayments(snapshot.payments, {
    status: url.searchParams.get("paymentStatus"),
    tenantId: url.searchParams.get("business"),
  });

  return NextResponse.json({
    totals: {
      businesses: snapshot.counts.total,
      active: snapshot.counts.active,
      trial: snapshot.counts.trial,
      suspended: snapshot.counts.suspended,
      mrrPence: snapshot.mrrPence,
      currency: "GBP",
      collectedPence: snapshot.paymentsSummary.collectedPence,
      dueCount: snapshot.paymentsSummary.dueCount,
      failedCount: snapshot.paymentsSummary.failedCount,
    },
    businesses,
    payments,
  });
}
