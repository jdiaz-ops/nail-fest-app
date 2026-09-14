import { requirePageUser } from "@/lib/auth/guard";
import EmailQualityClient from "@/components/admin/EmailQualityClient";
import PhoneQualityClient from "@/components/admin/PhoneQualityClient";
import DomainAuthStatus from "@/components/admin/DomainAuthStatus";
import DuplicateCheckClient from "@/components/admin/DuplicateCheckClient";
import PersonDedupeClient from "@/components/admin/PersonDedupeClient";
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
        subtitle="Revisa correos y teléfonos con consentimiento activo en busca de direcciones/números que nunca van a recibir nada — antes de gastar un solo envío en ellos."
      />
      <EmailQualityClient />

      <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "36px 0" }} />

      <h2 style={{ fontSize: 16, marginBottom: 6 }}>¿Están bien los teléfonos, para WhatsApp?</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 16, maxWidth: 720 }}>
        Mismo principio que arriba, para el único otro canal con consentimiento propio: sin teléfono, con muy pocos o demasiados
        dígitos, con caracteres raros, o con un patrón obviamente inventado (0000000000, 1234567890) — antes de gastar un envío de
        WhatsApp en un número que nunca iba a recibirlo. No hay equivalente al DNS del correo (no existe un "¿este número existe?"
        gratis) — lo que sí puede confirmar eso es un envío real, que ya queda cubierto por la limpieza automática de dos fallas
        seguidas en la bandeja de WhatsApp.
      </p>
      <PhoneQualityClient />

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

      <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "36px 0" }} />

      <h2 style={{ fontSize: 16, marginBottom: 6 }}>Fusionar duplicados de alta confianza</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 16, maxWidth: 720 }}>
        Convierte la señal de arriba en una decisión — pero solo cuando el mismo teléfono además comparte el mismo usuario de correo
        (con el dominio mal escrito) o el mismo nombre completo. Nada se borra ni se re-asigna: los perfiles quedan marcados como "el
        mismo humano que" su perfil principal, para que "cuántas personas únicas tengo" deje de depender de una lista de teléfonos que
        alguien tiene que leer una por una.
      </p>
      <PersonDedupeClient />
    </div>
  );
}
