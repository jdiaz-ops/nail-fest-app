import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ event: { findFirst: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));

import {
  ASISTIRE_UTM,
  asistireRegistrationId,
  asistireSampleEventId,
  asistireSampleUrl,
  asistireShortLink,
  asistireShortTarget,
  asistireToken,
  asistireUrl,
} from "./asistire";

beforeEach(() => {
  process.env.APP_SECRET_KEY = "test-secret";
  process.env.APP_BASE_URL = "https://nailfest.lat";
});

describe("her «Asistiré» link", () => {
  it("opens her own registration, and nothing someone wrote by hand", () => {
    const token = asistireToken("cmreg123");
    expect(asistireRegistrationId(token)).toBe("cmreg123");
    expect(asistireRegistrationId(token.replace("cmreg123", "cmreg124"))).toBeNull();
    expect(asistireRegistrationId(`${token}x`)).toBeNull();
    expect(asistireRegistrationId("cmreg123")).toBeNull();
    expect(asistireRegistrationId(".abc")).toBeNull();
  });

  it("is signed apart from her ticket's and her unsubscribe's", () => {
    const [, signature] = asistireToken("cmreg123").split(".");
    expect(signature).toMatch(/^[\w-]{43}$/);
    process.env.APP_SECRET_KEY = "another-secret";
    expect(asistireToken("cmreg123").split(".")[1]).not.toBe(signature);
  });

  it("is a page of the site", () => {
    expect(asistireUrl("cmreg123")).toMatch(/^https:\/\/nailfest\.lat\/asistire\/cmreg123\.[\w-]+$/);
  });

  it("the team's sample opens its event's page, signed too; a buyer's link is never a sample", () => {
    const token = asistireSampleUrl("ev_1").split("/asistire/")[1]!;
    const id = asistireRegistrationId(token);
    expect(id).toBe("muestra-ev_1");
    expect(asistireSampleEventId(id!)).toBe("ev_1");
    expect(asistireSampleEventId("cmreg123")).toBeNull();
    expect(asistireRegistrationId(token.replace("ev_1", "ev_2"))).toBeNull();
  });
});

describe("the short link the images print", () => {
  it("says the site's name and goes to /imparables", () => {
    expect(asistireShortLink()).toEqual({ text: "nailfest.lat/imparables", href: "https://nailfest.lat/imparables" });
    process.env.APP_BASE_URL = "https://www.nailfest.lat/";
    expect(asistireShortLink()).toEqual({ text: "nailfest.lat/imparables", href: "https://www.nailfest.lat/imparables" });
  });

  it("tags its visits as the images'", () => {
    expect(ASISTIRE_UTM).toEqual({ utm_source: "asistire", utm_medium: "referido", utm_campaign: "imagen" });
  });

  it("goes to the next Manicuristas Imparables; with none ahead, to the last one; with none at all, home", async () => {
    db.event.findFirst.mockReset().mockResolvedValueOnce({ slug: "manicuristas-imparables-2027" });
    expect(await asistireShortTarget()).toBe("/manicuristas-imparables-2027?utm_source=asistire&utm_medium=referido&utm_campaign=imagen");
    expect(db.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ theme: "IMPARABLES", status: "PUBLISHED" }), orderBy: { startsAt: "asc" } })
    );
    db.event.findFirst.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce({ slug: "manicuristas-imparables-2026" });
    expect(await asistireShortTarget()).toMatch(/^\/manicuristas-imparables-2026\?utm_source=asistire/);
    db.event.findFirst.mockReset().mockResolvedValue(null);
    expect(await asistireShortTarget()).toBe("/");
  });
});
