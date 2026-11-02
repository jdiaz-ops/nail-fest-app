import { describe, it, expect, beforeEach } from "vitest";
import { CHECKOUT_MEMORY_DAYS, forgetCheckoutMemory, readCheckoutMemory, writeCheckoutMemory, type CheckoutMemory } from "./checkoutMemory";

// The browser's localStorage, in memory (the tests run in Node).
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

const NOW = Date.parse("2026-11-02T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const MEMORY: CheckoutMemory = {
  form: { email: "laura@ejemplo.com", firstName: "Laura", lastName: "Gómez", docNumber: "1020304050", company: "", city: "Medellín", phone: "3211234567", profession: "Soy manicurista profesional" },
  qty: 2,
  country: "CO",
  phoneCountry: "CO",
  docType: "CC",
  currency: "COP",
  currencyPicked: false,
  code: null,
  chosen: null,
};

beforeEach(() => store.clear());

describe("what the checkout remembers in her browser", () => {
  it("gives back what she typed", () => {
    writeCheckoutMemory("imparables", MEMORY, NOW);
    expect(readCheckoutMemory("imparables", NOW + DAY)).toEqual(MEMORY);
  });

  it("is per event", () => {
    writeCheckoutMemory("imparables", MEMORY, NOW);
    expect(readCheckoutMemory("otro-evento", NOW)).toBeNull();
  });

  it("drops what's over a week old", () => {
    writeCheckoutMemory("imparables", MEMORY, NOW);
    expect(readCheckoutMemory("imparables", NOW + (CHECKOUT_MEMORY_DAYS + 1) * DAY)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("forgets on demand (her payment confirmed)", () => {
    writeCheckoutMemory("imparables", MEMORY, NOW);
    forgetCheckoutMemory("imparables");
    expect(readCheckoutMemory("imparables", NOW)).toBeNull();
  });

  it("survives something unreadable", () => {
    store.set("nf-checkout:imparables", "{no es json");
    expect(readCheckoutMemory("imparables", NOW)).toBeNull();
    store.set("nf-checkout:imparables", JSON.stringify({ v: 1, savedAt: NOW, form: { email: 42 }, qty: -3, currency: "EUR" }));
    const odd = readCheckoutMemory("imparables", NOW);
    expect(odd?.form.email).toBe("");
    expect(odd?.qty).toBe(1);
    expect(odd?.currency).toBe("COP");
  });
});
