import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { ro } from "@/i18n/ro";
import {
  DEFAULT_NEW_SERVICE_PRICE_GBP,
  DEFAULT_NEW_SERVICE_PRICE_RON,
  defaultNewServicePrice,
  displayPriceAmount,
  parseServices,
  serializeServices,
  servicesFromLocaleForm,
} from "@/lib/services";

describe("automatic service currency", () => {
  it("defaults a new service to 100 RON in Romanian and 30 GBP in English", () => {
    expect(DEFAULT_NEW_SERVICE_PRICE_RON).toBe(100);
    expect(DEFAULT_NEW_SERVICE_PRICE_GBP).toBe(30);
    expect(defaultNewServicePrice("ro")).toEqual({ price: 100, currency: "RON" });
    expect(defaultNewServicePrice("en")).toEqual({ price: 30, currency: "GBP" });
    expect(displayPriceAmount(30, "GBP", "ro", 5.85)).toBe("175.50");
    expect(defaultNewServicePrice("ro").price).not.toBe(175.5);
  });

  it("shows an existing price in the active language without changing the stored amount", () => {
    expect(displayPriceAmount(120, "RON", "ro", 5.85)).toBe("120");
    expect(displayPriceAmount(120, "RON", "en", 5.85)).toBe("20.51");
    expect(displayPriceAmount(30, "GBP", "en", 5.85)).toBe("30");
    expect(displayPriceAmount(30, "GBP", "ro", 5.85)).toBe("175.50");
  });

  it("saves an untouched new service as the language default", () => {
    const romanian = servicesFromLocaleForm({
      locale: "ro",
      names: ["Tuns"],
      durations: ["45"],
      prices: ["175.50"],
      notes: [""],
      touched: ["0"],
      isNew: ["1"],
      sourcePrices: ["30"],
      sourceCurrencies: ["GBP"],
    });
    expect(romanian.ok && romanian.services[0]).toMatchObject({ price: 100, currency: "RON" });

    const english = servicesFromLocaleForm({
      locale: "en",
      names: ["Cut"],
      durations: [""],
      prices: ["30"],
      notes: [""],
      touched: ["0"],
      isNew: ["1"],
      sourcePrices: ["30"],
      sourceCurrencies: ["GBP"],
    });
    expect(english.ok && english.services[0]).toMatchObject({ price: 30, currency: "GBP" });
  });

  it("keeps an untouched stored price when the form only shows the converted amount", () => {
    const saved = servicesFromLocaleForm({
      locale: "en",
      names: ["Tuns"],
      durations: ["45"],
      prices: ["20.51"],
      notes: ["de la"],
      touched: ["0"],
      isNew: ["0"],
      sourcePrices: ["120"],
      sourceCurrencies: ["RON"],
    });
    expect(saved.ok && saved.services[0]).toMatchObject({ price: 120, currency: "RON", durationMin: 45, note: "de la" });
    if (!saved.ok) return;
    const stored = JSON.parse(serializeServices(saved.services))[0] as { priceAmount: number; priceCurrency: string };
    expect(stored.priceAmount).toBe(120);
    expect(stored.priceCurrency).toBe("RON");
  });

  it("saves an edited price in the active language currency", () => {
    const edited = servicesFromLocaleForm({
      locale: "en",
      names: ["Tuns", "Vopsit"],
      durations: ["45", "90"],
      prices: ["25", "100"],
      notes: ["", ""],
      touched: ["1", "0"],
      isNew: ["0", "0"],
      sourcePrices: ["120", "250"],
      sourceCurrencies: ["RON", "RON"],
    });
    expect(edited.ok && edited.services.map((service) => ({ price: service.price, currency: service.currency }))).toEqual([
      { price: 25, currency: "GBP" },
      { price: 250, currency: "RON" },
    ]);
  });

  it("reads priceAmount and priceCurrency as well as price and currency", () => {
    const services = parseServices(
      JSON.stringify([
        { name: "New", priceAmount: 100, priceCurrency: "RON", durationMin: 45 },
        { name: "Old", price: 30, currency: "GBP" },
      ]),
    );
    expect(services[0]).toMatchObject({ price: 100, currency: "RON" });
    expect(services[1]).toMatchObject({ price: 30, currency: "GBP" });
  });
});

describe("Services page placeholders", () => {
  it("uses English examples in en and Romanian examples in ro", () => {
    expect(en.agent.serviceNamePlaceholder).toBe("e.g. Women's haircut");
    expect(en.agent.durationPlaceholder).toBe("e.g. 45");
    expect(en.agent.pricePlaceholder).toBe("e.g. 30");
    expect(en.agent.greetingPlaceholder).toBe("e.g. Hello! How can I help?");
    expect(ro.agent.serviceNamePlaceholder).toBe("ex: Tuns damă");
    expect(ro.agent.durationPlaceholder).toBe("ex: 45");
    expect(ro.agent.pricePlaceholder).toBe("ex: 100");
    expect(ro.agent.greetingPlaceholder).toBe("ex: Bună! Cu ce vă pot ajuta?");

    const englishExamples = [
      en.agent.businessNamePlaceholder,
      en.agent.descriptionPlaceholder,
      en.agent.greetingPlaceholder,
      en.agent.serviceNamePlaceholder,
      en.agent.durationPlaceholder,
      en.agent.pricePlaceholder,
      en.agent.notePlaceholder,
      en.agent.instructionsPlaceholder,
    ];
    for (const example of englishExamples) {
      expect(example.startsWith("e.g. ")).toBe(true);
      expect(example).not.toMatch(/tuns|bună|durată|serviciu|întrebați|vopsea|ex:/i);
    }
  });
});
