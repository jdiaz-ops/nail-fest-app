import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, cancelScheduledSend } = vi.hoisted(() => ({ requireUser: vi.fn(), cancelScheduledSend: vi.fn() }));
const db = vi.hoisted(() => ({ whatsAppBroadcast: { findUnique: vi.fn(), updateMany: vi.fn() } }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/qstash", () => ({ cancelScheduledSend }));

import { POST } from "./route";

const stop = () => POST(new Request("https://nailfest.lat/api/admin/whatsapp/broadcasts/w_1/detener", { method: "POST" }), { params: { id: "w_1" } });

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  db.whatsAppBroadcast.findUnique.mockReset().mockResolvedValue({ id: "w_1", status: "SENDING", qstashMessageId: "msg_old" });
  db.whatsAppBroadcast.updateMany.mockReset().mockResolvedValue({ count: 1 });
  cancelScheduledSend.mockReset().mockResolvedValue(undefined);
});

describe("«Detener envío» on a difusión", () => {
  it("one going out: stopped, its history kept", async () => {
    const res = await stop();
    expect(res.status).toBe(200);
    expect(db.whatsAppBroadcast.updateMany).toHaveBeenCalledWith({ where: { id: "w_1", status: { in: ["QUEUED", "SENDING"] } }, data: { status: "CANCELLED", qstashMessageId: null } });
    expect(cancelScheduledSend).not.toHaveBeenCalled();
  });

  it("a scheduled one: stopped, and its exact-time message cancelled", async () => {
    db.whatsAppBroadcast.findUnique.mockResolvedValue({ id: "w_1", status: "QUEUED", qstashMessageId: "msg_1" });
    expect((await stop()).status).toBe(200);
    expect(cancelScheduledSend).toHaveBeenCalledWith("msg_1");
  });

  it("one already finished: nothing to stop, and it says so", async () => {
    db.whatsAppBroadcast.findUnique.mockResolvedValue({ id: "w_1", status: "SENT", qstashMessageId: null });
    db.whatsAppBroadcast.updateMany.mockResolvedValue({ count: 0 });
    const res = await stop();
    expect(res.status).toBe(409);
    expect((await res.json()).message).toContain("ya terminó");
  });

  it("only the team's admins", async () => {
    requireUser.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    expect((await stop()).status).toBe(403);
    expect(db.whatsAppBroadcast.updateMany).not.toHaveBeenCalled();
  });
});
