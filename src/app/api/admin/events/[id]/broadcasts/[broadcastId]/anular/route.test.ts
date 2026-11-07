import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, cancelScheduledSend } = vi.hoisted(() => ({ requireUser: vi.fn(), cancelScheduledSend: vi.fn() }));
const db = vi.hoisted(() => ({ emailBroadcast: { findFirst: vi.fn(), updateMany: vi.fn() } }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/qstash", () => ({ cancelScheduledSend }));

import { POST } from "./route";

const cancel = () => POST(new Request("https://nailfest.lat/api/admin/events/ev_1/broadcasts/b_1/anular", { method: "POST" }), { params: { id: "ev_1", broadcastId: "b_1" } });

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  db.emailBroadcast.findFirst.mockReset().mockResolvedValue({ id: "b_1", eventId: "ev_1", status: "QUEUED", qstashMessageId: "msg_1" });
  db.emailBroadcast.updateMany.mockReset().mockResolvedValue({ count: 1 });
  cancelScheduledSend.mockReset().mockResolvedValue(undefined);
});

describe("«Anular» a scheduled email of the event", () => {
  it("a scheduled one: anulado, and its exact-time message cancelled", async () => {
    const res = await cancel();
    expect(res.status).toBe(200);
    expect(db.emailBroadcast.updateMany).toHaveBeenCalledWith({ where: { id: "b_1", eventId: "ev_1", status: "QUEUED" }, data: { status: "CANCELLED", qstashMessageId: null } });
    expect(cancelScheduledSend).toHaveBeenCalledWith("msg_1");
  });

  it("one already going out (or sent): no, and says why", async () => {
    db.emailBroadcast.findFirst.mockResolvedValue({ id: "b_1", eventId: "ev_1", status: "SENDING", qstashMessageId: null });
    db.emailBroadcast.updateMany.mockResolvedValue({ count: 0 });
    const res = await cancel();
    expect(res.status).toBe(409);
    expect((await res.json()).message).toContain("ya no se puede anular");
    expect(cancelScheduledSend).not.toHaveBeenCalled();
  });

  it("only the team's admins, and only this event's emails", async () => {
    requireUser.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    expect((await cancel()).status).toBe(403);
    requireUser.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    db.emailBroadcast.findFirst.mockResolvedValue(null);
    expect((await cancel()).status).toBe(404);
    expect(db.emailBroadcast.updateMany).not.toHaveBeenCalled();
  });
});
