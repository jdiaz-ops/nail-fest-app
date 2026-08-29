import { db } from "@/lib/db";
import ImportComposer from "@/components/ImportComposer";
import CrmPageHeader from "../CrmPageHeader";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const events = await db.event.findMany({ orderBy: { startsAt: "desc" } });

  return (
    <div>
      <CrmPageHeader
        title="Importar registros históricos"
        subtitle={
          'Sube el export "doorlist" de Ticket Tailor para un evento (CSV). Todo el procesamiento (agrupar por email, normalizar ciudad/teléfono/profesión) pasa en tu navegador antes de enviar nada — puedes revisar el resumen abajo antes de confirmar. No se envía ningún correo ni se genera QR para estos registros; es solo para poblar el CRM y las audiencias de Meta con datos históricos.'
        }
      />
      <ImportComposer events={events.map((e) => ({ slug: e.slug, name: e.name }))} />
    </div>
  );
}
