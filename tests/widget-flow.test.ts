import { describe, expect, it } from "vitest";
import { handleInbound } from "@/lib/chat";
import { tenantDb } from "@/lib/tenant-db";
import { createTenant } from "./helpers";

describe("widget conversation", () => {
  it("stores the message and does not book when the agent is off", async () => {
    const tenant = await createTenant("Paused", { enabled: false });
    const result = await handleInbound({
      tenantId: tenant.id,
      channel: "web_widget",
      visitorKey: "visitor-paused-01",
      text: "Bună, mai aveți loc mâine?",
      locale: "ro",
    });
    expect(result.offline).toBe(true);
    expect(result.reply).toMatch(/oprit|mai târziu/);
    const messages = await tenantDb(tenant.id).message.findMany();
    expect(messages.some((message) => message.role === "visitor" && message.content.includes("mâine"))).toBe(true);
    expect(await tenantDb(tenant.id).appointment.count()).toBe(0);
  });

  it("books a chosen slot after the visitor leaves a name and phone", async () => {
    const tenant = await createTenant("Open");
    const startsAt = "2026-12-03T09:00:00.000Z";
    const asked = await handleInbound({
      tenantId: tenant.id,
      channel: "web_widget",
      visitorKey: "visitor-book-01",
      text: "Vreau o programare",
      locale: "ro",
    });
    expect(asked.reply.length).toBeGreaterThan(0);

    const booked = await handleInbound({
      tenantId: tenant.id,
      channel: "web_widget",
      visitorKey: "visitor-book-01",
      text: "",
      slotStartsAt: startsAt,
      locale: "ro",
      contact: { name: "Ana Pop", phone: "0722000111" },
    });
    expect(booked.reply).toMatch(/notat|Gata/i);
    const rows = await tenantDb(tenant.id).appointment.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clientName).toBe("Ana Pop");
    const leads = await tenantDb(tenant.id).lead.findMany();
    expect(leads.some((lead) => lead.name === "Ana Pop" && lead.phone === "0722000111")).toBe(true);
  });
});
