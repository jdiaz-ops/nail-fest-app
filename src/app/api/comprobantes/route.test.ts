import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));

const { findMany, create, findUnique } = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { comprobante: { findMany, create, findUnique } },
}));

const { intentarEnviarComprobante } = vi.hoisted(() => ({ intentarEnviarComprobante: vi.fn() }));
vi.mock("@/lib/comprobantes/send", () => ({ intentarEnviarComprobante }));

const { scheduleComprobanteRetry } = vi.hoisted(() => ({ scheduleComprobanteRetry: vi.fn() }));
vi.mock("@/lib/qstash", () => ({ scheduleComprobanteRetry }));

import { GET, POST } from "./route";

const FORBIDDEN = { response: { status: 403, __tag: "forbidden" } };
const OK_AUTH = { user: { id: "u1", username: "juan", name: "Juan", role: "ADMIN" } };

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/comprobantes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireUser.mockReset();
  findMany.mockReset();
  create.mockReset();
  findUnique.mockReset();
  intentarEnviarComprobante.mockReset();
  scheduleComprobanteRetry.mockReset();
});

describe("GET /api/comprobantes", () => {
  it("never queries the DB without ADMIN/COORDINADOR", async () => {
    requireUser.mockResolvedValue(FORBIDDEN);
    const res = await GET();
    expect(res).toBe(FORBIDDEN.response);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("only ever lists the calling user's own comprobantes", async () => {
    requireUser.mockResolvedValue(OK_AUTH);
    findMany.mockResolvedValue([]);
    await GET();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" }, take: 20 })
    );
  });
});

describe("POST /api/comprobantes", () => {
  it("rejects without ADMIN/COORDINADOR before touching the DB", async () => {
    requireUser.mockResolvedValue(FORBIDDEN);
    const res = await POST(postRequest({ pendienteId: null, medio: "EFECTIVO", pagadoPor: "Juan", archivos: ["u"] }));
    expect(res).toBe(FORBIDDEN.response);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a body missing the one required field (medio)", async () => {
    requireUser.mockResolvedValue(OK_AUTH);
    const res = await POST(postRequest({ pendienteId: null, pagadoPor: "Juan", archivos: ["u"] }));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("makes exactly one inline send attempt and does not schedule a retry on success", async () => {
    requireUser.mockResolvedValue(OK_AUTH);
    create.mockResolvedValue({ id: "c1" });
    findUnique.mockResolvedValue({ id: "c1", estado: "RECIBIDO" });
    intentarEnviarComprobante.mockResolvedValue({ ok: true, shouldRetry: false });

    const res = await POST(postRequest({ pendienteId: null, medio: "EFECTIVO", pagadoPor: "Juan", archivos: ["u1"] }));

    expect(res.status).toBe(200);
    expect(intentarEnviarComprobante).toHaveBeenCalledWith("c1");
    expect(scheduleComprobanteRetry).not.toHaveBeenCalled();
  });

  it("hands off to QStash when the inline attempt only fails transiently", async () => {
    requireUser.mockResolvedValue(OK_AUTH);
    create.mockResolvedValue({ id: "c2" });
    findUnique.mockResolvedValue({ id: "c2", estado: "ENVIANDO" });
    intentarEnviarComprobante.mockResolvedValue({ ok: false, shouldRetry: true });

    await POST(postRequest({ pendienteId: null, medio: "EFECTIVO", pagadoPor: "Juan", archivos: ["u1"] }));

    expect(scheduleComprobanteRetry).toHaveBeenCalledWith("c2");
  });
});
