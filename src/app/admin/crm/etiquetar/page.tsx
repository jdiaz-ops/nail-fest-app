import { requirePageUser } from "@/lib/auth/guard";
import TagEmailsForm from "@/components/admin/TagEmailsForm";
import CrmPageHeader from "../CrmPageHeader";

export const dynamic = "force-dynamic";

// The positive counterpart to Supresiones — importa una lista externa de
// gente COMPROMETIDA (ej. quién abrió un correo reciente en Brevo) y la
// convierte en una etiqueta usable de inmediato en /admin/segments, en
// vez de una condición de segmento nueva por inventar. ADMIN-only, mismo
// criterio que Importar/Broadcasts/Segmentos/Supresiones.
export default async function EtiquetarPage() {
  await requirePageUser(["ADMIN"]);

  return (
    <div>
      <CrmPageHeader
        title="Etiquetar por lista"
        subtitle='Pega una lista de correos que ya sabes que están comprometidos — por ejemplo, quién abrió tu último correo en Brevo. Se les pone la etiqueta que elijas, ya usable en el constructor de segmentos para armar la ola piloto con la gente que sí responde.'
      />
      <TagEmailsForm defaultLabel="Comprometido — abrió correo en Brevo" />
    </div>
  );
}
