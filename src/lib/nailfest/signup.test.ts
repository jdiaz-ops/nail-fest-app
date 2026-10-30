import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ ticketType: { count: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));

import { nailFestSignupResult, showsNailFestSignup } from "./signup";
import { nailFestAsistire, hasNailFestAsistire } from "./asistire";

beforeEach(() => {
  process.env.APP_SECRET_KEY = "test-secret";
  process.env.APP_BASE_URL = "https://nailfest.lat";
  db.ticketType.count.mockReset().mockResolvedValue(0);
});

describe("the screen after signing up", () => {
  it("is for an event at a place that switched it on", () => {
    expect(showsNailFestSignup({ signupScreenDesign: "NAIL_FEST", theme: "NAIL_FEST", format: "IN_PERSON" })).toBe(true);
    expect(showsNailFestSignup({ signupScreenDesign: null, theme: "NAIL_FEST", format: "IN_PERSON" })).toBe(false);
    expect(showsNailFestSignup({ signupScreenDesign: "NAIL_FEST", theme: "NAIL_FEST", format: "VIRTUAL" })).toBe(false);
    expect(showsNailFestSignup({ signupScreenDesign: "NAIL_FEST", theme: "IMPARABLES", format: "IN_PERSON" })).toBe(false);
  });

  it("gives her own «Asistiré» link", () => {
    expect(nailFestSignupResult("cmreg00012345678")?.asistire).toMatch(/^https:\/\/nailfest\.lat\/asistire\/cmreg00012345678\./);
  });
});

describe("Nail Fest's «Asistiré»", () => {
  const event = {
    id: "ev1",
    slug: "cucuta",
    name: "Nail Fest Cúcuta 2026",
    publicName: null,
    city: "Cúcuta",
    venueName: "Salón Ventura",
    startsAt: new Date("2026-11-07T15:00:00Z"),
    endsAt: new Date("2026-11-08T22:00:00Z"),
    scheduleDays: null,
    theme: "NAIL_FEST",
    format: "IN_PERSON",
  };

  it("is for Nail Fest's events at a place", () => {
    expect(hasNailFestAsistire({ theme: "NAIL_FEST", format: "HYBRID" })).toBe(true);
    expect(hasNailFestAsistire({ theme: "NAIL_FEST", format: "VIRTUAL" })).toBe(false);
    expect(hasNailFestAsistire({ theme: "IMPARABLES", format: "IN_PERSON" })).toBe(false);
  });

  it("prints the event's address, and the link she copies says it came from an image", async () => {
    const { texts, linkHref } = await nailFestAsistire(event as never, "America/Bogota");
    expect(texts).toEqual({
      name: ["Nail Fest", "Cúcuta"],
      date: "Sábado 7 y domingo 8 de noviembre",
      place: "Salón Ventura · Cúcuta",
      invite: "Inscríbete gratis en ",
      link: "nailfest.lat/cucuta",
      caption: "¡Voy a Nail Fest Cúcuta! 💅\nSábado 7 y domingo 8 de noviembre en Salón Ventura.\nInscríbete gratis: nailfest.lat/cucuta\n@nailfest_co #NailFestCucuta",
    });
    expect(new URL(linkHref).searchParams.get("utm_source")).toBe("asistire");
  });

  it("doesn't say free when the event sells its entries", async () => {
    db.ticketType.count.mockResolvedValue(1);
    const { texts } = await nailFestAsistire(event as never, "America/Bogota");
    expect(texts.invite).toBe("Consigue tu entrada en ");
  });
});
