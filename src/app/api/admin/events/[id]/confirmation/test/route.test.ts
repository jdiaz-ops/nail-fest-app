import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { requireUser, sendTransactional, sampleConfirmation, getOrgSettings, renderTicketPdfBuffer } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  sendTransactional: vi.fn(),
  sampleConfirmation: vi.fn(),
  getOrgSettings: vi.fn(),
  renderTicketPdfBuffer: vi.fn(),
}));
const db = vi.hoisted(() => ({ event: { findUnique: vi.fn() }, ticketType: { findFirst: vi.fn() } }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/email", () => ({ emailProvider: { sendTransactional } }));
vi.mock("@/lib/confirmationSample", () => ({ sampleConfirmation }));
vi.mock("@/lib/settings", () => ({ getOrgSettings }));
vi.mock("@/lib/ticketPdf", () => ({ renderTicketPdfBuffer }));
vi.mock("@/lib/eventDisplayName", () => ({ publicEventName: (e: { name: string }) => e.name }));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new NextRequest("https://nailfest.lat/api/admin/events/ev_1/confirmation/test", { method: "POST", body: JSON.stringify(body) }), { params: { id: "ev_1" } });

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  db.event.findUnique.mockReset().mockResolvedValue({ id: "ev_1", name: "Manicuristas Imparables", format: "VIRTUAL", startsAt: new Date("2027-06-27T13:00:00Z") });
  db.ticketType.findFirst.mockReset().mockResolvedValue({ name: "Entrada general" });
  getOrgSettings.mockReset().mockResolvedValue({ attachTicketPdf: true, timezone: "America/Bogota", language: "es" });
  renderTicketPdfBuffer.mockReset().mockResolvedValue(Buffer.from("%PDF"));
  sampleConfirmation.mockReset().mockResolvedValue({ subject: "¡Tu cupo está confirmado!", text: "t", html: "<p>h</p>" });
  sendTransactional.mockReset().mockResolvedValue({ providerMessageId: "m1" });
});

describe("«Enviar prueba» of an event's confirmation", () => {
  it("sends what the editor has, now, to each address, marked [Prueba]", async () => {
    const res = await post({ email: "Yo@Ejemplo.com, otra@ejemplo.com", mode: "event", html: "<p>sin guardar</p>", subject: "Hola" });
    expect(res.status).toBe(200);
    expect(sampleConfirmation).toHaveBeenCalledWith(expect.objectContaining({ id: "ev_1" }), "event", { html: "<p>sin guardar</p>", subject: "Hola" });
    expect(sendTransactional.mock.calls.map(([m]) => [m.to, m.subject])).toEqual([
      ["yo@ejemplo.com", "[Prueba] ¡Tu cupo está confirmado!"],
      ["otra@ejemplo.com", "[Prueba] ¡Tu cupo está confirmado!"],
    ]);
  });

  it("with the ticket's PDF, as the real one, for an event at a place with the PDF on", async () => {
    db.event.findUnique.mockResolvedValue({ id: "ev_1", name: "Nail Fest Cúcuta", format: "IN_PERSON", startsAt: new Date("2026-11-07T15:00:00Z") });
    await post({ email: "yo@ejemplo.com", mode: "design" });
    expect(renderTicketPdfBuffer).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Laura", confirmationCode: "EJEMPLO1", qrToken: "VISTA-PREVIA-NO-ES-UNA-ENTRADA-REAL" }));
    expect(sendTransactional.mock.calls[0][0].attachments).toEqual([{ filename: "entrada-nailfest.pdf", content: Buffer.from("%PDF"), contentType: "application/pdf" }]);

    sendTransactional.mockClear();
    getOrgSettings.mockResolvedValue({ attachTicketPdf: false, timezone: "America/Bogota", language: "es" });
    await post({ email: "yo@ejemplo.com", mode: "design" });
    expect(sendTransactional.mock.calls[0][0].attachments).toBeUndefined();
  });

  it("no PDF for a virtual event", async () => {
    await post({ email: "yo@ejemplo.com", mode: "design" });
    expect(renderTicketPdfBuffer).not.toHaveBeenCalled();
    expect(sendTransactional.mock.calls[0][0].attachments).toBeUndefined();
  });

  it("only for the team, and only to real addresses — five at most", async () => {
    expect((await post({ email: "no-es-correo", mode: "design" })).status).toBe(400);
    expect((await post({ email: "a@a.co,b@b.co,c@c.co,d@d.co,e@e.co,f@f.co", mode: "design" })).status).toBe(400);
    requireUser.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    expect((await post({ email: "yo@ejemplo.com", mode: "design" })).status).toBe(403);
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it("says why when the email provider fails", async () => {
    sendTransactional.mockRejectedValue(new Error("SES: address not verified"));
    const res = await post({ email: "yo@ejemplo.com", mode: "design" });
    expect(res.status).toBe(502);
    expect((await res.json()).message).toContain("SES: address not verified");
  });
});
