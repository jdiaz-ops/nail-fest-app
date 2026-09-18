import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, update } = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { comprobante: { findUnique, update } },
}));

const { subirComprobante } = vi.hoisted(() => ({ subirComprobante: vi.fn() }));
vi.mock("./contabilidadClient", () => ({ subirComprobante }));

// Imported AFTER the mocks above are declared (vi.mock is hoisted, so this
// is safe either way, but keeping it explicit).
import { intentarEnviarComprobante } from "./send";

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1",
    userId: "u1",
    user: { username: "juan" },
    pendienteId: null,
    medio: "EFECTIVO",
    pagadoPor: "Juan",
    nota: null,
    archivos: [] as string[],
    estado: "ENVIANDO",
    driveFileIds: [] as string[],
    intentos: 0,
    ultimoError: null,
    createdAt: new Date("2026-09-18T12:00:00Z"),
    updatedAt: new Date("2026-09-18T12:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  subirComprobante.mockReset();
});

describe("intentarEnviarComprobante", () => {
  it("no-ops when the row no longer exists", async () => {
    findUnique.mockResolvedValue(null);
    const result = await intentarEnviarComprobante("missing");
    expect(result).toEqual({ ok: true, shouldRetry: false });
    expect(subirComprobante).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("never re-sends a row the backend already has (RECIBIDO)", async () => {
    findUnique.mockResolvedValue(row({ estado: "RECIBIDO" }));
    const result = await intentarEnviarComprobante("c1");
    expect(result).toEqual({ ok: true, shouldRetry: false });
    expect(subirComprobante).not.toHaveBeenCalled();
  });

  it("never re-sends a row already given up on (ERROR)", async () => {
    findUnique.mockResolvedValue(row({ estado: "ERROR" }));
    const result = await intentarEnviarComprobante("c1");
    expect(result).toEqual({ ok: false, shouldRetry: false });
    expect(subirComprobante).not.toHaveBeenCalled();
  });

  it("marks RECIBIDO and stops retrying on success", async () => {
    findUnique.mockResolvedValue(row());
    subirComprobante.mockResolvedValue({ ok: true, estado: "recibido", driveFileIds: ["d1"] });

    const result = await intentarEnviarComprobante("c1");

    expect(result).toEqual({ ok: true, shouldRetry: false });
    expect(update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { estado: "RECIBIDO", driveFileIds: ["d1"], intentos: 1, ultimoError: null },
    });
  });

  it("never retries token_invalido, even on the very first attempt", async () => {
    findUnique.mockResolvedValue(row());
    subirComprobante.mockResolvedValue({ ok: false, error: "token_invalido" });

    const result = await intentarEnviarComprobante("c1");

    expect(result).toEqual({ ok: false, shouldRetry: false });
    expect(update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { estado: "ERROR", intentos: 1, ultimoError: "token_invalido" },
    });
  });

  it("asks for a retry on a transient failure below the attempt cap", async () => {
    findUnique.mockResolvedValue(row({ intentos: 1 }));
    subirComprobante.mockResolvedValue({ ok: false, error: "timeout" });

    const result = await intentarEnviarComprobante("c1");

    expect(result).toEqual({ ok: false, shouldRetry: true });
    // estado is NOT included in this update — the row stays ENVIANDO.
    expect(update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { intentos: 2, ultimoError: "timeout" } });
  });

  it("gives up (ERROR, no more retries) once the attempt cap is reached", async () => {
    findUnique.mockResolvedValue(row({ intentos: 4 })); // this call is attempt #5
    subirComprobante.mockResolvedValue({ ok: false, error: "timeout" });

    const result = await intentarEnviarComprobante("c1");

    expect(result).toEqual({ ok: false, shouldRetry: false });
    expect(update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { estado: "ERROR", intentos: 5, ultimoError: "timeout" },
    });
  });

  it("always sends the same comprobanteId — retries never mint a new one (idempotency)", async () => {
    findUnique.mockResolvedValue(row({ intentos: 2 }));
    subirComprobante.mockResolvedValue({ ok: false, error: "timeout" });

    await intentarEnviarComprobante("c1");

    expect(subirComprobante).toHaveBeenCalledWith(expect.objectContaining({ comprobanteId: "c1" }));
  });

  it("treats a thrown network error the same as an ok:false response", async () => {
    findUnique.mockResolvedValue(row({ intentos: 4 }));
    subirComprobante.mockRejectedValue(new Error("fetch failed"));

    const result = await intentarEnviarComprobante("c1");

    expect(result).toEqual({ ok: false, shouldRetry: false });
    expect(update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { estado: "ERROR", intentos: 5, ultimoError: "fetch failed" },
    });
  });
});
