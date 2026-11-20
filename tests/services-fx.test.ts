import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FALLBACK_RON_PER_GBP, formatServiceLine } from "@/lib/fx";
import { clearFxCache, resolveFxQuote } from "@/lib/fx-rate";
import { parseFxSettings, parseServices, serializeServices, servicesFromForm, upsertServiceList } from "@/lib/services";

const legacy = JSON.stringify([
  { name: "Tuns femei", detail: "45 min · 120 lei" },
  { name: "Vopsit", detail: "90 min · de la 250 lei" },
  { name: "Revizie", detail: "60 min" },
  { name: "Special", detail: "doar la cerere" },
  { name: "Colour", detail: "£45" },
  { name: "Cut", detail: "45.50 GBP" },
  { name: "Wash", detail: "30 minutes · 80 £" },
  { name: "Rinse", detail: "120 RON" },
  { name: "Gloss", detail: "45,50 lei" },
]);

describe("parseServices", () => {
  it("reads legacy detail text into duration, price, currency, and leftover note", () => {
    const services = parseServices(legacy);
    expect(services.map((service) => ({
      name: service.name,
      durationMin: service.durationMin,
      price: service.price,
      currency: service.currency,
      note: service.note,
    }))).toEqual([
      { name: "Tuns femei", durationMin: 45, price: 120, currency: "RON", note: "" },
      { name: "Vopsit", durationMin: 90, price: 250, currency: "RON", note: "de la" },
      { name: "Revizie", durationMin: 60, price: null, currency: "RON", note: "" },
      { name: "Special", durationMin: null, price: null, currency: "RON", note: "doar la cerere" },
      { name: "Colour", durationMin: null, price: 45, currency: "GBP", note: "" },
      { name: "Cut", durationMin: null, price: 45.5, currency: "GBP", note: "" },
      { name: "Wash", durationMin: 30, price: 80, currency: "GBP", note: "" },
      { name: "Rinse", durationMin: null, price: 120, currency: "RON", note: "" },
      { name: "Gloss", durationMin: null, price: 45.5, currency: "RON", note: "" },
    ]);
  });

  it("prefers structured fields and keeps an exact price", () => {
    const json = JSON.stringify([
      { name: "Cut", durationMin: 45, price: 45.5, currency: "GBP", note: "de la", detail: "45 min · 120 lei" },
    ]);
    const service = parseServices(json)[0];
    expect(service).toMatchObject({ name: "Cut", durationMin: 45, price: 45.5, currency: "GBP", note: "de la" });
  });

  it("accepts a services wrapper and ignores an exchange-rate row", () => {
    const json = JSON.stringify({
      services: [{ name: "Tuns", durationMin: 30, price: 10, currency: "GBP", note: "" }],
      fx: { mode: "manual", ronPerGbp: 5.5 },
    });
    expect(parseServices(json)).toHaveLength(1);
    expect(parseFxSettings(json)).toEqual({ mode: "manual", ronPerGbp: 5.5 });
    const withRow = JSON.stringify([
      { name: "Tuns", detail: "45 min · 120 lei" },
      { fx: { mode: "manual", ronPerGbp: 6.1 } },
    ]);
    expect(parseServices(withRow)).toHaveLength(1);
    expect(parseFxSettings(withRow)).toEqual({ mode: "manual", ronPerGbp: 6.1 });
  });

  it("returns an empty list for invalid json and caps the list at 30", () => {
    expect(parseServices("not-json")).toEqual([]);
    const many = JSON.stringify(Array.from({ length: 40 }, (_, index) => ({ name: `S${index}`, detail: "10 min" })));
    expect(parseServices(many)).toHaveLength(30);
  });
});

describe("serializeServices", () => {
  it("writes structured fields plus a source-currency detail string", () => {
    const json = serializeServices([
      { name: "Tuns femei", detail: "", durationMin: 45, price: 120, currency: "RON", note: "" },
      { name: "Vopsit", detail: "", durationMin: 90, price: 250, currency: "RON", note: "de la" },
      { name: "Cut", detail: "", durationMin: null, price: 45.5, currency: "GBP", note: "" },
    ]);
    const rows = JSON.parse(json) as { detail: string; price: number; currency: string }[];
    expect(rows[0]).toMatchObject({ price: 120, currency: "RON", detail: "45 min · 120 lei" });
    expect(rows[1].detail).toBe("90 min · 250 lei · de la");
    expect(rows[2].detail).toBe("£45.50");
    const again = parseServices(json);
    expect(again[0].price).toBe(120);
    expect(again[1].note).toBe("de la");
    expect(again[2].price).toBe(45.5);
  });

  it("recovers the stored price when a converted display line is parsed again", () => {
    const ron = parseServices(JSON.stringify([{ name: "Tuns", detail: "45 min · £20.51 (120 RON)" }]))[0];
    const gbp = parseServices(JSON.stringify([{ name: "Colour", detail: "30 min · 117 lei (£20)" }]))[0];
    expect(ron).toMatchObject({ price: 120, currency: "RON", durationMin: 45, note: "" });
    expect(gbp).toMatchObject({ price: 20, currency: "GBP", durationMin: 30, note: "" });
  });

  it("keeps the stored price when a converted display line is formatted", () => {
    const original = parseServices(JSON.stringify([{ name: "Tuns femei", detail: "45 min · 120 lei" }]))[0];
    const shown = formatServiceLine(original, "en", 5.85);
    expect(shown).toBe("45 min · £20.51 (120 RON)");
    const saved = serializeServices([original]);
    const row = JSON.parse(saved)[0] as { price: number; currency: string; detail: string };
    expect(row.price).toBe(120);
    expect(row.currency).toBe("RON");
    expect(row.detail).not.toContain("£");
    expect(parseServices(saved)[0].price).toBe(120);
  });

  it("round-trips a manual exchange rate without turning it into a service", () => {
    const json = JSON.stringify([
      { name: "Tuns", detail: "45 min · 120 lei" },
      { fx: { mode: "manual", ronPerGbp: 6.1 } },
    ]);
    const again = serializeServices(parseServices(json), parseFxSettings(json));
    expect(parseFxSettings(again)).toEqual({ mode: "manual", ronPerGbp: 6.1 });
    expect(parseServices(again)).toHaveLength(1);
    expect(parseServices(again)[0].price).toBe(120);
  });

  it("omits the rate row when the owner uses the live rate", () => {
    const json = serializeServices(
      [{ name: "Tuns", detail: "", durationMin: 45, price: 120, currency: "RON", note: "" }],
      { mode: "live", ronPerGbp: null },
    );
    expect(json.includes("fx")).toBe(false);
    expect(parseFxSettings(json).mode).toBe("live");
  });
});

describe("currency conversion", () => {
  const cut = { durationMin: 45, price: 120, currency: "RON" as const, note: "" };
  const colour = { durationMin: 30, price: 20, currency: "GBP" as const, note: "" };

  it("shows RON on the Romanian dashboard and GBP on the English dashboard", () => {
    expect(formatServiceLine(cut, "ro", 5.85)).toBe("45 min · 120 lei");
    expect(formatServiceLine(cut, "en", 5.85)).toBe("45 min · £20.51 (120 RON)");
    expect(formatServiceLine(colour, "en", 5.85)).toBe("30 min · £20");
    expect(formatServiceLine(colour, "ro", 5.85)).toBe("30 min · 117 lei (£20)");
  });

  it("does not mutate the source amount while formatting", () => {
    const service = { ...cut };
    formatServiceLine(service, "en", 5.85);
    expect(service.price).toBe(120);
    expect(service.currency).toBe("RON");
  });
});

describe("resolveFxQuote", () => {
  const previous = process.env.FX_RON_PER_GBP;

  beforeEach(() => {
    clearFxCache();
    delete process.env.FX_RON_PER_GBP;
  });

  afterEach(() => {
    clearFxCache();
    if (previous === undefined) delete process.env.FX_RON_PER_GBP;
    else process.env.FX_RON_PER_GBP = previous;
  });

  it("uses a live Frankfurter rate and caches it", async () => {
    let calls = 0;
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      expect(String(url)).toContain("frankfurter.app");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({ base: "GBP", date: "2026-11-19", rates: { RON: 5.9 } });
    };
    const first = await resolveFxQuote(null, { fetchImpl });
    const second = await resolveFxQuote({ mode: "live", ronPerGbp: null }, { fetchImpl });
    expect(first).toMatchObject({ ronPerGbp: 5.9, source: "live", provider: "frankfurter", asOf: "2026-11-19" });
    expect(second.ronPerGbp).toBe(5.9);
    expect(calls).toBe(1);
  });

  it("falls through to the second public endpoint when the first fails", async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      if (String(url).includes("frankfurter")) return new Response("no", { status: 500 });
      return Response.json({ result: "success", rates: { RON: 5.7 } });
    };
    const quote = await resolveFxQuote(null, { fetchImpl });
    expect(quote).toMatchObject({ ronPerGbp: 5.7, source: "live", provider: "open.er-api" });
  });

  it("lets a manual rate override the live rate", async () => {
    const fetchImpl = async () => {
      throw new Error("network should not be used");
    };
    const quote = await resolveFxQuote({ mode: "manual", ronPerGbp: 6 }, { fetchImpl });
    expect(quote).toEqual({ ronPerGbp: 6, source: "manual" });
  });

  it("lets the optional env rate override the live rate, but not a manual rate", async () => {
    process.env.FX_RON_PER_GBP = "6.25";
    const fetchImpl = async () => {
      throw new Error("network should not be used");
    };
    const fromEnv = await resolveFxQuote({ mode: "live", ronPerGbp: null }, { fetchImpl });
    expect(fromEnv).toEqual({ ronPerGbp: 6.25, source: "env" });
    const manual = await resolveFxQuote({ mode: "manual", ronPerGbp: 7 }, { fetchImpl });
    expect(manual).toEqual({ ronPerGbp: 7, source: "manual" });
  });

  it("uses the static fallback when live FX is offline", async () => {
    const fetchImpl = async () => {
      throw new Error("offline");
    };
    const quote = await resolveFxQuote(null, { fetchImpl });
    expect(quote).toEqual({ ronPerGbp: FALLBACK_RON_PER_GBP, source: "fallback" });
  });
});

describe("form and owner updates", () => {
  it("stores the typed price instead of a converted amount", () => {
    const built = servicesFromForm({
      names: ["Tuns"],
      durations: ["45"],
      prices: ["120"],
      currencies: ["RON"],
      notes: [""],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.services[0].price).toBe(120);
    expect(built.services[0].currency).toBe("RON");
    expect(formatServiceLine(built.services[0], "en", 5.85)).toContain("£20.51");
    expect(parseServices(serializeServices(built.services))[0].price).toBe(120);
  });

  it("updates a structured price without dropping the stored currency", () => {
    const current = parseServices(JSON.stringify([{ name: "Tuns", detail: "45 min · 120 lei" }]));
    const updated = upsertServiceList(current, { name: "Tuns", price: 130 });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.services[0]).toMatchObject({ price: 130, currency: "RON", durationMin: 45 });
  });

  it("still accepts a legacy detail when structured fields are omitted", () => {
    const updated = upsertServiceList([], { name: "Vopsit", detail: "90 min · de la 250 lei" });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.services[0]).toMatchObject({ durationMin: 90, price: 250, currency: "RON", note: "de la" });
  });
});
