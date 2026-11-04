import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ event: { findUnique: vi.fn() }, registration: { findUnique: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));

import { asistireToken } from "./asistire";
import { congresoPath, congresoRegistrationId, congresoSampleEventId, congresoSamplePath, congresoSampleToken, congresoToken, congresoUrl, diplomaPath, findCongreso } from "./miCongreso";

beforeEach(() => {
  process.env.APP_SECRET_KEY = "test-secret";
  process.env.APP_BASE_URL = "https://nailfest.lat";
  db.event.findUnique.mockReset();
  db.registration.findUnique.mockReset();
});

const registration = (status: string, theme = "IMPARABLES") => ({
  id: "cmreg123",
  status,
  zoomJoinUrl: null,
  person: { firstName: "ana", lastName: "rodríguez" },
  event: { id: "cmevt1", theme },
});

describe("her «Tu congreso» link", () => {
  it("opens her own registration, and nothing written by hand", () => {
    const token = congresoToken("cmreg123");
    expect(congresoRegistrationId(token)).toBe("cmreg123");
    expect(congresoRegistrationId(token.replace("cmreg123", "cmreg124"))).toBeNull();
    expect(congresoRegistrationId(`${token}x`)).toBeNull();
    expect(congresoRegistrationId("cmreg123")).toBeNull();
  });

  it("is not her «Asistiré» link: one never opens the other", () => {
    expect(congresoToken("cmreg123")).not.toBe(asistireToken("cmreg123"));
    expect(congresoRegistrationId(asistireToken("cmreg123"))).toBeNull();
  });

  it("is a page of the site, and her diploma hangs from it", () => {
    expect(congresoUrl("cmreg123")).toBe(`https://nailfest.lat${congresoPath("cmreg123")}`);
    expect(congresoPath("cmreg123")).toMatch(/^\/mi-congreso\/cmreg123\.[\w-]{43}$/);
    expect(diplomaPath("abc.def")).toBe("/api/diploma/abc.def");
  });

  it("has the team's sample for an event", () => {
    const token = congresoSampleToken("cmevt1");
    expect(congresoSamplePath("cmevt1")).toBe(`/mi-congreso/${token}`);
    expect(congresoSampleEventId(congresoRegistrationId(token)!)).toBe("cmevt1");
    expect(congresoSampleEventId("cmreg123")).toBeNull();
  });
});

describe("findCongreso", () => {
  it("opens the sample of Manicuristas Imparables, and of no other event", async () => {
    db.event.findUnique.mockResolvedValueOnce({ id: "cmevt1", theme: "IMPARABLES" });
    expect(await findCongreso(congresoSampleToken("cmevt1"))).toEqual({ kind: "sample", event: { id: "cmevt1", theme: "IMPARABLES" } });
    db.event.findUnique.mockResolvedValueOnce({ id: "cmevt2", theme: "NAIL_FEST" });
    expect(await findCongreso(congresoSampleToken("cmevt2"))).toBeNull();
  });

  it("opens a buyer's page once her payment is confirmed, and says to come back while it's being confirmed", async () => {
    db.registration.findUnique.mockResolvedValueOnce(registration("CONFIRMED"));
    const confirmed = await findCongreso(congresoToken("cmreg123"));
    expect(confirmed).toMatchObject({ kind: "buyer", waiting: false, event: { id: "cmevt1" }, registration: { id: "cmreg123", person: { firstName: "ana" } } });
    db.registration.findUnique.mockResolvedValueOnce(registration("PENDING_PAYMENT"));
    expect(await findCongreso(congresoToken("cmreg123"))).toMatchObject({ kind: "buyer", waiting: true });
  });

  it("opens nothing for a cancelled purchase, another event or a link we didn't sign", async () => {
    db.registration.findUnique.mockResolvedValueOnce(registration("CANCELLED"));
    expect(await findCongreso(congresoToken("cmreg123"))).toBeNull();
    db.registration.findUnique.mockResolvedValueOnce(registration("CONFIRMED", "NAIL_FEST"));
    expect(await findCongreso(congresoToken("cmreg123"))).toBeNull();
    expect(await findCongreso("cmreg123.nope")).toBeNull();
    expect(db.registration.findUnique).toHaveBeenCalledTimes(2);
  });
});
