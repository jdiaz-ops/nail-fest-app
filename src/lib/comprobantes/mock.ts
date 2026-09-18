import { db } from "@/lib/db";
import type { PendienteView, PendientesResponse, RecienteView, SubirPayload, SubirResult } from "./types";

// COMPROBANTES_MOCK=1 stand-in for the backend contable while it doesn't
// exist yet (see the module's own README section). No shared server
// memory needed (this runs across separate, possibly-cold serverless
// invocations) — `recientes` is derived straight from this app's own
// Comprobante rows, which already persist in Postgres regardless of which
// lambda instance answers a given request. A row marked RECIBIDO more
// than RECIBIDO_TO_ENLAZADO_MS ago is reported back as "enlazado", faking
// the backend catching up on its own — exactly what a real integration
// test of this screen needs (see the module comment on "pendientes de
// nuevo, aparece enlazado").
const RECIBIDO_TO_ENLAZADO_MS = 10_000;

const MOCK_PENDIENTES: PendienteView[] = [
  { id: "MOCK-1", fecha: "2026-09-10", monto: 85000, descripcion: "COMPRA EN RESTAURANTE X", cuenta: "Bancolombia", dias: 8 },
  { id: "MOCK-2", fecha: "2026-09-14", monto: 32000, descripcion: "PAGO BOLD TERMINAL 0912", cuenta: "Bold", dias: 4 },
  { id: "MOCK-3", fecha: "2026-09-15", monto: 250000, descripcion: "COMPRA FERRETERIA MONTAJE", cuenta: "Bancolombia", dias: 3 },
  { id: "MOCK-4", fecha: "2026-09-16", monto: 18500, descripcion: "COMPRA EN TIENDA DE BARRIO", cuenta: "Bancolombia", dias: 2 },
  { id: "MOCK-5", fecha: "2026-09-17", monto: 120000, descripcion: "TRANSFERENCIA A PROVEEDOR", cuenta: "Bancolombia", dias: 1 },
];

export async function mockPendientes(): Promise<PendientesResponse> {
  const recent = await db.comprobante.findMany({
    where: { estado: { in: ["RECIBIDO", "ENLAZADO"] } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const recientes: RecienteView[] = recent.map((c) => {
    const enlazado = c.estado === "ENLAZADO" || Date.now() - c.updatedAt.getTime() > RECIBIDO_TO_ENLAZADO_MS;
    return {
      comprobanteId: c.id,
      estado: enlazado ? "enlazado" : "recibido",
      movimiento: `${c.createdAt.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · comprobante de prueba`,
    };
  });

  return { ok: true, actualizado: new Date().toISOString(), pendientes: MOCK_PENDIENTES, recientes };
}

export async function mockSubir(payload: SubirPayload): Promise<SubirResult> {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { ok: true, estado: "recibido", driveFileIds: [`mock-drive-${payload.comprobanteId}`] };
}
