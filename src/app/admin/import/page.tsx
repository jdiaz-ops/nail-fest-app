import { db } from "@/lib/db";
import ImportComposer from "@/components/ImportComposer";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const events = await db.event.findMany({ orderBy: { startsAt: "desc" } });

  return (
    <div>
      <h1>Importar registros históricos</h1>
      <p style={{ color: "#5b5f6b" }}>
        Sube el export &quot;doorlist&quot; de Ticket Tailor para un evento (CSV). Todo el
        procesamiento (agrupar por email, normalizar ciudad/teléfono/profesión) pasa en tu
        navegador antes de enviar nada — puedes revisar el resumen abajo antes de confirmar. No se
        envía ningún correo ni se genera QR para estos registros; es solo para poblar el CRM y las
        audiencias de Meta con datos históricos.
      </p>
      <ImportComposer events={events.map((e) => ({ slug: e.slug, name: e.name }))} />
    </div>
  );
}
