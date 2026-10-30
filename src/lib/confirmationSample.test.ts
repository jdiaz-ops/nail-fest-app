import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOrgSettings, imparablesConfirmationPreview } = vi.hoisted(() => ({ getOrgSettings: vi.fn(), imparablesConfirmationPreview: vi.fn() }));
vi.mock("@/lib/settings", () => ({ getOrgSettings }));
vi.mock("@/lib/imparables/confirmation", () => ({ imparablesConfirmationPreview }));

import type { Event } from "@prisma/client";
import { sampleConfirmation, savedConfirmationMode } from "./confirmationSample";

const EVENT = {
  id: "ev_1",
  name: "Manicuristas Imparables 2027",
  publicName: null,
  format: "VIRTUAL",
  city: "Bogotá",
  venueName: null,
  venueAddress: null,
  imageUrl: null,
  startsAt: new Date("2027-06-27T13:00:00Z"),
  endsAt: new Date("2027-06-28T00:00:00Z"),
  scheduleDays: null,
  confirmationEmailHtml: null,
  confirmationEmailSubject: "¡Tu cupo está confirmado! Nos vemos en {{EVENTO_NOMBRE}}",
  confirmationEmailDesign: null,
} as unknown as Event;

beforeEach(() => {
  process.env.APP_SECRET_KEY = "test-secret";
  process.env.APP_BASE_URL = "https://nailfest.lat";
  getOrgSettings.mockReset().mockResolvedValue({ name: "Nail Fest", timezone: "America/Bogota", language: "es", confirmationEmailHtml: null, confirmationEmailSubject: null });
  imparablesConfirmationPreview.mockReset().mockResolvedValue({ html: "<p>diseño</p>", text: "diseño" });
});

describe("the confirmation a buyer would get, with sample data", () => {
  it("knows which one the event sends today", () => {
    expect(savedConfirmationMode({ confirmationEmailDesign: "IMPARABLES", confirmationEmailHtml: "<p>x</p>" })).toBe("design");
    expect(savedConfirmationMode({ confirmationEmailDesign: null, confirmationEmailHtml: "<p>x</p>" })).toBe("event");
    expect(savedConfirmationMode({ confirmationEmailDesign: null, confirmationEmailHtml: null })).toBe("global");
  });

  it("the congress's design, under the event's own subject", async () => {
    const email = await sampleConfirmation(EVENT, "design");
    expect(email).toEqual({ subject: "¡Tu cupo está confirmado! Nos vemos en Manicuristas Imparables 2027", html: "<p>diseño</p>", text: "diseño" });
    expect(imparablesConfirmationPreview).toHaveBeenCalledWith("ev_1", {});
  });

  it("with the editor's WhatsApp message, unsaved, when it sends one", async () => {
    await sampleConfirmation(EVENT, "design", { shareText: "¡Vente conmigo!" });
    expect(imparablesConfirmationPreview).toHaveBeenCalledWith("ev_1", { shareText: "¡Vente conmigo!" });
  });

  it("the editor's template as it is now, unsaved — with the subject typed in, and a sample ticket for an event at a place", async () => {
    const atAPlace = { ...EVENT, format: "IN_PERSON" } as Event;
    const email = await sampleConfirmation(atAPlace, "event", { html: "<p>Sin guardar: {{EVENTO_NOMBRE}}</p>{{ENTRADAS}}", subject: "Prueba de {{EVENTO_NOMBRE}}" });
    expect(email.subject).toBe("Prueba de Manicuristas Imparables 2027");
    expect(email.html).toContain("Sin guardar: Manicuristas Imparables 2027");
    expect(email.html).toMatch(/https:\/\/nailfest\.lat\/api\/ticket-qr\/EJEMPLO\.[\w-]+/);
    expect(imparablesConfirmationPreview).not.toHaveBeenCalled();
  });

  it("with no template anywhere, the original design, for Laura", async () => {
    const email = await sampleConfirmation({ ...EVENT, format: "IN_PERSON" } as Event, "global");
    expect(email.html).toContain("Laura");
    expect(email.html).toContain("EJEMPLO1");
  });
});
