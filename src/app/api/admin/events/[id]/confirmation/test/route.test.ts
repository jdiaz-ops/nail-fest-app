import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { requireUser, sendTransactional, sampleConfirmation } = vi.hoisted(() => ({ requireUser: vi.fn(), sendTransactional: vi.fn(), sampleConfirmation: vi.fn() }));
const db = vi.hoisted(() => ({ event: { findUnique: vi.fn() } }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/email", () => ({ emailProvider: { sendTransactional } }));
vi.mock("@/lib/confirmationSample", () => ({ sampleConfirmation }));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new NextRequest("https://nailfest.lat/api/admin/events/ev_1/confirmation/test", { method: "POST", body: JSON.stringify(body) }), { params: { id: "ev_1" } });

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  db.event.findUnique.mockReset().mockResolvedValue({ id: "ev_1" });
  sampleConfirmation.mockReset().mockResolvedValue({ subject: "¡Tu cupo está confirmado!", text: "t", html: "<p>h</p>" });
  sendTransactional.mockReset().mockResolvedValue({ providerMessageId: "m1" });
});

describe("«Enviar prueba» of an event's confirmation", () => {
  it("sends what the editor has, now, to each address, marked [Prueba]", async () => {
    const res = await post({ email: "Yo@Ejemplo.com, otra@ejemplo.com", mode: "event", html: "<p>sin guardar</p>", subject: "Hola" });
    expect(res.status).toBe(200);
    expect(sampleConfirmation).toHaveBeenCalledWith({ id: "ev_1" }, "event", { html: "<p>sin guardar</p>", subject: "Hola" });
    expect(sendTransactional.mock.calls.map(([m]) => [m.to, m.subject])).toEqual([
      ["yo@ejemplo.com", "[Prueba] ¡Tu cupo está confirmado!"],
      ["otra@ejemplo.com", "[Prueba] ¡Tu cupo está confirmado!"],
    ]);
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
