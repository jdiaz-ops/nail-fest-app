import { requirePageUser } from "@/lib/auth/guard";
import EmailQualityClient from "@/components/admin/EmailQualityClient";
import DomainAuthStatus from "@/components/admin/DomainAuthStatus";
import DuplicateCheckClient from "@/components/admin/DuplicateCheckClient";
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

      <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "36px 0" }} />

      <h2 style={{ fontSize: 16, marginBottom: 6 }}>Autenticación del dominio de envío (SPF/DKIM)</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 16, maxWidth: 720 }}>
        Ninguna limpieza de lista sirve de nada si el dominio desde el que envías nunca quedó autenticado — sin SPF/DKIM verificados, los
        proveedores de correo no tienen cómo confiar en que el dominio es quien dice ser, y hasta una lista perfectamente limpia puede
        terminar en spam.
      </p>
      <DomainAuthStatus />

      <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "36px 0" }} />

      <h2 style={{ fontSize: 16, marginBottom: 6 }}>¿Son personas realmente únicas?</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 16, maxWidth: 720 }}>
        Person.email tiene una restricción única a nivel de base de datos — dos correos idénticos son imposibles por diseño, no solo
        improbables. Lo que el correo SÍ puede esconder es la misma persona real registrada dos veces con dos correos distintos — el
        teléfono es la señal más fuerte que hay para detectar eso.
      </p>
      <DuplicateCheckClient />
    </div>
  );
}
