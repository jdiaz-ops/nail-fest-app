import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

process.env.APP_BASE_URL = "https://nailfest.lat";

import { filterSchema } from "@/lib/segments/schema";
import {
  slugifyVersion,
  specialPriceFor,
  specialPricesOf,
  validVersionSlug,
  versionLive,
  versionQrUrl,
  versionUrl,
  withVersionPrice,
} from "./versions";

const now = new Date("2026-11-15T15:00:00Z");
const creyente = { id: "t-creyente", price: 90_000 };
const full = { id: "t-full", price: 150_000 };
const sales = { current: creyente, full } as never;
const version = { specialPrices: { "t-creyente": 80_000 }, priceLabel: "Precio Expo Belleza", maxSpecialSales: 150, endsAt: new Date("2026-11-17T04:59:00Z") };

describe("when a version shows", () => {
  it("on, and within its dates", () => {
    expect(versionLive({ enabled: true, startsAt: null, endsAt: null }, now)).toBe(true);
    expect(versionLive({ enabled: false, startsAt: null, endsAt: null }, now)).toBe(false);
    expect(versionLive({ enabled: true, startsAt: new Date("2026-11-16T00:00:00Z"), endsAt: null }, now)).toBe(false);
    expect(versionLive({ enabled: true, startsAt: null, endsAt: new Date("2026-11-15T14:59:00Z") }, now)).toBe(false);
    expect(versionLive({ enabled: true, startsAt: new Date("2026-11-14T13:00:00Z"), endsAt: version.endsAt }, now)).toBe(true);
  });
});

describe("its special price", () => {
  it("for the stage on sale, below its own — the full price struck beside it", () => {
    expect(specialPriceFor(version, sales, 21)).toEqual({ price: 80_000, normal: 90_000, struck: 150_000, label: "Precio Expo Belleza", endsAt: version.endsAt });
  });

  it("the stage's own struck when it is the full price", () => {
    const atFull = { current: full, full } as never;
    expect(specialPriceFor({ ...version, specialPrices: { "t-full": 120_000 } }, atFull, 0)?.struck).toBe(150_000);
    expect(specialPriceFor(version, { current: creyente, full: null } as never, 0)?.struck).toBe(90_000);
  });

  it("none for a stage without one, at or above its own, or with no stage on sale", () => {
    expect(specialPriceFor({ ...version, specialPrices: { otra: 80_000 } }, sales, 0)).toBeNull();
    expect(specialPriceFor({ ...version, specialPrices: { "t-creyente": 90_000 } }, sales, 0)).toBeNull();
    expect(specialPriceFor(version, { current: null, full } as never, 0)).toBeNull();
  });

  it("none once its maximum is reached", () => {
    expect(specialPriceFor(version, sales, 149)).not.toBeNull();
    expect(specialPriceFor(version, sales, 150)).toBeNull();
    expect(specialPriceFor({ ...version, maxSpecialSales: null }, sales, 10_000)).not.toBeNull();
  });

  it("«Precio especial» when it has no name; whatever the column holds, read safely", () => {
    expect(specialPriceFor({ ...version, priceLabel: " " }, sales, 0)?.label).toBe("Precio especial");
    expect(specialPricesOf({ specialPrices: { a: 80_000, b: "x", c: -1, d: 1.5 } })).toEqual({ a: 80_000 });
    expect(specialPricesOf({ specialPrices: null })).toEqual({});
  });

  it("at the checkout: the full price struck beside it, in pesos only", () => {
    const ticket = { id: "t-creyente", name: "Etapa Creyente", price: 90_000, fullPrice: 150_000, usdCents: 2500, fullUsdCents: 4000, min: 1, max: 1 };
    expect(withVersionPrice(ticket, specialPriceFor(version, sales, 0)!)).toEqual({ ...ticket, price: 80_000, fullPrice: 150_000, usdCents: null, fullUsdCents: null });
  });

});

describe("its link", () => {
  it("lowercase letters, digits and dashes", () => {
    expect(validVersionSlug("expo-cali")).toBe(true);
    expect(validVersionSlug("Expo")).toBe(false);
    expect(validVersionSlug("-expo")).toBe(false);
    expect(validVersionSlug("e")).toBe(false);
    expect(slugifyVersion("Flyer Expo Belleza · Cali 2026")).toBe("flyer-expo-belleza-cali-2026");
  });

  it("its QR carries a print's tags; the main page's too", () => {
    expect(versionUrl("manicuristas-imparables-2027", "expo-cali")).toBe("https://nailfest.lat/v/expo-cali");
    expect(versionQrUrl("manicuristas-imparables-2027", "expo-cali")).toBe("https://nailfest.lat/v/expo-cali?utm_source=qr&utm_medium=impreso&utm_campaign=expo-cali");
    expect(versionQrUrl("manicuristas-imparables-2027", null)).toBe(
      "https://nailfest.lat/manicuristas-imparables-2027?utm_source=qr&utm_medium=impreso&utm_campaign=principal"
    );
  });
});

describe("the segment of those who bought through a version", () => {
  it("is accepted for at least one version", () => {
    expect(filterSchema.safeParse({ include: [{ field: "landingVersion", versionIds: ["v1"] }], exclude: [] }).success).toBe(true);
    expect(filterSchema.safeParse({ include: [{ field: "landingVersion", versionIds: [] }], exclude: [] }).success).toBe(false);
  });
});
