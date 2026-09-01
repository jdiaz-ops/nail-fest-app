import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import ImportComposer from "@/components/ImportComposer";
import CrmPageHeader from "../CrmPageHeader";

export const dynamic = "force-dynamic";

// ADMIN-only — hidden from CRM's own nav for COORDINADOR too (see
// CrmLayout), gated again here since the nav is just visibility, not the
// real access control.
export default async function ImportPage() {
  await requirePageUser(["ADMIN"]);
  const events = await db.event.findMany({ orderBy: { startsAt: "desc" } });

  return (
    <div>
      <CrmPageHeader
        title="Importar registros históricos"
        subtitle={
          'Sube el export "doorlist" (CSV, una fila por boleta) de un evento anterior. Todo el procesamiento (agrupar por email, normalizar ciudad/teléfono/profesión) pasa en tu navegador antes de enviar nada — puedes revisar el resumen abajo antes de confirmar. No se envía ningún correo ni se genera QR para estos registros; es solo para poblar el CRM y las audiencias de Meta con datos históricos.'
        }
      />
      <ImportComposer events={events.map((e) => ({ slug: e.slug, name: e.name }))} />
    </div>
  );
}
