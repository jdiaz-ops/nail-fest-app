import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { getPendientes } from "@/lib/comprobantes/contabilidadClient";
import { RECIENTE_TO_ESTADO } from "@/lib/comprobantes/types";

// Backs "Pagos sin soporte" (Sección A). Also does the one reconciliation
// pass this app needs: `recientes` is the backend's own read of which of
// THIS app's comprobantes it has matched to a bank movement — every time
// this route runs, it writes any estado change back onto the local
// Comprobante row, so "Enviados recientemente" (a separate, local-DB-only
// list — see /api/comprobantes's own GET) picks it up on its next poll
// without needing to re-derive anything client-side.
export async function GET() {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const data = await getPendientes();

  await Promise.all(
    data.recientes.map((r) =>
      db.comprobante
        .updateMany({
          where: { id: r.comprobanteId, estado: { not: RECIENTE_TO_ESTADO[r.estado] } },
          data: { estado: RECIENTE_TO_ESTADO[r.estado] },
        })
        .catch(() => {
          // A comprobanteId the backend knows about but that doesn't
          // exist locally (a different deploy/environment's data, or a
          // row that got deleted) — never worth failing this whole
          // request over.
        })
    )
  );

  return NextResponse.json(data);
}
