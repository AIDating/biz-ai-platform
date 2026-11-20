import { afterEach, describe, expect, it } from "vitest";
import { authorizeAdmin, isPlatformAdmin } from "@/lib/admin-access";
import {
  PLAN_MONTHLY_PENCE,
  countByStatus,
  filterBusinesses,
  filterPayments,
  formatGbp,
  monthlyRecurringRevenuePence,
  summarizePayments,
} from "@/lib/billing";

const businesses = [
  { id: "iris", name: "Salon Iris", ownerEmail: "iris@salon-iris.ro", status: "active", plan: "business" },
  { id: "radu", name: "Service Auto Radu", ownerEmail: "radu@service-radu.ro", status: "trial", plan: "start" },
  { id: "nord", name: "Studio Nord", ownerEmail: "nord@studio.ro", status: "suspended", plan: "premium" },
  { id: "start", name: "Atelier Start", ownerEmail: "start@atelier.ro", status: "active", plan: "start" },
] as const;

const payments = [
  { id: "1", tenantId: "iris", status: "succeeded", amountPence: 9900 },
  { id: "2", tenantId: "iris", status: "succeeded", amountPence: 9900 },
  { id: "3", tenantId: "iris", status: "failed", amountPence: 9900 },
  { id: "4", tenantId: "radu", status: "due", amountPence: 4900 },
  { id: "5", tenantId: "radu", status: "due", amountPence: 4900 },
] as const;

describe("platform admin authorization", () => {
  const previous = process.env.PLATFORM_ADMIN_EMAILS;

  afterEach(() => {
    if (previous === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = previous;
  });

  it("allows an admin and blocks a business owner and an anonymous visitor", () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    expect(authorizeAdmin({ role: "admin", email: "admin@redline.ro" })).toEqual({ ok: true });
    expect(authorizeAdmin({ role: "owner", email: "iris@salon-iris.ro" })).toEqual({
      ok: false,
      status: 403,
    });
    expect(authorizeAdmin(null)).toEqual({ ok: false, status: 401 });
  });

  it("treats PLATFORM_ADMIN_EMAILS as an optional fallback and never requires it", () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    expect(isPlatformAdmin({ role: "owner", email: "iris@salon-iris.ro" })).toBe(false);

    expect(
      authorizeAdmin({ role: "owner", email: "Ops@Redline.ro" }, " ops@redline.ro , other@redline.ro "),
    ).toEqual({ ok: true });
    expect(authorizeAdmin({ role: "owner", email: "iris@salon-iris.ro" }, "")).toEqual({
      ok: false,
      status: 403,
    });
    expect(authorizeAdmin({ role: "owner", email: "iris@salon-iris.ro" }, undefined)).toEqual({
      ok: false,
      status: 403,
    });
    expect(authorizeAdmin({ role: "admin", email: "anyone@redline.ro" }, undefined)).toEqual({ ok: true });
  });
});

describe("monthly recurring revenue", () => {
  it("uses the RedLine plan prices", () => {
    expect(PLAN_MONTHLY_PENCE.start).toBe(4900);
    expect(PLAN_MONTHLY_PENCE.business).toBe(9900);
    expect(PLAN_MONTHLY_PENCE.premium).toBe(19900);
    expect(formatGbp(4900)).toBe("£49");
    expect(formatGbp(9900)).toBe("£99");
    expect(formatGbp(19900)).toBe("£199");
  });

  it("sums only active paying subscriptions and skips trial and suspended", () => {
    expect(monthlyRecurringRevenuePence(businesses)).toBe(9900 + 4900);
    expect(
      monthlyRecurringRevenuePence([
        { status: "active", plan: "premium" },
        { status: "trial", plan: "premium" },
        { status: "suspended", plan: "business" },
        { status: "active", plan: "unknown" },
      ]),
    ).toBe(19900);
    expect(countByStatus(businesses)).toEqual({ total: 4, active: 2, trial: 1, suspended: 1 });
  });
});

describe("business status filter and payment summary", () => {
  it("filters the directory by status and search", () => {
    expect(filterBusinesses(businesses, { status: "all" }).map((row) => row.id)).toEqual([
      "iris",
      "radu",
      "nord",
      "start",
    ]);
    expect(filterBusinesses(businesses, { status: "trial" }).map((row) => row.name)).toEqual([
      "Service Auto Radu",
    ]);
    expect(filterBusinesses(businesses, { status: "suspended" }).map((row) => row.id)).toEqual(["nord"]);
    expect(filterBusinesses(businesses, { status: "active", query: "IRIS" }).map((row) => row.id)).toEqual([
      "iris",
    ]);
    expect(filterBusinesses(businesses, { status: "active", query: "radu@service-radu.ro" })).toEqual([]);
    expect(filterBusinesses(businesses, { status: "bogus", query: " atelier " }).map((row) => row.id)).toEqual([
      "start",
    ]);
  });

  it("summarizes collected, due, and failed payments and filters history", () => {
    expect(summarizePayments(payments)).toEqual({
      collectedPence: 19800,
      dueCount: 2,
      failedCount: 1,
    });
    expect(filterPayments(payments, { status: "succeeded" }).map((row) => row.id)).toEqual(["1", "2"]);
    expect(filterPayments(payments, { status: "all", tenantId: "radu" }).map((row) => row.id)).toEqual([
      "4",
      "5",
    ]);
    expect(filterPayments(payments, { status: "due", tenantId: "iris" })).toEqual([]);
    expect(filterPayments(payments, { status: "all", tenantId: "all" })).toHaveLength(payments.length);
    expect(summarizePayments(filterPayments(payments, { status: "failed" }))).toEqual({
      collectedPence: 0,
      dueCount: 0,
      failedCount: 1,
    });
  });
});
