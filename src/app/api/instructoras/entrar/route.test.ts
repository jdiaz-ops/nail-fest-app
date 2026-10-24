import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  instructorAccount: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
const { verifyPassword } = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/auth/password", () => ({ verifyPassword }));
const { createInstructorSession, recordFailedLogin } = vi.hoisted(() => ({ createInstructorSession: vi.fn(), recordFailedLogin: vi.fn() }));
vi.mock("@/lib/library/portalAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library/portalAuth")>()),
  createInstructorSession,
  recordFailedLogin,
}));

import { POST } from "./route";

const ACCOUNT = { id: "a1", passwordHash: "h", failedLogins: 0, lockedUntil: null, resetRequestedAt: null };
const enter = (body: unknown) => POST(new NextRequest("http://localhost/api/instructoras/entrar", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  db.instructorAccount.findUnique.mockReset().mockResolvedValue(ACCOUNT);
  db.instructorAccount.findFirst.mockReset().mockResolvedValue(ACCOUNT);
  db.instructorAccount.update.mockReset();
  verifyPassword.mockReset().mockResolvedValue(true);
  createInstructorSession.mockReset().mockResolvedValue("token-1");
  recordFailedLogin.mockReset().mockResolvedValue(false);
});

describe("POST /api/instructoras/entrar", () => {
  it("lets her in with her username or her email", async () => {
    let res = await enter({ login: "Ana Pérez", password: "12345678" });
    expect(res.status).toBe(200);
    expect(db.instructorAccount.findFirst).toHaveBeenCalledWith({ where: { instructor: { slug: "anaperez" } } });
    expect(res.cookies.get("nf_instructora")?.value).toBe("token-1");

    res = await enter({ login: "ANA@correo.com", password: "12345678" });
    expect(res.status).toBe(200);
    expect(db.instructorAccount.findUnique).toHaveBeenCalledWith({ where: { email: "ana@correo.com" } });
  });

  it("answers the same whether the account exists or the password is wrong", async () => {
    db.instructorAccount.findFirst.mockResolvedValueOnce(null);
    const missing = await enter({ login: "nadie", password: "12345678" });
    verifyPassword.mockResolvedValueOnce(false);
    const wrong = await enter({ login: "ana", password: "nope" });
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect((await missing.json()).message).toBe((await wrong.json()).message);
    expect(createInstructorSession).not.toHaveBeenCalled();
  });

  it("locks after too many wrong passwords, and stays locked a while", async () => {
    verifyPassword.mockResolvedValueOnce(false);
    recordFailedLogin.mockResolvedValueOnce(true);
    expect((await enter({ login: "ana", password: "nope" })).status).toBe(429);

    db.instructorAccount.findFirst.mockResolvedValueOnce({ ...ACCOUNT, lockedUntil: new Date(Date.now() + 60_000) });
    const res = await enter({ login: "ana", password: "12345678" });
    expect(res.status).toBe(429);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
  });

  it("clears an earlier «olvidé mi contraseña» once she remembers it", async () => {
    db.instructorAccount.findFirst.mockResolvedValueOnce({ ...ACCOUNT, resetRequestedAt: new Date() });
    await enter({ login: "ana", password: "12345678" });
    expect(db.instructorAccount.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { resetRequestedAt: null } });
  });
});
