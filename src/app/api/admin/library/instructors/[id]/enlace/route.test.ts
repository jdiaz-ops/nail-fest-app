import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));
const db = vi.hoisted(() => ({
  instructor: { findUnique: vi.fn() },
  instructorAccount: { update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
const { createAccessLink } = vi.hoisted(() => ({ createAccessLink: vi.fn() }));
vi.mock("@/lib/library/portalAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library/portalAuth")>()),
  createAccessLink,
}));

import { POST } from "./route";

const make = (kind: string) => POST(new NextRequest("http://localhost/api/admin/library/instructors/i1/enlace", { method: "POST", body: JSON.stringify({ kind }) }), { params: { id: "i1" } });

beforeEach(() => {
  process.env.APP_BASE_URL = "https://nailfest.lat";
  requireUser.mockReset().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  db.instructor.findUnique.mockReset().mockResolvedValue({ id: "i1", name: "Ana Pérez", whatsapp: null, account: { id: "a1", phone: "+573001234567" } });
  db.instructorAccount.update.mockReset();
  createAccessLink.mockReset().mockResolvedValue("tok123");
});

describe("POST /api/admin/library/instructors/[id]/enlace", () => {
  it("a new-password link, with the message ready for her WhatsApp — sent by hand", async () => {
    const res = await make("RESET");
    const body = await res.json();
    expect(body.url).toBe("https://nailfest.lat/instructoras/clave/tok123");
    expect(body.text).toContain("Hola, Ana.");
    expect(body.whatsapp).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/);
    expect(createAccessLink).toHaveBeenCalledWith("i1", "RESET");
    // The request she left is handled.
    expect(db.instructorAccount.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { resetRequestedAt: null } });
  });

  it("an invitation only for a profile without an account, and a new password only with one", async () => {
    expect((await make("INVITE")).status).toBe(409);
    db.instructor.findUnique.mockResolvedValue({ id: "i1", name: "Ana", whatsapp: null, account: null });
    expect((await make("RESET")).status).toBe(409);
    const res = await make("INVITE");
    expect(res.status).toBe(200);
    // No phone to write to: WhatsApp opens to pick the chat.
    expect((await res.json()).whatsapp).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(createAccessLink).toHaveBeenCalledTimes(1);
  });
});
