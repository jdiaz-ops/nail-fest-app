import { requirePageUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { getPendientes } from "@/lib/comprobantes/contabilidadClient";
import ComprobantesScreen, { type ComprobanteView } from "./ComprobantesScreen";

export const dynamic = "force-dynamic";

// Same shape as bandeja/page.tsx: reachable from inside the per-event
// scanner (see ScanAppShell's own comment on why), ADMIN + COORDINADOR
// only, re-gated here too even though the tab is already hidden from
// STAFF in the nav. Comprobante itself has no eventId — this route's
// [eventId] param is only ever used to build the tab's own URL, never
// passed down into any query below.
export default async function ScanComprobantesPage() {
  const user = await requirePageUser(["ADMIN", "COORDINADOR"]);

  const [pendientesData, comprobantes] = await Promise.all([
    getPendientes(),
    db.comprobante.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const initialComprobantes: ComprobanteView[] = comprobantes.map((c) => ({
    id: c.id,
    pendienteId: c.pendienteId,
    medio: c.medio,
    pagadoPor: c.pagadoPor,
    nota: c.nota,
    estado: c.estado,
    ultimoError: c.ultimoError,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div style={{ margin: "-16px -16px 0", minHeight: "calc(100dvh - 260px)" }}>
      <ComprobantesScreen
        initialPendientes={pendientesData.pendientes}
        initialActualizado={pendientesData.actualizado}
        initialComprobantes={initialComprobantes}
        currentUserName={user.name || user.username}
      />
    </div>
  );
}
