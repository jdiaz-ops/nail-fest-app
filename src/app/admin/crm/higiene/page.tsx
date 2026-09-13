import { requirePageUser } from "@/lib/auth/guard";
import EmailQualityClient from "@/components/admin/EmailQualityClient";
import CrmPageHeader from "../CrmPageHeader";

export const dynamic = "force-dynamic";

// Pre-flight list-hygiene check over the real MARKETING-consented pool —
// see lib/email/qualityCheck.ts's own comment for exactly what this
// catches (dead domains, disposable addresses, likely typos, role-based
// addresses) and what it can't (a domain having mail servers doesn't
// mean any specific mailbox on it still exists — only an actual send
// attempt, tracked via lib/email/tracking.ts's bounce/complaint
// auto-suppression, can catch that). ADMIN-only, same posture as
// Importar/Broadcasts/Segmentos/Supresiones/Etiquetar.
export default async function HigienePage() {
  await requirePageUser(["ADMIN"]);

  return (
    <div>
      <CrmPageHeader
        title="Higiene de la lista"
        subtitle="Revisa el universo con consentimiento de marketing activo en busca de dominios que no pueden recibir correo, direcciones desechables, posibles errores de tipeo, y correos de rol — antes de gastar un solo envío en ellos."
      />
      <EmailQualityClient />
    </div>
  );
}
