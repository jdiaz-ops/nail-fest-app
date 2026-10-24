import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const tx = vi.hoisted(() => ({
  instructorAccessLink: { updateMany: vi.fn() },
  instructorSession: { deleteMany: vi.fn() },
  instructorAccount: { update: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)) } }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "hashed") }));
const { findAccessLink, createInstructorSession } = vi.hoisted(() => ({ findAccessLink: vi.fn(), createInstructorSession: vi.fn() }));
vi.mock("@/lib/library/portalAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library/portalAuth")>()),
  findAccessLink,
  createInstructorSession,
}));

import { POST } from "./route";

const use = (body: unknown) => POST(new NextRequest("http://localhost/api/instructoras/clave", { method: "POST", body: JSON.stringify(body) }));
const RESET = { id: "l1", kind: "RESET", instructorId: "i1", instructor: { account: { id: "a1" } } };
const INVITE = { id: "l2", kind: "INVITE", instructorId: "i2", instructor: { account: null } };

beforeEach(() => {
  findAccessLink.mockReset().mockResolvedValue(RESET);
  createInstructorSession.mockReset().mockResolvedValue("token-1");
  tx.instructorAccessLink.updateMany.mockReset().mockResolvedValue({ count: 1 });
  tx.instructorSession.deleteMany.mockReset();
  tx.instructorAccount.update.mockReset();
  tx.instructorAccount.create.mockReset().mockResolvedValue({ id: "a2" });
});

describe("POST /api/instructoras/clave", () => {
  it("a new password: every other device logs out, and she's in", async () => {
    const res = await use({ token: "t", password: "12345678" });
    expect(res.status).toBe(200);
    expect(tx.instructorSession.deleteMany).toHaveBeenCalledWith({ where: { accountId: "a1" } });
    expect(tx.instructorAccount.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: expect.objectContaining({ passwordHash: "hashed", resetRequestedAt: null }) });
    expect(createInstructorSession).toHaveBeenCalledWith("a1");
  });

  it("an invitation makes her account, with her email, her phone and the terms", async () => {
    findAccessLink.mockResolvedValue(INVITE);
    let res = await use({ token: "t", password: "12345678" });
    expect(res.status).toBe(400);
    expect(tx.instructorAccount.create).not.toHaveBeenCalled();

    res = await use({ token: "t", password: "12345678", email: "Ana@correo.com", phone: "3001234567", acceptTerms: true });
    expect(res.status).toBe(200);
    expect(tx.instructorAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ instructorId: "i2", email: "ana@correo.com", phone: "+573001234567", passwordHash: "hashed" }),
    });
  });

  it("a link works once: spent or expired, nothing changes", async () => {
    findAccessLink.mockResolvedValueOnce(null);
    expect((await use({ token: "t", password: "12345678" })).status).toBe(410);

    // Two taps at once: the second finds it spent inside the transaction.
    tx.instructorAccessLink.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await use({ token: "t", password: "12345678" });
    expect(res.status).toBe(410);
    expect(tx.instructorAccount.update).not.toHaveBeenCalled();
    expect(createInstructorSession).not.toHaveBeenCalled();
  });
});
