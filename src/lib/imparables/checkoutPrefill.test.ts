import { describe, it, expect, vi, beforeEach } from "vitest";

const { findRegistration } = vi.hoisted(() => ({ findRegistration: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { registration: { findUnique: findRegistration } } }));

import { checkoutResumeToken } from "@/lib/checkoutResume";
import { checkoutPrefill, splitSavedPhone } from "./checkoutPrefill";

const PERSON = {
  email: "laura@ejemplo.com",
  firstName: "Laura",
  lastName: "Gómez",
  city: "Medellín",
  profession: "Soy manicurista profesional",
  country: "CO",
  phone: "+573211234567",
};

beforeEach(() => {
  process.env.APP_SECRET_KEY = "solo-prueba";
  findRegistration.mockReset().mockResolvedValue({ id: "reg_1", eventId: "ev_1", status: "STARTED", ticketCount: 2, person: PERSON });
});

describe("a saved phone, as the checkout's form takes it", () => {
  it("splits off her country's code", () => {
    expect(splitSavedPhone("+573211234567", "CO")).toEqual({ phoneCountry: "CO", phone: "3211234567" });
    expect(splitSavedPhone("+34612345678", "ES")).toEqual({ phoneCountry: "ES", phone: "612345678" });
  });

  it("takes a number saved without the plus too", () => {
    expect(splitSavedPhone("573211234567", "CO")).toEqual({ phoneCountry: "CO", phone: "3211234567" });
  });

  it("finds the code when her country isn't known", () => {
    expect(splitSavedPhone("+573211234567", null)).toEqual({ phoneCountry: "CO", phone: "3211234567" });
  });

  it("gives nothing for no phone", () => {
    expect(splitSavedPhone(null, "CO")).toEqual({ phoneCountry: null, phone: "" });
  });
});

describe("the checkout opened from the reminder", () => {
  it("fills the form with what her draft saved", async () => {
    const prefill = await checkoutPrefill("ev_1", checkoutResumeToken("reg_1"));
    expect(prefill).toEqual({
      email: "laura@ejemplo.com",
      firstName: "Laura",
      lastName: "Gómez",
      city: "Medellín",
      profession: "Soy manicurista profesional",
      country: "CO",
      phoneCountry: "CO",
      phone: "3211234567",
      qty: 2,
    });
  });

  it("fills nothing without a link, with a bad one, or for another event", async () => {
    expect(await checkoutPrefill("ev_1", null)).toBeNull();
    expect(await checkoutPrefill("ev_1", "reg_1.x.y")).toBeNull();
    expect(await checkoutPrefill("ev_2", checkoutResumeToken("reg_1"))).toBeNull();
  });

  it("fills nothing once she paid", async () => {
    findRegistration.mockResolvedValue({ id: "reg_1", eventId: "ev_1", status: "CONFIRMED", ticketCount: 1, person: PERSON });
    expect(await checkoutPrefill("ev_1", checkoutResumeToken("reg_1"))).toBeNull();
  });
});
