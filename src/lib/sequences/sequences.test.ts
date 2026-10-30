import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/settings", () => ({ getOrgSettings: async () => ({}) }));

process.env.APP_BASE_URL = "https://nailfest.lat";

import type { Event } from "@prisma/client";
import { nextStep, withinSendingHours } from "./engine";
import { fillTags, renderSequenceEmail, sequenceWhatsAppVariables, whatsappButtonPath } from "./render";
import { describeDelay, splitDelay } from "./shared";

const BOGOTA = "America/Bogota";
const at = (iso: string) => new Date(iso);

describe("when messages go out", () => {
  it("from 8 a. m. to 9 p. m. where the account is", () => {
    expect(withinSendingHours(at("2026-10-30T12:59:00Z"), BOGOTA)).toBe(false); // 7:59 a. m.
    expect(withinSendingHours(at("2026-10-30T13:00:00Z"), BOGOTA)).toBe(true); // 8:00 a. m.
    expect(withinSendingHours(at("2026-10-31T01:59:00Z"), BOGOTA)).toBe(true); // 8:59 p. m.
    expect(withinSendingHours(at("2026-10-31T02:00:00Z"), BOGOTA)).toBe(false); // 9:00 p. m.
  });
});

describe("her next step", () => {
  const steps = [
    { id: "whatsapp", delayMinutes: 0 },
    { id: "correo1", delayMinutes: 1440 },
    { id: "correo2", delayMinutes: 4320 },
  ];
  const now = at("2026-10-30T15:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  it("the first one as soon as she enters, each next one when its time comes", () => {
    expect(nextStep(steps, new Set(), ago(5), now)).toEqual({ step: steps[0], finished: false });
    expect(nextStep(steps, new Set(["whatsapp"]), ago(60), now)).toEqual({ step: null, finished: false });
    expect(nextStep(steps, new Set(["whatsapp"]), ago(1440), now)).toEqual({ step: steps[1], finished: false });
  });

  it("over once every step is behind her", () => {
    expect(nextStep(steps, new Set(["whatsapp", "correo1", "correo2"]), ago(5000), now)).toEqual({ step: null, finished: true });
  });

  it("never sends late a step added for a moment she's past", () => {
    const withEarlier = [steps[0]!, { id: "nuevo", delayMinutes: 60 }, steps[1]!];
    expect(nextStep(withEarlier, new Set(["whatsapp", "correo1"]), ago(2000), now)).toEqual({ step: null, finished: true });
    expect(nextStep(withEarlier, new Set(["whatsapp"]), ago(90), now)).toEqual({ step: withEarlier[1], finished: false });
  });
});

describe("delays, in words", () => {
  it("in the biggest whole unit", () => {
    expect(splitDelay(2880)).toEqual({ amount: 2, unit: "days" });
    expect(splitDelay(120)).toEqual({ amount: 2, unit: "hours" });
    expect(splitDelay(90)).toEqual({ amount: 90, unit: "minutes" });
    expect(describeDelay(0)).toBe("Apenas entra");
    expect(describeDelay(60)).toBe("1 hora después");
    expect(describeDelay(4320)).toBe("3 días después");
  });
});

const event = { slug: "manicuristas-imparables-2027", name: "Imparables", publicName: "Manicuristas Imparables · 27 de junio de 2027", theme: "IMPARABLES", startsAt: at("2027-06-27T13:00:00Z") } as unknown as Event;
const ctx = { person: { firstName: "Laura", lastName: "Gómez", city: "Bogotá" }, event, sequenceName: "Carritos abandonados", timezone: BOGOTA, language: "es" };

describe("an email step", () => {
  it("fills her tags, escaped in the body, and leaves unknown ones alone", () => {
    expect(fillTags("Hola {{NOMBRE}} {{ OTRO }}", { NOMBRE: "Ana <b>" }, true)).toBe("Hola Ana &lt;b&gt; {{ OTRO }}");
    expect(fillTags("{{NOMBRE}}, tu cupo", { NOMBRE: "Ana" }, false)).toBe("Ana, tu cupo");
  });

  it("adds the button to the event's checkout, tagged as the sequence's, and the unsubscribe line", () => {
    const email = renderSequenceEmail(
      { subject: "{{NOMBRE}}, tu cupo para {{EVENTO_NOMBRE}}", bodyHtml: "<p>Hola, {{NOMBRE}}</p>", buttonText: "Terminar mi inscripción", buttonTarget: "checkout" },
      ctx,
      "https://nailfest.lat/api/unsubscribe?token=x"
    );
    expect(email.subject).toBe("Laura, tu cupo para Manicuristas Imparables");
    expect(email.html).toContain("<p>Hola, Laura</p>");
    expect(email.html).toContain(
      'href="https://nailfest.lat/manicuristas-imparables-2027/checkout?utm_source=email&amp;utm_medium=secuencia&amp;utm_campaign=carritos-abandonados"'
    );
    expect(email.html).toContain("Terminar mi inscripción");
    expect(email.html).toContain("Darme de baja");
  });

  it("without an event, no button", () => {
    const email = renderSequenceEmail({ subject: "Hola", bodyHtml: "<p>Hola</p>", buttonText: "Ir", buttonTarget: "checkout" }, { ...ctx, event: null }, "https://x");
    expect(email.html).not.toContain(">Ir<");
  });
});

describe("a WhatsApp step", () => {
  it("fills its variables with her tags and the event's links", () => {
    expect(sequenceWhatsAppVariables(3, { "1": "NOMBRE", "2": "ENLACE_CHECKOUT", "3": "EVENTO_NOMBRE" }, ctx)).toEqual([
      "Laura",
      "https://nailfest.lat/manicuristas-imparables-2027/checkout?utm_source=whatsapp&utm_medium=secuencia&utm_campaign=carritos-abandonados",
      "Manicuristas Imparables",
    ]);
  });

  it("its link button goes to the checkout or the page, after nailfest.lat/", () => {
    expect(whatsappButtonPath(event, "checkout")).toBe("manicuristas-imparables-2027/checkout");
    expect(whatsappButtonPath(event, "event")).toBe("manicuristas-imparables-2027");
    expect(whatsappButtonPath(null, "checkout")).toBeNull();
  });
});
