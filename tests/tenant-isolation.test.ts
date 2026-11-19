import { describe, expect, it } from "vitest";
import { tenantDb, TenantScopeError } from "@/lib/tenant-db";
import { createTenant } from "./helpers";

describe("tenant isolation", () => {
  it("hides one business from another", async () => {
    const first = await createTenant("Alpha");
    const second = await createTenant("Beta");
    const a = tenantDb(first.id);
    const b = tenantDb(second.id);

    const secret = await a.lead.create({
      data: { name: "Secret A", phone: "0700111222", source: "web_widget", status: "new", tenantId: first.id },
    });

    expect(await b.lead.findMany()).toEqual([]);
    expect(await b.lead.findFirst({ where: { id: secret.id } })).toBeNull();
    expect((await b.lead.updateMany({ where: { id: secret.id }, data: { name: "hacked" } })).count).toBe(0);
    expect((await b.lead.deleteMany({ where: { id: secret.id } })).count).toBe(0);
    expect((await a.lead.findFirst({ where: { id: secret.id } }))?.name).toBe("Secret A");
  });

  it("overwrites a tenant id supplied by the caller", async () => {
    const first = await createTenant("Gamma");
    const second = await createTenant("Delta");
    const created = await tenantDb(second.id).lead.create({
      data: { name: "Only B", source: "web_widget", status: "new", tenantId: first.id },
    });
    expect(created.tenantId).toBe(second.id);
    expect(await tenantDb(second.id).lead.findMany({ where: { tenantId: first.id } })).toHaveLength(1);
    expect(await tenantDb(first.id).lead.findMany()).toHaveLength(0);
  });

  it("refuses lookups that can skip the tenant filter", async () => {
    const tenant = await createTenant("Epsilon");
    await expect(tenantDb(tenant.id).lead.findUnique({ where: { id: "x" } })).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("keeps the same visitor key in two businesses apart", async () => {
    const first = await createTenant("Zeta");
    const second = await createTenant("Eta");
    const key = "same-visitor-key";
    await tenantDb(first.id).visitor.create({
      data: { anonKey: key, source: "web_widget", name: "A", tenantId: first.id },
    });
    await tenantDb(second.id).visitor.create({
      data: { anonKey: key, source: "web_widget", name: "B", tenantId: second.id },
    });
    const seen = await tenantDb(second.id).visitor.findMany();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.name).toBe("B");
  });
});
