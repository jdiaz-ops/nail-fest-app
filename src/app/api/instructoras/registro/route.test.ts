import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  instructor: { findUnique: vi.fn(), create: vi.fn() },
  instructorAccount: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "hashed") }));
const { getLibrarySettings } = vi.hoisted(() => ({ getLibrarySettings: vi.fn() }));
vi.mock("@/lib/library/settings", () => ({ getLibrarySettings }));
const { viewerCanSeeSamples } = vi.hoisted(() => ({ viewerCanSeeSamples: vi.fn() }));
vi.mock("@/lib/reviewsViewer", () => ({ viewerCanSeeSamples }));
const { createInstructorSession } = vi.hoisted(() => ({ createInstructorSession: vi.fn() }));
vi.mock("@/lib/library/portalAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library/portalAuth")>()),
  createInstructorSession,
}));

import { POST } from "./route";

const BODY = { username: "Ana Pérez", email: "Ana@Correo.com", phone: "300 123 4567", password: "12345678", acceptTerms: true, website: "" };
const signUp = (body: unknown) => POST(new NextRequest("http://localhost/api/instructoras/registro", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  db.instructor.findUnique.mockReset().mockResolvedValue(null);
  db.instructor.create.mockReset().mockResolvedValue({ id: "i1", account: { id: "a1" } });
  db.instructorAccount.findUnique.mockReset().mockResolvedValue(null);
  getLibrarySettings.mockReset().mockResolvedValue({ portalOpen: true });
  viewerCanSeeSamples.mockReset().mockResolvedValue(false);
  createInstructorSession.mockReset().mockResolvedValue("token-1");
});

describe("POST /api/instructoras/registro", () => {
  it("makes her profile as a draft, without the seal, and logs her in to the onboarding", async () => {
    const res = await signUp(BODY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, next: "/instructoras/portal/bienvenida" });
    expect(db.instructor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "anaperez",
          name: "anaperez",
          city: "",
          invited: false,
          account: { create: expect.objectContaining({ email: "ana@correo.com", phone: "+573001234567", passwordHash: "hashed" }) },
        }),
      }),
    );
    expect(res.cookies.get("nf_instructora")?.value).toBe("token-1");
  });

  it("is closed while the registration is — except for the team", async () => {
    getLibrarySettings.mockResolvedValue({ portalOpen: false });
    expect((await signUp(BODY)).status).toBe(404);
    viewerCanSeeSamples.mockResolvedValue(true);
    expect((await signUp(BODY)).status).toBe(200);
  });

  it("tells a bot «ok» and makes nothing", async () => {
    const res = await signUp({ ...BODY, website: "http://spam.example" });
    expect(await res.json()).toEqual({ ok: true });
    expect(db.instructor.create).not.toHaveBeenCalled();
  });

  it("says which box is wrong: a taken username, a taken email, the terms", async () => {
    db.instructor.findUnique.mockResolvedValueOnce({ id: "other" });
    let res = await signUp(BODY);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ fields: ["username"], message: "Ese usuario ya existe. Prueba otro." });

    db.instructorAccount.findUnique.mockResolvedValueOnce({ id: "other" });
    res = await signUp(BODY);
    expect(await res.json()).toMatchObject({ fields: ["email"] });

    res = await signUp({ ...BODY, acceptTerms: false });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Para crear tu cuenta, acepta los términos del directorio.");

    res = await signUp({ ...BODY, username: "portal" });
    expect(await res.json()).toMatchObject({ fields: ["username"], message: "Ese usuario no está disponible." });
    expect(db.instructor.create).not.toHaveBeenCalled();
  });
});
