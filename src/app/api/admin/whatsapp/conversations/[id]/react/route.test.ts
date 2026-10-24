import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));

const { findFirst, update } = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { whatsAppMessage: { findFirst, update } } }));

const { sendReaction } = vi.hoisted(() => ({ sendReaction: vi.fn() }));
vi.mock("@/lib/whatsapp", () => ({ whatsappProvider: { sendReaction } }));

import { POST } from "./route";

const OK_AUTH = { user: { id: "u1", username: "juan", name: "Juan", role: "ADMIN" } };
const recent = () => new Date(Date.now() - 60_000);

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    conversationId: "c1",
    direction: "INBOUND",
    providerMessageId: "wamid.inbound",
    body: "Acrilicas y jelly tips",
    createdAt: recent(),
    staffReaction: null,
    conversation: { id: "c1", phone: "+573134328912", lastInboundAt: recent() },
    ...overrides,
  };
}

function react(body: unknown) {
  return POST(new NextRequest("http://localhost/api/admin/whatsapp/conversations/c1/react", { method: "POST", body: JSON.stringify(body) }), {
    params: { id: "c1" },
  });
}

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue(OK_AUTH);
  findFirst.mockReset();
  update.mockReset();
  sendReaction.mockReset();
});

describe("POST /api/admin/whatsapp/conversations/[id]/react", () => {
  it("sends the reaction to the message's wamid and keeps it on the message", async () => {
    findFirst.mockResolvedValue(message());
    sendReaction.mockResolvedValue({ providerMessageId: "wamid.reaction" });
    const res = await react({ messageId: "m1", emoji: "💅" });
    expect(res.status).toBe(200);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "m1", conversationId: "c1" } }));
    expect(sendReaction).toHaveBeenCalledWith({ to: "+573134328912", messageId: "wamid.inbound", emoji: "💅" });
    expect(update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { staffReaction: "💅", staffReactionProviderId: "wamid.reaction" } });
  });

  it("takes a reaction back with an empty emoji", async () => {
    findFirst.mockResolvedValue(message({ staffReaction: "❤️" }));
    sendReaction.mockResolvedValue({ providerMessageId: "wamid.removal" });
    await react({ messageId: "m1", emoji: null });
    expect(sendReaction).toHaveBeenCalledWith(expect.objectContaining({ emoji: "" }));
    expect(update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { staffReaction: null, staffReactionProviderId: "wamid.removal" } });
  });

  it("only takes the team's two emojis", async () => {
    const res = await react({ messageId: "m1", emoji: "👍" });
    expect(res.status).toBe(400);
    expect(sendReaction).not.toHaveBeenCalled();
  });

  it("never sends without a staff session", async () => {
    const forbidden = { response: new Response(null, { status: 403 }) };
    requireUser.mockResolvedValue(forbidden);
    const res = await react({ messageId: "m1", emoji: "❤️" });
    expect(res.status).toBe(403);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("refuses our own messages and other conversations' messages", async () => {
    findFirst.mockResolvedValue(message({ direction: "OUTBOUND" }));
    expect((await react({ messageId: "m1", emoji: "❤️" })).status).toBe(404);
    findFirst.mockResolvedValue(null);
    expect((await react({ messageId: "m1", emoji: "❤️" })).status).toBe(404);
    expect(sendReaction).not.toHaveBeenCalled();
  });

  it("says why when WhatsApp's 24h window is closed, without trying", async () => {
    const old = new Date(Date.now() - 26 * 3_600_000);
    findFirst.mockResolvedValue(message({ createdAt: old, conversation: { id: "c1", phone: "+57300", lastInboundAt: old } }));
    const res = await react({ messageId: "m1", emoji: "❤️" });
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/24 horas/);
    expect(sendReaction).not.toHaveBeenCalled();
  });

  it("does nothing when that reaction is already there", async () => {
    findFirst.mockResolvedValue(message({ staffReaction: "❤️" }));
    expect((await react({ messageId: "m1", emoji: "❤️" })).status).toBe(200);
    expect(sendReaction).not.toHaveBeenCalled();
  });

  it("says in words when WhatsApp didn't take it, never «Sin clasificar»", async () => {
    findFirst.mockResolvedValue(message());
    sendReaction.mockRejectedValue(new Error("No WhatsAppConnection configured — see docs/WHATSAPP_SETUP.md"));
    let res = await react({ messageId: "m1", emoji: "❤️" });
    expect(res.status).toBe(502);
    expect((await res.json()).message).toBe("WhatsApp no recibió la reacción. Vuelve a intentarlo en un momento.");
    sendReaction.mockRejectedValue(new Error('WhatsApp Cloud API 400 on 1/messages: {"error":{"code":131009,"message":"Parameter value is not valid"}}'));
    res = await react({ messageId: "m1", emoji: "❤️" });
    expect((await res.json()).message).toMatch(/muy viejo o haberse borrado/);
    expect(update).not.toHaveBeenCalled();
  });

  it("turns Meta's closed-window error into words, and doesn't keep the reaction", async () => {
    findFirst.mockResolvedValue(message());
    sendReaction.mockRejectedValue(new Error('WhatsApp Cloud API 400 on 1/messages: {"error":{"code":131047,"message":"Re-engagement message"}}'));
    const res = await react({ messageId: "m1", emoji: "❤️" });
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/24 horas/);
    expect(update).not.toHaveBeenCalled();
  });
});
